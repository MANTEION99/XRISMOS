// «Οι τυχερές μέρες της εβδομάδας»: για κάθε μέρα από Δευτέρα ως Κυριακή συνδυάζονται τρεις μέθοδοι.
//   Αστρολογία: οι θέσεις των πλανητών κάθε μέρας πάνω στον γενέθλιο χάρτη (ίδια μηχανή με το Ημερολόγιο, imerologio.mjs).
//   Αριθμολογία: ο προσωπικός αριθμός της μέρας από την ημερομηνία γέννησης (ίδιος κανόνας με το εργαλείο Αριθμολογίας).
//   Ταρό: ένα χαρτί για κάθε μέρα από την τράπουλα του σάιτ (22 χαρτιά της Μεγάλης Αρκάνας, tarot-deck.mjs).
// Τυχερή μέρα: θετικές και οι τρεις. Καλή μέρα: θετικές οι δύο από τις τρεις.
// Όλα υπολογίζονται με κώδικα, χωρίς τεχνητή νοημοσύνη. Το χαρτί κάθε μέρας βγαίνει πάντα το ίδιο για τα ίδια στοιχεία,
// ώστε όποιος ξανανοίξει τη σελίδα να βλέπει το ίδιο αποτέλεσμα.

import { createHash } from "node:crypto";
import { natalPoints, scoreDay } from "./imerologio.mjs";
import { CARDS } from "./tarot-deck.mjs";

export const TOOL = "tyxeres";
export { natalPoints };

// Τιμή: 2,99€ ως και την Τετάρτη 2 Δεκεμβρίου 2026 (ώρα Ελλάδας), μετά 4,99€.
// Ο ίδιος κανόνας υπάρχει στο create-checkout.js, στο pay-choice.js και στη σελίδα tyxeres-meres.html.
export const EARLY_UNTIL = "2026-12-02";
const athensDay = (now) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
export function priceNow(now = new Date()) {
  const early = athensDay(now) <= EARLY_UNTIL;
  return { cents: early ? 299 : 499, regular: 499, early };
}

const DAYS_GR = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
const MONTHS_GEN = ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"];
const iso = (dt) => dt.toISOString().slice(0, 10);

// Ποια εβδομάδα αγοράζει: από Δευτέρα ως Πέμπτη την τρέχουσα, από Παρασκευή ως Κυριακή αυτή που ξεκινά τη Δευτέρα.
export function weekFor(now = new Date()) {
  const [y, m, d] = athensDay(now).split("-").map(Number);
  const today = new Date(Date.UTC(y, m - 1, d));
  const wd = today.getUTCDay();                      // 0 Κυριακή ... 6 Σάββατο
  const sinceMonday = (wd + 6) % 7;                  // Δευτέρα 0 ... Κυριακή 6
  const next = sinceMonday >= 4;                     // Παρασκευή, Σάββατο, Κυριακή
  const start = new Date(today.getTime() - sinceMonday * 86400000 + (next ? 7 * 86400000 : 0));
  const end = new Date(start.getTime() + 6 * 86400000);
  return { start: iso(start), end: iso(end), next, label: weekLabel(start, end) };
}
function weekLabel(a, b) {
  const da = a.getUTCDate(), db = b.getUTCDate();
  return a.getUTCMonth() === b.getUTCMonth()
    ? `Δευτέρα ${da} έως Κυριακή ${db} ${MONTHS_GEN[b.getUTCMonth()]}`
    : `Δευτέρα ${da} ${MONTHS_GEN[a.getUTCMonth()]} έως Κυριακή ${db} ${MONTHS_GEN[b.getUTCMonth()]}`;
}

/* ---------- Αριθμολογία ---------- */

// Ίδια αναγωγή με το oracle-tools.mjs (χωρίς τους κύριους αριθμούς για Προσωπικό Έτος, Μήνα και Μέρα).
const reduce = (n) => { while (n > 9) n = String(n).split("").reduce((a, c) => a + +c, 0); return n; };
const digits = (n) => String(n).split("").reduce((a, c) => a + +c, 0);
export function personalDay(dob, y, m, d) {
  const [, bm, bd] = String(dob).split("-").map(Number);
  const personalYear = reduce(bd + bm + digits(y));   // ίδιο με το Προσωπικό Έτος του εργαλείου Αριθμολογίας
  return reduce(personalYear + m + d);                 // Προσωπικός Μήνας και Προσωπική Μέρα
}
const NUM_GOOD = new Set([1, 3, 5, 6, 8]);
const NUM_TEXT = {
  1: "Μέρα του ξεκινήματος. Ό,τι αρχίζεις σήμερα έχει δύναμη.",
  2: "Μέρα της υπομονής και της συνεργασίας. Τα πράγματα θέλουν τον χρόνο τους.",
  3: "Μέρα της χαράς και της επικοινωνίας. Οι κουβέντες και οι συναντήσεις κυλούν όμορφα.",
  4: "Μέρα της δουλειάς και της τάξης. Τα πράγματα μπαίνουν στη θέση τους.",
  5: "Μέρα της αλλαγής και της τύχης. Κάτι απρόσμενο ανοίγει δρόμο.",
  6: "Μέρα της αγάπης και του σπιτιού. Οι άνθρωποί σου είναι κοντά σου.",
  7: "Μέρα της σκέψης και της ησυχίας. Καλή για να ακούσεις τον εαυτό σου.",
  8: "Μέρα της δύναμης και της επιτυχίας. Νιώθεις ότι μπορείς.",
  9: "Μέρα που κλείνει κύκλους. Καλή για να αφήσεις κάτι πίσω, όχι για αρχές."
};

/* ---------- Ταρό ---------- */

// Τα φωτεινά χαρτιά: όταν βγαίνουν όρθια, η μέρα μετρά θετικά.
const CARD_GOOD = new Set(["00-fool.jpg", "01-magician.jpg", "03-empress.jpg", "06-lovers.jpg", "07-chariot.jpg", "08-strength.jpg",
  "10-wheel-of-fortune.jpg", "11-justice.jpg", "14-temperance.jpg", "17-star.jpg", "19-sun.jpg", "21-world.jpg"]);
function cardFor(p, date) {
  const h = createHash("sha256").update(`${p.dob}|${p.tob || ""}|${String(p.pob || "").toLowerCase()}|${date}`).digest();
  const card = CARDS[h.readUInt32BE(0) % CARDS.length];
  const reversed = (h.readUInt32BE(4) % 100) < 35;     // ίδια αναλογία ανάστροφων με το Τρίφυλλο Ταρώ
  return { file: card.file, name: card.name, reversed, meaning: reversed ? card.reversed : card.upright, ok: !reversed && CARD_GOOD.has(card.file) };
}

/* ---------- Αστρολογία ---------- */

const CAT_ORDER = ["love", "money", "dec"];
const QUIET_DAY = "Μέρα ήσυχη, για ξεκούραση. Ο ουρανός δεν πιέζει και δεν βιάζει τίποτα.";
const ASTRO_QUIET = "Ο ουρανός δεν σχηματίζει δυνατή όψη με τον χάρτη σου αυτή τη μέρα. Μέρα ήσυχη, χωρίς ιδιαίτερη ώθηση.";
function astroFor(N, y, m, d) {
  const x = scoreDay(y, m, d, N);
  const avoid = x.avoid || 0;
  const top = CAT_ORDER.map(c => [c, x[c] || 0]).sort((a, b) => b[1] - a[1])[0];
  const ok = avoid < 3 && top[1] >= 3;                  // ίδιο όριο με τις καλές μέρες του Ημερολογίου
  const score = CAT_ORDER.reduce((a, c) => a + Math.max(0, x[c] || 0), 0) - avoid;
  let why = ASTRO_QUIET, cat = null;
  if (ok) { cat = top[0]; why = x.why[cat] || ASTRO_QUIET; }
  else if (avoid >= 2 && x.why.avoid) { cat = "avoid"; why = x.why.avoid; }
  else if (top[1] > 0 && x.why[top[0]]) { why = x.why[top[0]]; }
  return { ok, cat, why, score, mercRetro: !!x.mercRetro };
}

/* ---------- Η εβδομάδα ---------- */

export async function computeWeek(p, now = new Date()) {
  const natal = await natalPoints(p);
  const week = weekFor(now);
  const [sy, sm, sd] = week.start.split("-").map(Number);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(Date.UTC(sy, sm - 1, sd + i));
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
    const date = iso(dt);
    const astro = astroFor(natal.pts, y, m, d);
    const n = personalDay(p.dob, y, m, d);
    const num = { n, ok: NUM_GOOD.has(n), text: NUM_TEXT[n] };
    const card = cardFor(p, date);
    const agree = (astro.ok ? 1 : 0) + (num.ok ? 1 : 0) + (card.ok ? 1 : 0);
    days.push({
      date, label: `${DAYS_GR[dt.getUTCDay()]} ${d} ${MONTHS_GEN[m - 1]}`, wd: DAYS_GR[dt.getUTCDay()],
      tier: agree === 3 ? "tyxeri" : agree === 2 ? "kali" : "apli", agree,
      astro, num, card,
      rank: agree * 100 + astro.score * 5 + (num.ok ? 3 : 0) + (card.ok ? 2 : 0)
    });
  }
  // Η πιο δυνατή μέρα της εβδομάδας: πρώτα όσες συμφωνούν περισσότερο, μετά η πιο δυνατή αστρολογικά.
  const best = [...days].sort((a, b) => b.rank - a.rank)[0];
  best.best = true;
  const counts = { tyxeri: days.filter(x => x.tier === "tyxeri").length, kali: days.filter(x => x.tier === "kali").length };
  return { week, days, counts, hasTime: natal.hasTime, placeFound: natal.placeFound };
}

// Η δωρεάν εικόνα: οι 7 μέρες κλειδωμένες, χωρίς να λέει πόσες είναι τυχερές ή καλές.
// Ανοιχτή είναι μόνο μία μέρα: η μέρα που θέλει προσοχή, ή αν δεν υπάρχει, η πιο ήσυχη μέρα.
// Δεν φανερώνεται ποτέ η πιο δυνατή μέρα. Προτιμάμε μέρα που δεν έχει περάσει ακόμα.
export function teaserOf(data, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const pool = data.days.filter(x => !x.best);
  const ahead = pool.filter(x => x.date >= today);
  const from = ahead.length ? ahead : pool;
  const byWeak = [...from].sort((a, b) => a.rank - b.rank);
  const attn = byWeak.find(x => x.astro.cat === "avoid");
  const open = attn || byWeak[0];
  return {
    week: data.week, hasTime: data.hasTime,
    days: data.days.map(x => x.date === open.date
      ? { date: x.date, label: x.label, wd: x.wd, open: true, kind: attn ? "prosoxi" : "isyxi", why: attn ? x.astro.why : QUIET_DAY }
      : { date: x.date, label: x.label, wd: x.wd, locked: true })
  };
}
