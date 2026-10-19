// Κοινά αστρολογικά εργαλεία για τα παλιά εργαλεία (Αγάπη, Αλήθεια, Επιστροφή, Συμβατότητα, Οικονομικά).
// Ίδιοι κανόνες με τον νέο χρησμό της Επιστροφής:
//  - σωστή ώρα Ελλάδας για κάθε ημερομηνία γέννησης,
//  - έλεγχος ότι ο χάρτης ήρθε σωστά (αλλιώς σφάλμα, όχι χρησμός στον αέρα),
//  - χωρίς ώρα γέννησης δεν δίνονται οίκοι και Ωροσκόπος,
//  - οι πλανήτες της γενιάς δεν παρουσιάζονται ως προσωπικοί,
//  - πραγματικές ημερομηνίες για τις ερωτήσεις «πότε».
const { greeceTzone, zoneOffset, skyBlock, moonChangesSign } = require("./sky.cjs")(require("./vendor/astronomy.cjs"));
const { resolvePlace } = require("./place.cjs");

const hasTime = (tob) => /^\d{2}:\d{2}$/.test(String(tob || ""));

// Διαφορά ώρας από UTC για ημερομηνία YYYY-MM-DD και ώρα HH:MM (ή 12:00).
function tz(dob, tob) {
  const [y, m, d] = String(dob || "").split("-").map(n => parseInt(n, 10));
  let [h, mi] = String(tob || "12:00").split(":").map(n => parseInt(n, 10));
  if (!Number.isFinite(h)) h = 12;
  if (!Number.isFinite(mi)) mi = 0;
  if (!y || !m || !d) return 2;
  return greeceTzone(y, m, d, h, mi);
}

// Συντεταγμένες και διαφορά ώρας για τον τόπο γέννησης. Αν ο τόπος δεν βρεθεί: Αθήνα, ώρα Ελλάδας.
async function place(pob, dob, tob) {
  const found = pob ? await resolvePlace(pob).catch(() => null) : null;
  const [y, m, d] = String(dob || "").split("-").map(n => parseInt(n, 10));
  let [h, mi] = String(tob || "12:00").split(":").map(n => parseInt(n, 10));
  if (!Number.isFinite(h)) h = 12;
  if (!Number.isFinite(mi)) mi = 0;
  const tzName = found ? found.tzName : "Europe/Athens";
  return {
    lat: found ? found.lat : 37.9838,
    lon: found ? found.lon : 23.7275,
    tzName,
    tzone: (y && m && d) ? zoneOffset(tzName, y, m, d, h, mi) : 2,
    found: !!found,
    label: found ? `${found.name} ${found.country}` : "Αθήνα (προεπιλογή)"
  };
}

function check(chart) {
  if (!chart || !Array.isArray(chart.planets) || chart.planets.length === 0) {
    console.error("[astrologyapi] λάθος απάντηση: " + JSON.stringify(chart).slice(0, 300));
    throw new Error("Ο χάρτης δεν υπολογίστηκε");
  }
  return chart;
}

// Τα δεδομένα του χάρτη όπως τα βλέπει το Claude, με σημείωση αν λείπει η ώρα.
function forPrompt(chart, tob, name, dob, tzName) {
  check(chart);
  if (hasTime(tob)) return JSON.stringify(chart);
  const moonUnsure = moonChangesSign(dob, tzName);
  const { houses, ascendant, midheaven, vertex, aspects, ...rest } = chart;
  const clean = {
    ...rest,
    planets: chart.planets
      .filter(pl => !/ascendant|midheaven/i.test(pl.name || ""))
      .filter(pl => !(moonUnsure && pl.name === "Moon"))
      .map(({ house, ...pl }) => pl),
    aspects: (aspects || []).filter(a => !moonUnsure || !/moon/i.test(`${a.aspecting_planet} ${a.aspected_planet}`))
  };
  const who = name || "αυτό το πρόσωπο";
  return `(Για ${who} δεν δόθηκε ώρα γέννησης: ΜΗΝ αναφέρεις οίκους ούτε Ωροσκόπο. Μίλα μόνο για πλανήτες σε ζώδια και τις όψεις τους.` +
    (moonUnsure ? ` Η Σελήνη άλλαξε ζώδιο τη μέρα που γεννήθηκε, οπότε ΜΗΝ αναφέρεις καθόλου τη Σελήνη για ${who}.` : "") + `)\n` + JSON.stringify(clean);
}

const RULES = `

ΕΠΙΠΛΕΟΝ ΚΑΝΟΝΕΣ:
Ο Ουρανός, ο Ποσειδώνας και ο Πλούτωνας μένουν χρόνια στο ίδιο ζώδιο και είναι ίδιοι για όλη μια γενιά: ΠΟΤΕ μην τους παρουσιάζεις ως κάτι προσωπικό ή μοναδικό, ούτε το ότι είναι στο ίδιο ζώδιο στους δύο χάρτες ως ξεχωριστό δεσμό. Τον χαρακτήρα και το δέσιμο τα στηρίζεις στον Ήλιο, τη Σελήνη, την Αφροδίτη, τον Άρη, τον Ερμή, τον Ωροσκόπο και τους Δεσμούς της Σελήνης.
Μην επαναλαμβάνεις την ίδια φράση ή ιδέα δύο φορές.
ΦΥΛΟ: Κατάλαβε από τα ελληνικά ονόματα το φύλο του ατόμου που ρωτά και του άλλου προσώπου (π.χ. Γιώργος, Νίκος: άντρας, Μαρία, Ελένη: γυναίκα). Γράψε με το σωστό γραμματικό γένος για τον καθένα, σε όλο το κείμενο. Ο αναγνώστης μπορεί να είναι άντρας, και το άλλο πρόσωπο μπορεί να είναι του ίδιου φύλου. Οι οδηγίες εδώ είναι γραμμένες στο θηλυκό μόνο για συντομία: αν ρωτά άντρας, του μιλάς στο αρσενικό («καλέ μου», «σε βρίσκει καλά», «ο πόνος σου για αυτήν»). Αν το φύλο δεν φαίνεται από το όνομα, γράφεις με τρόπο που ταιριάζει και στα δύο.
Τα ονόματα τα γράφεις πάντα σωστά στα ελληνικά με κεφαλαίο το πρώτο γράμμα· αν είναι γραμμένα με λατινικούς χαρακτήρες (π.χ. maria, giorgos), τα γράφεις στα ελληνικά (Μαρία, Γιώργος). Μη χρησιμοποιείς παύλες ή σύμβολα όπως βελάκια.
ΑΠΑΓΟΡΕΥΟΝΤΑΙ οι λέξεις «ίσως» και «μπορεί» στον χρησμό, ΟΥΤΕ ΜΙΑ ΦΟΡΑ: μίλα με βεβαιότητα («θα», «έρχεται», «δείχνει»). Η μόνη εξαίρεση είναι η ανακατεύθυνση, όπου λες ότι μπορεί να ρωτήσει κάτι άλλο.
Δεν γράφεις την ίδια περιγραφή δύο φορές (π.χ. τι σημαίνει ένας οίκος): την εξηγείς μία φορά και μετά απλώς την ονομάζεις.`;

// Πραγματικές ημερομηνίες για ερωτήσεις «πότε».
function sky(p, chart1, chart2) {
  return `\n\n${skyBlock(p, { chart1, chart2 }, hasTime(p.tob1))}
Αν η απάντηση χρειάζεται χρόνο («πότε»), δώσε περίοδο ΜΟΝΟ με ημερομηνίες από την παραπάνω λίστα και πες ποια κίνηση την ανοίγει. Μη γράψεις καμία ημερομηνία ή κίνηση πλανήτη που δεν υπάρχει στη λίστα.`;
}

module.exports = { tz, place, check, forPrompt, RULES, sky, hasTime, moonChangesSign };
