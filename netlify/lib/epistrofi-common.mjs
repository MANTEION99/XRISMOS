// Κοινός κώδικας για τον δωρεάν και τον πληρωμένο χρησμό της «Επιστροφής της Χαμένης Αγάπης».
// Δεν είναι function από μόνο του: το εισάγουν τα epistrofi-teaser.mjs και epistrofi-full.mjs.

import { getStore } from "@netlify/blobs";
import Astronomy from "./vendor/astronomy.cjs";
import makeSky from "./sky.cjs";
const sky = makeSky(Astronomy);
const { zoneOffset, moonChangesSign } = sky;
import placeLib from "./place.cjs";
export const skyBlock = sky.skyBlock;

export const MODEL = "claude-sonnet-5";
// Εφεδρικό μοντέλο, αν το βασικό είναι υπερφορτωμένο ή απαντά με σφάλμα.
export const FALLBACK_MODEL = "claude-sonnet-4-6";

// Ένα «ντουλάπι» για τους χρησμούς και ένα για τα email που πήραν ήδη δωρεάν δείγμα.
export const readingsStore = () => getStore({ name: "epistrofi-readings", consistency: "strong" });
export const emailsStore = () => getStore({ name: "free-teaser-emails", consistency: "strong" });

export function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// Τόπος γέννησης: πραγματικές συντεταγμένες και ζώνη ώρας. Αν δεν βρεθεί, Αθήνα και ώρα Ελλάδας.
async function birthPlace(pob) {
  const found = pob ? await placeLib.resolvePlace(pob).catch(() => null) : null;
  return found
    ? { lat: found.lat, lon: found.lon, tzName: found.tzName, label: `${found.name} ${found.country}`, found: true }
    : { lat: 37.9838, lon: 23.7275, tzName: "Europe/Athens", label: "Αθήνα (προεπιλογή)", found: false };
}

// Το input type="date" στέλνει πάντα YYYY-MM-DD.
function chartBody(dob, tob, place) {
  const [year, month, day] = String(dob).split("-").map(n => parseInt(n, 10));
  let [hour, min] = String(tob || "12:00").split(":").map(n => parseInt(n, 10));
  if (!Number.isFinite(hour)) hour = 12;
  if (!Number.isFinite(min)) min = 0;
  return {
    day, month, year, hour, min,
    lat: place.lat,
    lon: place.lon,
    // Σωστή διαφορά ώρας για τον τόπο και την ημερομηνία γέννησης (θερινή ώρα, ιστορικές αλλαγές).
    tzone: zoneOffset(place.tzName, year, month, day, hour, min),
    house_type: "placidus"
  };
}

async function fetchChart(body) {
  const res = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": "en",
        "x-astrologyapi-key": process.env.ASTROLOGY_API_KEY
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  // Ένας σωστός χάρτης έχει πάντα λίστα πλανητών. Αλλιώς το AstrologyAPI απάντησε με σφάλμα
  // (κλειδί, όριο, λάθος στοιχεία) και ΔΕΝ αφήνουμε το Claude να γράψει χρησμό χωρίς χάρτη.
  if (!res.ok || !data || !Array.isArray(data.planets) || data.planets.length === 0) {
    console.error(`[astrologyapi] status=${res.status} key=${process.env.ASTROLOGY_API_KEY ? "set" : "MISSING"} body=${text.slice(0, 300)}`);
    throw new Error("Ο χάρτης δεν υπολογίστηκε");
  }
  return data;
}

// Υπολογίζει τους δύο χάρτες μία φορά. Το αποτέλεσμα αποθηκεύεται μαζί με τον χρησμό,
// ώστε η πληρωμένη συνέχεια να μη χρειάζεται νέα κλήση στο AstrologyAPI.
export async function computeCharts(p) {
  const [place1, place2] = await Promise.all([birthPlace(p.pob1), birthPlace(p.pob2)]);
  const [chart1, chart2] = await Promise.all([
    fetchChart(chartBody(p.dob1, p.tob1, place1)),
    p.dob2 ? fetchChart(chartBody(p.dob2, p.tob2, place2)) : Promise.resolve(null)
  ]);
  console.log(`[place] 1="${p.pob1 || ""}" -> ${place1.label} | 2="${p.pob2 || ""}" -> ${place2.label}`);
  return { chart1, chart2, tz1: place1.tzName, tz2: place2.tzName, place1: place1.label, place2: place2.label };
}

// Χωρίς ώρα γέννησης οι οίκοι και ο Ωροσκόπος βγαίνουν λάθος (υπολογίζονται για τις 12:00),
// οπότε τους αφαιρούμε εντελώς για να μην τους χρησιμοποιήσει ο χρησμός.
export function chartForPrompt(chart, hasTime, moonUnsure) {
  if (!chart || hasTime) return chart;
  const { houses, ascendant, midheaven, vertex, aspects, ...rest } = chart;
  return {
    ...rest,
    planets: (chart.planets || [])
      .filter(pl => !/ascendant|midheaven/i.test(pl.name || ""))
      .filter(pl => !(moonUnsure && pl.name === "Moon"))
      .map(({ house, ...pl }) => pl),
    aspects: (aspects || []).filter(a => !moonUnsure || !/moon/i.test(`${a.aspecting_planet} ${a.aspected_planet}`))
  };
}

// Ενήλικας (18+) με βάση την ημερομηνία γέννησης ΕΕΕΕ-ΜΜ-ΗΗ, ώρα Ελλάδας.
export function isAdult(dob, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob || ""));
  if (!m) return true;
  const today = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Athens" }));
  let age = today.getFullYear() - +m[1];
  if (today.getMonth() + 1 < +m[2] || (today.getMonth() + 1 === +m[2] && today.getDate() < +m[3])) age--;
  return age >= 18;
}
export const ADULTS_ONLY = "Το Μαντείο απευθύνεται μόνο σε ενήλικες (18+).";

export const timeNote = (name, hasTime, moonUnsure) => hasTime
  ? ""
  : `\n(Για ${name} δεν δόθηκε ώρα γέννησης: ΜΗΝ αναφέρεις οίκους ούτε Ωροσκόπο. Μίλα μόνο για πλανήτες σε ζώδια και τις όψεις τους.` +
    (moonUnsure ? ` Η Σελήνη άλλαξε ζώδιο τη μέρα που γεννήθηκε, οπότε ΜΗΝ αναφέρεις καθόλου τη Σελήνη για ${name}.` : "") + `)`;

export function chartsBlock(p, charts) {
  const t1 = /^\d{2}:\d{2}$/.test(p.tob1 || "");
  const t2 = /^\d{2}:\d{2}$/.test(p.tob2 || "");
  const m1 = !t1 && moonChangesSign(p.dob1, charts.tz1);
  const m2 = !t2 && moonChangesSign(p.dob2, charts.tz2);
  return `Στοιχεία ${p.name1}:${timeNote(p.name1, t1, m1)}
${JSON.stringify(chartForPrompt(charts.chart1, t1, m1))}

Στοιχεία ${p.name2}:${charts.chart2 ? timeNote(p.name2, t2, m2) : ""}
${charts.chart2 ? JSON.stringify(chartForPrompt(charts.chart2, t2, m2)) : "Δεν δόθηκε ημερομηνία γέννησης. Μίλα για αυτό το πρόσωπο μέσα από τον χάρτη του/της " + p.name1 + " (Αφροδίτη, Άρης, Σελήνη, Δεσμοί της Σελήνης" + (t1 ? ", 5ος, 7ος, 8ος οίκος" : "") + ")."}`;
}

const VOICE = `Είσαι ο Ιάκωβος, ο αστρολόγος του «Μαντείου». Έμπειρος, ζεστός, σοβαρός, με βαθιά γνώση. Το κοινό σου είναι κυρίως γυναίκες 50 έως 65 ετών στην Ελλάδα. Γράφεις στα ελληνικά, σε απλή και τρυφερή γλώσσα, με σύντομες προτάσεις.
Χρησιμοποιείς ΜΟΝΟ τα πραγματικά αστρολογικά δεδομένα που σου δίνονται. Δεν εφευρίσκεις θέσεις πλανητών.
Κάθε φορά που αναφέρεις αστρολογικό όρο, τον εξηγείς αμέσως σε καθημερινή γλώσσα μέσα στην ίδια πρόταση.
ΑΠΑΓΟΡΕΥΟΝΤΑΙ: οι λέξεις «ίσως» και «μπορεί» όταν προβλέπεις τι θα γίνει (εκεί μιλάς με βεβαιότητα: «θα», «έρχεται», «δείχνει»· επιτρέπονται μόνο σε φράση που παρηγορεί, π.χ. «μια σιωπή μπορεί να είναι απλώς καθυστέρηση»), οι γενικόλογες φράσεις που ταιριάζουν σε όλους, οι ιατρικές οδηγίες, οι παύλες και τα σύμβολα όπως βελάκια. Γράφεις σε καθαρό, ανθρώπινο λόγο.
Δεν γράφεις την ίδια περιγραφή δύο φορές (π.χ. τι σημαίνει ένας οίκος ή ένας πλανήτης): την εξηγείς μία φορά και μετά απλώς την ονομάζεις.
Κάθε πρόταση λέει ένα πράγμα, με καθαρή σύνταξη που διαβάζεται με την πρώτη. Αν μια πρόταση χρειάζεται δεύτερη ανάγνωση, τη χωρίζεις σε δύο.
Αν δίνεις ποσοστό, ο τόνος του κειμένου συμφωνεί μαζί του: κάτω από 40% μιλάς για δρόμο με εμπόδια αλλά με ελπίδα, 40 έως 70% για πραγματική πιθανότητα που θέλει τη σωστή στιγμή, πάνω από 70% με σιγουριά.
Δεν αναφέρεις ποτέ πληρωμή, τιμή, συνδρομή ή «ξεκλείδωμα».
Τα ονόματα τα γράφεις πάντα σωστά στα ελληνικά με κεφαλαίο το πρώτο γράμμα. Αν είναι γραμμένα με λατινικούς χαρακτήρες (π.χ. maria, giorgos), τα γράφεις στα ελληνικά (Μαρία, Γιώργος).
Γράφεις σε άψογα, φυσικά ελληνικά, χωρίς γραμματικά λάθη.
Ο Ουρανός, ο Ποσειδώνας και ο Πλούτωνας μένουν χρόνια στο ίδιο ζώδιο και είναι ίδιοι για όλη μια γενιά: ΠΟΤΕ μην τους παρουσιάζεις ως κάτι προσωπικό ή μοναδικό, ούτε μέσα από τις όψεις τους με πλανήτες του άλλου προσώπου (π.χ. «ο Ερμής σου δεμένος με τον Ουρανό του»), ούτε το ότι είναι στο ίδιο ζώδιο στους δύο χάρτες ως ξεχωριστό δεσμό. Τον χαρακτήρα και το δέσιμο τα στηρίζεις στον Ήλιο, τη Σελήνη, την Αφροδίτη, τον Άρη, τον Ερμή, τον Ωροσκόπο και τους Δεσμούς της Σελήνης.
Μένεις στο θέμα της αγάπης και της σχέσης. Δεν μιλάς για καριέρα ή επαγγελματικό δρόμο.
Δεν επαναλαμβάνεις την ίδια φράση ή ιδέα δύο φορές.
ΦΥΛΟ: Κατάλαβε από τα ελληνικά ονόματα το φύλο του ατόμου που ρωτά και του άλλου προσώπου (π.χ. Γιώργος, Νίκος: άντρας, Μαρία, Ελένη: γυναίκα). Γράψε με το σωστό γραμματικό γένος για τον καθένα, σε όλο το κείμενο. Ο αναγνώστης μπορεί να είναι άντρας, και το άλλο πρόσωπο μπορεί να είναι του ίδιου φύλου. Οι οδηγίες εδώ είναι γραμμένες στο θηλυκό μόνο για συντομία: αν ρωτά άντρας, του μιλάς στο αρσενικό («καλέ μου», «σε βρίσκει καλά», «ο πόνος σου για αυτήν»). Αν το φύλο δεν φαίνεται από το όνομα, γράφεις με τρόπο που ταιριάζει και στα δύο.`;

export function teaserPrompt(p, charts) {
  return `${VOICE}

${chartsBlock(p, charts)}

Ο/Η ${p.name1} ρωτά αν και πότε θα επιστρέψει στη ζωή του/της ο/η ${p.name2}.

Γράψε ΜΟΝΟ το άνοιγμα του χρησμού, 140 έως 170 λέξεις και ΠΟΤΕ πάνω από 180. Κάθε πρόταση να κερδίζει τη θέση της, χωρίς φλυαρία. Ο σκοπός του είναι να την πλησιάσει, να την αγγίξει και να νιώσει ότι κάποιος επιτέλους την καταλαβαίνει.
1. Ξεκίνα με προσωπικό χαιρετισμό με το όνομά της, π.χ. «Γεια σου ${p.name1} μου, εύχομαι η σημερινή μέρα να σε βρίσκει καλά», και συνέχισε αμέσως με το κυρίως κείμενο. Ο χαιρετισμός μόνος του ΔΕΝ είναι απάντηση.
2. Πες της δύο συγκεκριμένα χαρακτηριστικά του χαρακτήρα της, το καθένα δεμένο με μια πραγματική θέση από τον χάρτη της (πλανήτης, ζώδιο, οίκος). Να είναι τόσο ακριβή ώστε να σκεφτεί «με ξέρει».
3. Δείξε ότι βλέπεις τον πόνο της για αυτόν τον άνθρωπο, με μια πρόταση για το δέσιμο που φαίνεται ανάμεσα στους δύο χάρτες.
4. Κλείσε με μια πρόταση που ανοίγει την επόμενη σελίδα χωρίς να τη λέει: ότι ο χάρτης δείχνει καθαρά μια συγκεκριμένη περίοδο και μια κίνηση που θα κρίνει την επιστροφή του/της, και ότι αυτά ακολουθούν αμέσως παρακάτω. Μην πεις ποια είναι η περίοδος, μην πεις το αποτέλεσμα, μην δώσεις ποσοστό.
Το πολύ τρεις αστρολογικοί όροι σε όλο το άνοιγμα, ο καθένας εξηγημένος με απλά λόγια. Ο τόνος να δείχνει απόλυτη επαγγελματική σοβαρότητα και βαθιά γνώση. Ολοκλήρωσε πάντα την τελευταία πρόταση με τελεία.`;
}

export function fullPrompt(p, charts, teaser, sky = "") {
  const opening = teaser
    ? `Ο/Η ${p.name1} έχει ήδη διαβάσει το άνοιγμα του χρησμού του/της, που είναι αυτό:
"""
${teaser}
"""
Γράψε τη ΣΥΝΕΧΕΙΑ του. Μην ξαναχαιρετήσεις, μην επαναλάβεις όσα ειπώθηκαν και μην πεις τίποτα που να έρχεται σε αντίθεση με αυτά. Συνέχισε σαν να γυρίζει απλά η σελίδα.`
    : `Γράψε ολόκληρο τον χρησμό. Ξεκίνα με προσωπικό χαιρετισμό με το όνομά της, π.χ. «Γεια σου ${p.name1} μου, εύχομαι η σημερινή μέρα να σε βρίσκει καλά».`;

  return `${VOICE}

${chartsBlock(p, charts)}

${sky}

Ο/Η ${p.name1} ρωτά αν και πότε θα επιστρέψει στη ζωή του/της ο/η ${p.name2}.

${opening}

Μήκος: 600 έως 800 λέξεις.
ΓΛΩΣΣΑ: Το κείμενο το διαβάζει ένας άνθρωπος, συνήθως γυναίκα 50 έως 65 ετών, που πονά, όχι αστρολόγος. Το συναίσθημα και η εικόνα έρχονται πρώτα, οι όροι δεύτεροι. Το πολύ δύο αστρολογικοί όροι σε κάθε παράγραφο, κάθε όρος εξηγημένος αμέσως με απλά λόγια, και ποτέ λίστα από πλανήτες και οίκους στη σειρά. Διάλεξε τις λίγες πιο δυνατές θέσεις και πες τι σημαίνουν για τη ζωή της, αντί να τις αναφέρεις όλες.
Δομή, σε ρέοντα λόγο χωρίς τίτλους:
1. Οι συνδέσεις ανάμεσα στους δύο χάρτες: καρμικοί δεσμοί (Δεσμοί της Σελήνης), 5ος, 7ος και 8ος οίκος, Αφροδίτη και Άρης του καθενός, και τι λένε για το δέσιμό τους.
2. Παρατηρήσεις συμπεριφοράς: γιατί αυτός ο άνθρωπος φέρθηκε όπως φέρθηκε και τι νιώθει, όπως φαίνεται από τον χάρτη του/της.
3. Η απάντηση με κατεύθυνση: αν υπάρχει δρόμος επιστροφής και ΠΟΤΕ. Δώσε ΔΥΟ χρονικά σημεία, και τα δύο από τον «ΠΡΑΓΜΑΤΙΚΟ ΟΥΡΑΝΟ»: (α) ένα ΠΡΩΤΟ ΣΗΜΑΔΙ μέσα στους επόμενους 1 έως 3 μήνες από σήμερα (μια επαφή ή μια ανάδρομη περίοδος που ξυπνά τη σκέψη, ένα μήνυμα, μια ανάμνηση), ώστε να έχει ελπίδα από τώρα, και (β) την πιο δυνατή περίοδο για την επιστροφή (π.χ. όταν η Αφροδίτη ή ο Δίας αγγίζουν αρμονικά την Αφροδίτη, τη Σελήνη ή τον Δύοντα της, ή τα σημεία του άλλου, ή μια ανάδρομη περίοδος που φέρνει πίσω το παρελθόν) και δώσε την με τις ΑΚΡΙΒΕΙΣ ημερομηνίες της λίστας, λέγοντας ποια κίνηση την ανοίγει. Μη γράψεις καμία ημερομηνία ή κίνηση πλανήτη που δεν υπάρχει στη λίστα. Αυτή είναι η καρδιά του χρησμού και πρέπει να είναι σαφής.
4. Κλείσε θυμίζοντας με τρυφερότητα ότι η τελική έκβαση εξαρτάται και από την ελεύθερη βούληση.

Μορφή απάντησης, ΑΥΣΤΗΡΑ:
Η πρώτη γραμμή είναι ΜΟΝΟ: [ΠΟΣΟΣΤΟ: NN] όπου NN η πιθανότητα επανένωσης από 1 έως 99, συνεπής με όσα γράφεις.
Μετά το κείμενο του χρησμού.
Μετά, σε νέα γραμμή, ακριβώς [ΣΥΜΒΟΥΛΗ] και 2 έως 3 προτάσεις πρακτικής συμβουλής που βγαίνουν από τη συγκεκριμένη ανάλυση, όχι γενικότητες όπως «μίλα ανοιχτά» ή «δώσε χρόνο». Τελείωσε τη συμβουλή με μία πρόταση ότι τα άστρα αλλάζουν κάθε μήνα και η εικόνα τον επόμενο μήνα θα είναι διαφορετική.
Ολοκλήρωσε πάντα κάθε πρόταση. Αν πλησιάζεις το όριο, συντόμευσε νωρίτερα, ποτέ μην κόψεις στη μέση.`;
}

const wordCount = (t) => (t.trim().match(/\S+/g) || []).length;

// Καλεί το Claude με streaming. Κάθε κομμάτι κειμένου πηγαίνει στο onText,
// και στο τέλος επιστρέφεται ολόκληρο το κείμενο.
// Αν η απάντηση σταματήσει πρόωρα (κομμένη ροή, όριο, ή λιγότερες από minWords λέξεις),
// ζητά αυτόματα τη συνέχεια από το σημείο που σταμάτησε, έως δύο φορές, ώστε η πελάτισσα
// να μη δει ποτέ μισό χρησμό.
// Αν η αρχή της συνέχειας επαναλαμβάνει το τέλος του κειμένου που ήδη υπάρχει, την αφαιρεί.
function dropOverlap(prev, next) {
  const tail = prev.slice(-600);
  const n = next.replace(/^\s+/, "");
  for (let len = Math.min(tail.length, n.length); len >= 20; len--) {
    if (tail.endsWith(n.slice(0, len))) return n.slice(len);
  }
  // Επανάληψη ολόκληρης πρότασης που βρίσκεται λίγο πιο πίσω στο τέλος.
  const lastSentence = (tail.match(/[^.!;]+[.!;]\s*$/) || [""])[0].trim();
  if (lastSentence.length >= 20 && n.startsWith(lastSentence)) return n.slice(lastSentence.length);
  return next;
}

function cutToSentence(t) {
  const i = Math.max(t.lastIndexOf("."), t.lastIndexOf("!"), t.lastIndexOf(";"), t.lastIndexOf("]"), t.lastIndexOf("\n"));
  return i > 0 ? t.slice(0, i + 1) : "";
}

// onRewind(κείμενο): αν δοθεί, πριν από κάθε συνέχεια το κείμενο κόβεται στην τελευταία ολόκληρη
// πρόταση (ώστε να μη μείνουν μισές λέξεις όπως «Κρ Κρατάει») και ενημερώνεται ο καλών.
export async function streamClaude(prompt, maxTokens, onText, minWords = 0, prefix = "", onRewind = null) {
  // prefix: κείμενο που έχει ήδη γραφτεί σε προηγούμενη προσπάθεια· συνεχίζουμε από εκεί.
  let full = prefix;
  const diag = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    // Αν η προηγούμενη προσπάθεια απέτυχε με σφάλμα (π.χ. υπερφόρτωση), περιμένουμε λίγο πριν ξαναρωτήσουμε.
    if (attempt > 0 && /error|σφάλμα|cut/.test(diag[diag.length - 1] || "")) {
      await new Promise(r => setTimeout(r, attempt * 5000));
    }
    if (onRewind && full) { full = cutToSentence(full); onRewind(full); }
    const p = (attempt === 0 && !full) ? prompt : `${prompt}

Έχεις ήδη γράψει την αρχή, που είναι αυτή:
"""
${full}
"""
Συνέχισε ΑΚΡΙΒΩΣ από το σημείο που σταματά, με την επόμενη λέξη. Μην επαναλάβεις τίποτα από όσα γράφτηκαν, μην ξαναχαιρετήσεις, μη γράψεις εισαγωγή. Ολοκλήρωσε το κείμενο σύμφωνα με τις οδηγίες.`;
    let chunkStart = true;
    let r;
    // Σε συνέχεια, κρατάμε τους πρώτους χαρακτήρες μέχρι να δούμε αν το Claude ξαναγράφει
    // την τελευταία πρόταση (π.χ. «...παλιά πληγή. ...παλιά πληγή.»), και την κόβουμε.
    const isContinuation = !!full;
    let held = isContinuation ? "" : null;
    const emit = (t) => {
      if (!t) return;
      if (chunkStart && full && !/\s$/.test(full) && !/^[\s.,;:!·»)]/.test(t)) t = " " + t;
      chunkStart = false;
      full += t;
      onText(t);
    };
    const flushHeld = () => { if (held !== null) { const h = dropOverlap(full, held); held = null; emit(h); } };
    try {
      const lastFailed = /error|σφάλμα/.test(diag[diag.length - 1] || "");
      r = await streamClaudeOnce(p, maxTokens, (t) => {
        if (held !== null) { held += t; if (held.length >= 400) flushHeld(); return; }
        emit(t);
      }, lastFailed);
      flushHeld();
    } catch (e) {
      flushHeld();
      diag.push(`#${attempt} σφάλμα ${String(e.message || e).slice(0, 160)}`);
      if (!full) throw new Error(diag.join(" | "));
      console.error("[claude] retry failed", e);
      break;
    }
    const words = wordCount(full);
    console.log(`[claude] attempt=${attempt} stop=${r.stopReason} ended=${r.ended} words=${words}`);
    diag.push(`#${attempt} ${r.stopReason || "-"}${r.detail ? " (" + r.detail + ")" : ""} λέξεις=${words}`);
    // Η ανακατεύθυνση (ερώτηση που δεν απαντιέται) είναι σύντομη από τη φύση της· δεν ζητάμε συνέχεια.
    const isRedirect = /\[\s*ΑΝΑΚΑΤΕΥΘΥΝΣΗ\s*\]/.test(full);
    if (r.ended && r.stopReason === "end_turn" && (words >= minWords || isRedirect)) return full;
    if (r.stopReason === "refusal") break;
  }
  if (!/\[\s*ΑΝΑΚΑΤΕΥΘΥΝΣΗ\s*\]/.test(full) && wordCount(full) < Math.max(20, minWords / 2)) throw new Error("Η απάντηση βγήκε ελλιπής: " + diag.join(" | "));
  return full;
}

async function streamClaudeOnce(prompt, maxTokens, onText, useFallback = false) {
  // Αν το Claude δεν στείλει τίποτα για 50 δευτερόλεπτα, η σύνδεση κόβεται και ζητάμε τη συνέχεια,
  // αντί να περιμένουμε για πάντα μια ροή που κόλλησε.
  const ctl = new AbortController();
  let idle = setTimeout(() => ctl.abort(), 50000);
  const bump = () => { clearTimeout(idle); idle = setTimeout(() => ctl.abort(), 50000); };
  try {
    return await streamClaudeOnceInner(prompt, maxTokens, onText, ctl.signal, bump, useFallback);
  } finally {
    clearTimeout(idle);
  }
}

async function streamClaudeOnceInner(prompt, maxTokens, onText, signal, bump, useFallback) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    signal,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: useFallback ? FALLBACK_MODEL : MODEL,
      max_tokens: maxTokens,
      // Το Claude Sonnet 5 «σκέφτεται» κρυφά από προεπιλογή και η σκέψη τρώει το όριο λέξεων.
      // Εδώ θέλουμε μόνο το κείμενο, γρήγορα: η σκέψη απενεργοποιείται (το εφεδρικό δεν σκέφτεται από μόνο του).
      ...(useFallback ? {} : { thinking: { type: "disabled" } }),
      stream: true,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok || !res.body) {
    throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let stopReason = null;
  let ended = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bump();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        let evt;
        try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (evt.type === "content_block_delta" && evt.delta && evt.delta.type === "text_delta") {
          onText(evt.delta.text);
        } else if (evt.type === "message_delta" && evt.delta && evt.delta.stop_reason) {
          stopReason = evt.delta.stop_reason;
        } else if (evt.type === "message_stop") {
          ended = true;
        } else if (evt.type === "error") {
          console.error("[claude] stream error", JSON.stringify(evt.error));
          return { stopReason: "error", ended: false, detail: `${evt.error && evt.error.type}: ${evt.error && evt.error.message}`.slice(0, 160) };
        }
      }
    }
  } catch (e) {
    // Η ροή κόπηκε στη μέση: ό,τι γράφτηκε μένει και ζητάμε τη συνέχεια.
    console.error("[claude] stream cut", e);
    return { stopReason, ended, detail: "cut: " + (e && e.name) };
  }
  return { stopReason, ended };
}

// Επαληθεύει στο Stripe ότι η πληρωμή έγινε, ότι αφορά αυτό το εργαλείο
// και, όταν δίνεται, ότι αφορά ΑΥΤΟΝ τον συγκεκριμένο χρησμό.
export async function verifyStripeSession(sessionId, tool, readingId) {
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=payment_intent`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    const s = await res.json();
    if (!s.metadata) return null;
    if (s.metadata.tool !== tool) return null;
    if (readingId && s.metadata.reading_id !== readingId) return null;
    // Πληρωμένη: είτε χρεωμένη (paid) είτε με δεσμευμένο ποσό που περιμένει την ολοκλήρωση του χρησμού.
    const pi = s.payment_intent && typeof s.payment_intent === "object" ? s.payment_intent : null;
    const held = pi && pi.status === "requires_capture";
    const captured = pi && pi.status === "succeeded";
    if (s.payment_status !== "paid" && !held && !captured) return null;
    return s;
  } catch {
    return null;
  }
}

async function stripePost(path) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) console.error(`[stripe] ${path} ${res.status} ${JSON.stringify(data.error || {}).slice(0, 200)}`);
  return { ok: res.ok, data };
}

// Οριστική χρέωση, μόνο αφού ο χρησμός γραφτεί ολόκληρος.
export async function capturePayment(session) {
  const pi = session && session.payment_intent;
  const id = pi && (typeof pi === "string" ? pi : pi.id);
  if (!id || (typeof pi === "object" && pi.status !== "requires_capture")) return { ok: true, skipped: true };
  return stripePost(`payment_intents/${id}/capture`);
}

// Ακύρωση της δέσμευσης αν ο χρησμός δεν μπόρεσε να γραφτεί: η πελάτισσα δεν χρεώνεται.
export async function releasePayment(paymentIntentId) {
  if (!paymentIntentId) return { ok: false };
  return stripePost(`payment_intents/${paymentIntentId}/cancel`);
}

export function streamResponse(producer, headers = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const write = (t) => controller.enqueue(encoder.encode(t));
      try {
        await producer(write);
      } catch (e) {
        console.error(e);
        write("\n<<<ΣΦΑΛΜΑ>>>");
      }
      controller.close();
    }
  });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}
export { moonChangesSign };
