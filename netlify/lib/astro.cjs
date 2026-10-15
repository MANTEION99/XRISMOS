// Κοινά αστρολογικά εργαλεία για τα παλιά εργαλεία (Αγάπη, Αλήθεια, Επιστροφή, Συμβατότητα, Οικονομικά).
// Ίδιοι κανόνες με τον νέο χρησμό της Επιστροφής:
//  - σωστή ώρα Ελλάδας για κάθε ημερομηνία γέννησης,
//  - έλεγχος ότι ο χάρτης ήρθε σωστά (αλλιώς σφάλμα, όχι χρησμός στον αέρα),
//  - χωρίς ώρα γέννησης δεν δίνονται οίκοι και Ωροσκόπος,
//  - οι πλανήτες της γενιάς δεν παρουσιάζονται ως προσωπικοί,
//  - πραγματικές ημερομηνίες για τις ερωτήσεις «πότε».
const { greeceTzone, skyBlock } = require("./sky.cjs");

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

function check(chart) {
  if (!chart || !Array.isArray(chart.planets) || chart.planets.length === 0) {
    console.error("[astrologyapi] λάθος απάντηση: " + JSON.stringify(chart).slice(0, 300));
    throw new Error("Ο χάρτης δεν υπολογίστηκε");
  }
  return chart;
}

// Τα δεδομένα του χάρτη όπως τα βλέπει το Claude, με σημείωση αν λείπει η ώρα.
function forPrompt(chart, tob, name) {
  check(chart);
  if (hasTime(tob)) return JSON.stringify(chart);
  const { houses, ascendant, midheaven, vertex, ...rest } = chart;
  const clean = {
    ...rest,
    planets: chart.planets
      .filter(pl => !/ascendant|midheaven/i.test(pl.name || ""))
      .map(({ house, ...pl }) => pl)
  };
  return `(Για ${name || "αυτό το πρόσωπο"} δεν δόθηκε ώρα γέννησης: ΜΗΝ αναφέρεις οίκους ούτε Ωροσκόπο. Μίλα μόνο για πλανήτες σε ζώδια και τις όψεις τους.)\n` + JSON.stringify(clean);
}

const RULES = `

ΕΠΙΠΛΕΟΝ ΚΑΝΟΝΕΣ:
Ο Ουρανός, ο Ποσειδώνας και ο Πλούτωνας μένουν χρόνια στο ίδιο ζώδιο και είναι ίδιοι για όλη μια γενιά: ΠΟΤΕ μην τους παρουσιάζεις ως κάτι προσωπικό ή μοναδικό, ούτε το ότι είναι στο ίδιο ζώδιο στους δύο χάρτες ως ξεχωριστό δεσμό. Τον χαρακτήρα και το δέσιμο τα στηρίζεις στον Ήλιο, τη Σελήνη, την Αφροδίτη, τον Άρη, τον Ερμή, τον Ωροσκόπο και τους Δεσμούς της Σελήνης.
Μην επαναλαμβάνεις την ίδια φράση ή ιδέα δύο φορές. Μη χρησιμοποιείς παύλες ή σύμβολα όπως βελάκια.`;

// Πραγματικές ημερομηνίες για ερωτήσεις «πότε».
function sky(p, chart1, chart2) {
  return `\n\n${skyBlock(p, { chart1, chart2 }, hasTime(p.tob1))}
Αν η απάντηση χρειάζεται χρόνο («πότε»), δώσε περίοδο ΜΟΝΟ με ημερομηνίες από την παραπάνω λίστα και πες ποια κίνηση την ανοίγει. Μη γράψεις καμία ημερομηνία ή κίνηση πλανήτη που δεν υπάρχει στη λίστα.`;
}

module.exports = { tz, check, forPrompt, RULES, sky, hasTime };
