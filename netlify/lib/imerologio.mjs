// «Οι καλές σου μέρες του 2027»: προσωπικό ημερολόγιο της χρονιάς από τον γενέθλιο χάρτη.
// Υπολογίζεται ολόκληρο με κώδικα (astronomy-engine), χωρίς τεχνητή νοημοσύνη και χωρίς εξωτερική υπηρεσία:
// για κάθε μέρα κοιτάμε πού περνούν η Σελήνη και οι γρήγοροι πλανήτες σε σχέση με τα σημεία του χάρτη της.
// Κάθε μήνας δίνει μέρες για αγάπη, χρήματα, αποφάσεις και μέρες προσοχής, με τον λόγο για την καθεμία.

import Astronomy from "./vendor/astronomy.cjs";
import makeSky from "./sky.cjs";
import placeLib from "./place.cjs";
import localChartLib from "./local-chart.cjs";
const { zoneOffset, moonChangesSign } = makeSky(Astronomy);
const { localChart } = localChartLib;

export const YEAR = 2027;
export const TOOL = "imerologio";

// Τιμή: 29,99€, και 14,99€ για τη Black Friday (27 έως 30 Νοεμβρίου 2026, ώρα Ελλάδας).
export function priceNow(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const bf = day >= "2026-11-27" && day <= "2026-11-30";
  return { cents: bf ? 1499 : 2999, regular: 2999, bf };
}

const norm = (x) => ((x % 360) + 360) % 360;
const norm180 = (x) => { x = norm(x); return x > 180 ? x - 360 : x; };
const lonOf = (body, date) => norm(Astronomy.Ecliptic(Astronomy.GeoVector(body, date, true)).elon);

/* ---------- Τα σημεία του χάρτης της ---------- */

export async function natalPoints(p) {
  const found = p.pob ? await placeLib.resolvePlace(p.pob).catch(() => null) : null;
  const place = found
    ? { lat: found.lat, lon: found.lon, tzName: found.tzName, label: found.name }
    : { lat: 37.9838, lon: 23.7275, tzName: "Europe/Athens", label: "" };
  const [y, m, d] = p.dob.split("-").map(Number);
  const hasTime = /^\d{2}:\d{2}$/.test(p.tob || "");
  const [hh, mm] = hasTime ? p.tob.split(":").map(Number) : [12, 0];
  const c = localChart({ year: y, month: m, day: d, hour: hh, min: mm, lat: place.lat, lon: place.lon, tzone: zoneOffset(place.tzName, y, m, d, hh, mm) });
  const at = (n) => { const pl = c.planets.find(x => x.name === n); return pl ? +pl.full_degree : null; };
  const pts = { Sun: at("Sun"), Mercury: at("Mercury"), Venus: at("Venus"), Mars: at("Mars"), Jupiter: at("Jupiter"), Saturn: at("Saturn") };
  // Χωρίς ώρα γέννησης η Σελήνη μπορεί να απέχει μερικές μοίρες: την κρατάμε μόνο αν η ώρα είναι γνωστή.
  if (hasTime) pts.Moon = at("Moon");
  if (hasTime && Number.isFinite(+c.ascendant)) pts.Asc = norm(+c.ascendant);
  return { pts, hasTime, placeFound: !!found, placeLabel: place.label, moonUnsure: !hasTime && moonChangesSign(p.dob, place.tzName) };
}

/* ---------- Οι κανόνες ---------- */

const SOFT = [0, 60, -60, 120, -120];      // ένωση, εξάγωνο, τρίγωνο: ροή
const HARD = [90, -90, 180];               // τετράγωνο, αντίθεση: ένταση
const HARD_CONJ = [0, 90, -90, 180];       // με τον Κρόνο και τον Άρη και η ένωση βαραίνει

// Πέρασε η Σελήνη μέσα σε αυτή τη μέρα ακριβώς από μια όψη με το σημείο;
function moonHits(m0, m1, natal, angles) {
  for (const a of angles) {
    const t = norm(natal + a);
    const d0 = norm180(m0 - t), d1 = norm180(m1 - t);
    if (d0 <= 0 && d1 > 0 && d1 - d0 < 30) return true;
  }
  return false;
}
// Είναι ένας πλανήτης του ουρανού σε όψη με το σημείο, μέσα σε μικρό περιθώριο;
function within(lon, natal, angles, orb) {
  return angles.some(a => Math.abs(norm180(lon - norm(natal + a))) <= orb);
}

// Οι λόγοι, σε απλά λόγια. Κάθε κατηγορία κρατά τον πιο δυνατό λόγο της μέρας.
const R = {
  moonVenus: [
    "Η Σελήνη αγγίζει την Αφροδίτη του χάρτη σου. Η καρδιά ανοίγει και τα τρυφερά λόγια βρίσκουν τον δρόμο τους.",
    "Η Σελήνη περνά αρμονικά από την Αφροδίτη σου. Ένα μήνυμα ή μια συνάντηση φέρνει χαμόγελο.",
    "Η Σελήνη ζεσταίνει την Αφροδίτη του χάρτη σου. Μέρα για να δείξεις αυτό που νιώθεις."
  ],
  venusSun: "Η Αφροδίτη του ουρανού στέκεται αρμονικά απέναντι στον Ήλιο σου. Σε βλέπουν όμορφα και η αγάπη έρχεται πιο εύκολα.",
  venusMoon: "Η Αφροδίτη του ουρανού χαϊδεύει τη Σελήνη σου. Μέρα για αγκαλιές, συμφιλίωση και ζεστασιά στο σπίτι.",
  venusVenus: "Η Αφροδίτη του ουρανού συναντά τη δική σου. Η γοητεία σου είναι στο πιο δυνατό της σημείο.",
  venusAsc: "Η Αφροδίτη του ουρανού φωτίζει τον Ωροσκόπο σου. Αφήνεις όμορφη εντύπωση από την πρώτη ματιά.",
  moonMoon: "Η Σελήνη γυρίζει σε αρμονία με τη δική σου. Νιώθεις ήρεμα και οι δικοί σου άνθρωποι σε καταλαβαίνουν.",
  moonMarsSoft: "Η Σελήνη ζεσταίνει τον Άρη σου. Το πάθος και η τόλμη στην αγάπη ξυπνούν.",
  moonJup: [
    "Η Σελήνη συναντά τον Δία του χάρτη σου, τον πλανήτη της τύχης. Μέρα με αισιοδοξία και καλή διάθεση. Νιώθεις ότι η τύχη είναι μαζί σου.",
    "Η Σελήνη ενώνεται αρμονικά με τον Δία σου. Η μέρα έχει μια αίσθηση αφθονίας και σιγουριάς.",
    "Η Σελήνη φωτίζει τον Δία του χάρτη σου. Μέρα που σου δίνει αυτοπεποίθηση και καθαρό βλέμμα."
  ],
  venusJup: "Η Αφροδίτη του ουρανού δένει με τον Δία σου. Η μέρα φέρνει γενναιοδωρία, μικρές χαρές και ευχάριστα νέα.",
  jupSun: "Ο Δίας του ουρανού στέκεται δίπλα στον Ήλιο σου. Ό,τι ξεκινάς τώρα έχει τον άνεμο στην πλάτη του.",
  jupVenus: "Ο Δίας του ουρανού ευλογεί την Αφροδίτη σου. Περίοδος για απολαύσεις και μικρές χαρές.",
  jupJup: "Ο Δίας ξαναβρίσκει τον Δία του χάρτη σου. Ανοίγει ένας νέος κύκλος τύχης.",
  moonVenusMoney: "Η Σελήνη αγγίζει την Αφροδίτη σου. Μέρα για να φροντίσεις τον εαυτό σου.",
  moonSun: [
    "Η Σελήνη δυναμώνει τον Ήλιο σου. Το μυαλό είναι καθαρό και η φωνή σου ακούγεται.",
    "Η Σελήνη στέκεται αρμονικά με τον Ήλιο σου. Ό,τι αποφασίσεις σήμερα έχει γερές βάσεις.",
    "Η Σελήνη δίνει φως στον Ήλιο του χάρτη σου. Καλή μέρα για να ξεκινήσεις κάτι καινούργιο."
  ],
  marsSun: "Ο Άρης του ουρανού δίνει δύναμη στον Ήλιο σου. Μέρα για να κάνεις το βήμα που αναβάλλεις.",
  mercSun: "Ο Ερμής του ουρανού δουλεύει μαζί με τον Ήλιο σου. Τα λόγια σου βγαίνουν καθαρά και σε καταλαβαίνουν.",
  mercMerc: "Ο Ερμής του ουρανού συμφωνεί με τον δικό σου. Οι κουβέντες κυλούν εύκολα και βγάζουν άκρη.",
  moonSaturn: [
    "Η Σελήνη περνά από τον Κρόνο του χάρτη σου. Μέρα για υπομονή και ξεκούραση, όχι για μεγάλα βήματα.",
    "Η Σελήνη συναντά τον Κρόνο σου με ένταση. Η μέρα κυλά πιο αργά, μην την φορτώσεις.",
    "Η Σελήνη πιέζει τον Κρόνο του χάρτη σου. Άφησε τις σημαντικές αποφάσεις για αύριο."
  ],
  moonSunHard: "Η Σελήνη έρχεται σε ένταση με τον Ήλιο σου. Η κούραση φέρνει παρεξηγήσεις, άφησε τις δύσκολες κουβέντες για άλλη μέρα.",
  moonMoonHard: "Η Σελήνη έρχεται σε ένταση με τη δική σου. Τα συναισθήματα ανεβαίνουν, μην αποφασίσεις με θυμό.",
  moonMarsHard: "Η Σελήνη ξυπνά τον Άρη σου με ένταση. Τα νεύρα είναι πιο εύκολα και η υπομονή πιο λίγη.",
  marsSunHard: "Ο Άρης του ουρανού πιέζει τον Ήλιο σου. Η μέρα έχει ένταση και τα νεύρα ανεβαίνουν εύκολα.",
  marsMoonHard: "Ο Άρης του ουρανού πιέζει τη Σελήνη σου. Το σπίτι και τα νεύρα θέλουν προσοχή.",
  mercRetro: "Ο Ερμής είναι ανάδρομος. Μέρα για να ξανασκεφτείς. Οι παρεξηγήσεις και οι καθυστερήσεις είναι πιο συχνές."
};

function addScore(day, cat, pts, reason) {
  // Όπου υπάρχουν πολλές διατυπώσεις, η μέρα του μήνα διαλέγει μία, ώστε να μην επαναλαμβάνεται η ίδια φράση.
  if (Array.isArray(reason)) reason = reason[day.d % reason.length];
  day[cat] = (day[cat] || 0) + pts;
  if (reason && (!day.why[cat] || pts > day.whyPts[cat])) { day.why[cat] = reason; day.whyPts[cat] = pts; }
}

export function scoreDay(y, m, d, N) {
  // Η μέρα ορίζεται σε ώρα Ελλάδας: από τα μεσάνυχτα ως τα επόμενα μεσάνυχτα.
  const off = zoneOffset("Europe/Athens", y, m, d, 12, 0);
  const t0 = new Date(Date.UTC(y, m - 1, d, 0, 0) - off * 3600000);
  const t1 = new Date(t0.getTime() + 86400000);
  const noon = new Date(t0.getTime() + 43200000);
  const day = { d, why: {}, whyPts: {} };
  const m0 = lonOf("Moon", t0), m1 = lonOf("Moon", t1);
  const sky = {
    Sun: lonOf("Sun", noon), Mercury: lonOf("Mercury", noon), Venus: lonOf("Venus", noon),
    Mars: lonOf("Mars", noon), Jupiter: lonOf("Jupiter", noon)
  };
  const mercRetro = norm180(sky.Mercury - lonOf("Mercury", t0)) < 0;
  const moon = (natal, angles) => natal != null && moonHits(m0, m1, natal, angles);
  const tr = (planet, natal, angles, orb) => natal != null && within(sky[planet], natal, angles, orb);

  // Αγάπη
  if (moon(N.Venus, SOFT)) addScore(day, "love", 3, R.moonVenus);
  if (tr("Venus", N.Sun, SOFT, 1.5)) addScore(day, "love", 3, R.venusSun);
  if (tr("Venus", N.Moon, SOFT, 1.5)) addScore(day, "love", 3, R.venusMoon);
  if (tr("Venus", N.Venus, SOFT, 1.5)) addScore(day, "love", 3, R.venusVenus);
  if (tr("Venus", N.Asc, [0], 1.5)) addScore(day, "love", 2, R.venusAsc);
  if (moon(N.Moon, SOFT)) addScore(day, "love", 1, R.moonMoon);
  if (moon(N.Mars, [60, -60, 120, -120])) addScore(day, "love", 1, R.moonMarsSoft);

  // Χρήματα
  if (moon(N.Jupiter, SOFT)) addScore(day, "money", 3, R.moonJup);
  if (tr("Venus", N.Jupiter, SOFT, 1.5)) addScore(day, "money", 2, R.venusJup);
  if (tr("Jupiter", N.Sun, SOFT, 1)) addScore(day, "money", 2, R.jupSun);
  if (tr("Jupiter", N.Venus, SOFT, 1)) addScore(day, "money", 2, R.jupVenus);
  if (tr("Jupiter", N.Jupiter, [0], 1)) addScore(day, "money", 2, R.jupJup);
  if (moon(N.Venus, [60, -60, 120, -120])) addScore(day, "money", 1, R.moonVenusMoney);
  if (mercRetro) addScore(day, "money", -2, null);

  // Αποφάσεις και νέα ξεκινήματα
  if (moon(N.Sun, SOFT)) addScore(day, "dec", 3, R.moonSun);
  if (tr("Mars", N.Sun, SOFT, 1.5)) addScore(day, "dec", 2, R.marsSun);
  if (tr("Mercury", N.Sun, SOFT, 1)) addScore(day, "dec", 1, R.mercSun);
  if (tr("Mercury", N.Mercury, SOFT, 1)) addScore(day, "dec", 1, R.mercMerc);
  if (mercRetro) addScore(day, "dec", -3, null);

  // Προσοχή
  if (moon(N.Saturn, HARD_CONJ)) addScore(day, "avoid", 3, R.moonSaturn);
  if (moon(N.Sun, HARD)) addScore(day, "avoid", 2, R.moonSunHard);
  if (moon(N.Moon, HARD)) addScore(day, "avoid", 2, R.moonMoonHard);
  if (moon(N.Mars, HARD_CONJ)) addScore(day, "avoid", 1, R.moonMarsHard);
  if (tr("Mars", N.Sun, HARD_CONJ, 1.5)) addScore(day, "avoid", 2, R.marsSunHard);
  if (tr("Mars", N.Moon, HARD_CONJ, 1.5)) addScore(day, "avoid", 2, R.marsMoonHard);

  // Γενέθλια: ο Ήλιος του ουρανού γυρίζει στη θέση του Ήλιου της γέννησής της.
  const sunNow = lonOf("Sun", t0), sunNext = lonOf("Sun", t1);
  if (N.Sun != null && norm180(sunNow - N.Sun) <= 0 && norm180(sunNext - N.Sun) > 0) day.birthday = true;
  day.mercRetro = mercRetro;
  return day;
}

/* ---------- Επιλογή των ημερών του μήνα ---------- */

const pick = (days, cat, n, min, exclude) => days
  .filter(x => (x[cat] || 0) >= min && !exclude.has(x.d))
  .sort((a, b) => (b[cat] - a[cat]) || (a.d - b.d))
  .slice(0, n)
  .map(x => x.d)
  .sort((a, b) => a - b);

// Το μοτίβο του μήνα, με τρεις διαφορετικές διατυπώσεις ανά θέμα, ώστε να μην επαναλαμβάνεται.
const THEMES = {
  love: [
    "Μήνας της καρδιάς. Οι σχέσεις σου έχουν τον πρώτο λόγο και οι καλές μέρες για αγάπη είναι πολλές.",
    "Η αγάπη κινείται αυτόν τον μήνα. Μια κουβέντα, μια συνάντηση ή μια συμφιλίωση βρίσκει τη στιγμή της.",
    "Μήνας τρυφερότητας. Δώσε χρόνο στους ανθρώπους που αγαπάς, γιατί σου τον επιστρέφουν διπλό."
  ],
  money: [
    "Μήνας που φέρνει αισιοδοξία. Οι μέρες του Δία έχουν μια αίσθηση τύχης και αφθονίας.",
    "Μήνας με θετική ενέργεια. Οι καλές μέρες σου δίνουν σιγουριά και κέφι.",
    "Μήνας που ανταμείβει τον κόπο σου. Μια οικονομική εκκρεμότητα βρίσκει λύση."
  ],
  dec: [
    "Μήνας για αποφάσεις. Το μυαλό σου είναι καθαρό και τα βήματα που κάνεις τώρα κρατούν.",
    "Μήνας για νέα ξεκινήματα. Ό,τι αναβάλλεις καιρό, τώρα βρίσκει τη στιγμή του.",
    "Η φωνή σου ακούγεται αυτόν τον μήνα. Καλή περίοδος για να πεις αυτό που θέλεις και να το ζητήσεις."
  ],
  avoid: [
    "Μήνας υπομονής. Πήγαινε με μικρά βήματα και φύλαξε τις δυνάμεις σου για τις καλές μέρες.",
    "Ο μήνας ζητά ηρεμία. Οι δύσκολες μέρες περνούν γρήγορα αν δεν τις φορτώσεις με μεγάλες αποφάσεις.",
    "Μήνας για ξεκαθάρισμα. Ό,τι σε κουράζει φεύγει, για να έρθει κάτι καλύτερο."
  ]
};

function monthOf(y, m, N) {
  const len = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = [];
  for (let d = 1; d <= len; d++) days.push(scoreDay(y, m, d, N));

  const avoid = new Set(pick(days, "avoid", 3, 3, new Set()));
  const love = pick(days, "love", 4, 3, avoid);
  const money = pick(days, "money", 3, 3, avoid);
  const dec = pick(days, "dec", 3, 3, avoid);
  // Αν ένας μήνας δεν έχει αρκετές πολύ καλές μέρες, συμπληρώνουμε με τις αμέσως επόμενες.
  const fill = (list, cat, n) => list.length >= 2 ? list : pick(days, cat, n, 2, avoid);
  const L = fill(love, "love", 3), M = fill(money, "money", 3), D = fill(dec, "dec", 3);

  const marks = {};
  const mark = (d, cat) => {
    const x = days[d - 1];
    marks[d] = marks[d] || { d, cats: [], why: {} };
    marks[d].cats.push(cat);
    marks[d].why[cat] = x.why[cat] || "";
  };
  L.forEach(d => mark(d, "love")); M.forEach(d => mark(d, "money")); D.forEach(d => mark(d, "dec"));
  [...avoid].sort((a, b) => a - b).forEach(d => mark(d, "avoid"));

  // Η καλύτερη μέρα του μήνα: η πιο δυνατή από τις καλές.
  let best = null, bestScore = -1;
  for (const d of new Set([...L, ...M, ...D])) {
    const x = days[d - 1];
    const s = Math.max(0, x.love || 0) + Math.max(0, x.money || 0) + Math.max(0, x.dec || 0);
    if (s > bestScore) { bestScore = s; best = d; }
  }

  // Περίοδοι ανάδρομου Ερμή μέσα στον μήνα.
  const retro = [];
  for (const x of days) {
    if (!x.mercRetro) continue;
    const lastR = retro[retro.length - 1];
    if (lastR && lastR[1] === x.d - 1) lastR[1] = x.d; else retro.push([x.d, x.d]);
  }
  const birthday = (days.find(x => x.birthday) || {}).d || null;

  // Το θέμα του μήνα: η κατηγορία με το μεγαλύτερο σύνολο θετικών βαθμών.
  const sum = (cat) => days.reduce((a, x) => a + Math.max(0, x[cat] || 0), 0);
  // Η αγάπη έχει περισσότερους δείκτες από τα άλλα θέματα, γι' αυτό μετρά λίγο λιγότερο.
  const totals = { love: sum("love") * 0.7, money: sum("money"), dec: sum("dec") * 1.1, avoid: sum("avoid") * 0.6 };
  const theme = Object.keys(totals).sort((a, b) => totals[b] - totals[a])[0];
  const summary = THEMES[theme][(m + theme.length) % 3];

  return { m, len, summary, theme, best, birthday, retro, marks: Object.values(marks).sort((a, b) => a.d - b.d) };
}

export function computeYear(N, year = YEAR) {
  const months = [];
  for (let m = 1; m <= 12; m++) months.push(monthOf(year, m, N));
  return months;
}

export const MERC_RETRO_TEXT = R.mercRetro;

/* ---------- Η πιο τυχερή μέρα της εβδομάδας που έρχεται (δώρο με κάθε πληρωμένο χρησμό) ---------- */

const DAYS_GR = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
const MONTHS_GEN = ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"];
const LUCKY_CALM = "Η πιο ήρεμη και καθαρή μέρα της εβδομάδας για σένα. Κράτα την για ό,τι σημαντικό θέλεις να κάνεις ή να πεις.";

// Ψάχνει τις 7 μέρες μετά από τη μέρα της πληρωμής (σε ώρα Ελλάδας) και κρατά την πιο δυνατή καλή μέρα.
export function luckyWeek(N, from = new Date()) {
  const ath = new Date(from.toLocaleString("en-US", { timeZone: "Europe/Athens" }));
  let best = null;
  for (let i = 1; i <= 7; i++) {
    const dt = new Date(Date.UTC(ath.getFullYear(), ath.getMonth(), ath.getDate() + i));
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
    const x = scoreDay(y, m, d, N);
    if ((x.avoid || 0) >= 3) continue;
    const cats = ["love", "money", "dec"].map(c => [c, Math.max(0, x[c] || 0)]).sort((a, b) => b[1] - a[1]);
    const score = cats.reduce((a, c) => a + c[1], 0) - (x.avoid || 0);
    if (!best || score > best.score) best = { score, y, m, d, wd: dt.getUTCDay(), cat: cats[0][1] > 0 ? cats[0][0] : null, why: cats[0][1] > 0 ? (x.why[cats[0][0]] || "") : "" };
  }
  if (!best) return null;
  return {
    date: `${best.y}-${String(best.m).padStart(2, "0")}-${String(best.d).padStart(2, "0")}`,
    label: `${DAYS_GR[best.wd]} ${best.d} ${MONTHS_GEN[best.m - 1]}`,
    cat: best.cat,
    why: best.why || LUCKY_CALM
  };
}
