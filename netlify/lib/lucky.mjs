// Το δώρο του πληρωμένου χρησμού: μια μέρα των επόμενων 7, σχετική με το θέμα κάθε υπηρεσίας, με τον λόγο της.
// Αν η εβδομάδα δεν έχει δυνατή μέρα για το θέμα, δίνουμε την πιο ήρεμη μέρα της εβδομάδας
// και την επόμενη δυνατή μέρα, όποτε κι αν πέφτει μέσα στις επόμενες εβδομάδες.
// Υπολογίζεται μία φορά, από τη μέρα της πληρωμής, και μένει αποθηκευμένο στον χρησμό.
import { natalPoints, scoreDay } from "./imerologio.mjs";
import { personalDay } from "./tyxeres.mjs";

const DAYS_GR = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
const MONTHS_GEN = ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"];
const STRONG = 3;            // ίδιο όριο με τις καλές μέρες του Ημερολογίου
const LOOK_AHEAD = 45;       // πόσο μακριά ψάχνουμε την επόμενη δυνατή μέρα

// Τι δίνει κάθε υπηρεσία. cats: ποιες κατηγορίες της αστρολογικής μηχανής μετράνε.
const CFG = {
  epistrofi:   { cats: ["love"], title: "Η μέρα που ανοίγει ο δρόμος ανάμεσά σας", topic: "για την αγάπη", calm: "μέρα που η καρδιά σου ησυχάζει και βλέπεις τα πράγματα καθαρά." },
  agapi:       { cats: ["love"], title: "Η μέρα που σε σκέφτεται πιο έντονα", topic: "για την αγάπη", calm: "μέρα που η καρδιά σου ησυχάζει και βλέπεις τα πράγματα καθαρά." },
  alitheia:    { cats: ["dec"], title: "Η μέρα που η αλήθεια βγαίνει πιο εύκολα στο φως", topic: "για την αλήθεια", calm: "μέρα που το μυαλό σου ησυχάζει και βλέπεις τα πράγματα καθαρά." },
  symvatotita: { cats: ["love"], both: true, title: "Η πιο ζεστή μέρα της εβδομάδας για τους δυο σας", topic: "για εσάς τους δύο", calm: "μέρα ήρεμη για τους δυο σας, χωρίς εντάσεις." },
  oikonomika:  { cats: ["money"], title: "Η μέρα με την πιο θετική ενέργεια για τα οικονομικά σου", topic: "για τα οικονομικά σου", calm: "μέρα ήρεμη, χωρίς πίεση, που βλέπεις τα πράγματα καθαρά." },
  erotima:     { cats: ["love", "money", "dec"], title: "Η πιο τυχερή σου μέρα για την εβδομάδα που έρχεται", topic: "", calm: "μέρα ήρεμη, που βλέπεις τα πράγματα καθαρά." },
  numerology:  { numbers: true, title: "Η μέρα της εβδομάδας που κουβαλά τον δικό σου αριθμό", topic: "με τον αριθμό σου", calm: "" }
};

function athensToday(from) {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(from);
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function dayInfo(base, i) {
  const dt = new Date(base + i * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), wd: dt.getUTCDay(),
    label: `${DAYS_GR[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS_GEN[dt.getUTCMonth()]}` };
}
const art = (wd) => (wd === 6 ? "το" : "την");                 // «την Τρίτη», «το Σάββατο»

// Αστρολογικός βαθμός μιας μέρας για το θέμα της υπηρεσίας.
function astro(cfg, charts, x) {
  const s = charts.map(N => scoreDay(x.y, x.m, x.d, N));
  const own = s[0];
  const val = (sc) => Math.max(...cfg.cats.map(c => sc[c] || 0));
  const best = cfg.cats.map(c => [c, own[c] || 0]).sort((a, b) => b[1] - a[1])[0];
  const avoid = Math.max(...s.map(sc => sc.avoid || 0));
  return {
    strong: avoid < 3 && val(own) >= STRONG,                    // ο λόγος βγαίνει πάντα από τον δικό της χάρτη
    score: s.reduce((a, sc) => a + val(sc), 0) - avoid,
    calmScore: avoid * 10 + s.reduce((a, sc) => a + Math.abs(sc.love || 0) + Math.abs(sc.money || 0) + Math.abs(sc.dec || 0), 0),
    why: own.why[best[0]] || ""
  };
}

const reduce = (n) => { while (n > 9) n = String(n).split("").reduce((a, c) => a + +c, 0); return n; };
const lifePath = (dob) => reduce(String(dob).replace(/\D/g, "").split("").reduce((a, c) => a + +c, 0));

async function compute(tool, p, from) {
  const cfg = CFG[tool];
  const base = athensToday(from);
  const pack = (x, why) => ({ label: x.label, wd: x.wd, why });

  if (cfg.numbers) {
    const lp = lifePath(p.dob1);
    const hit = (x) => personalDay(p.dob1, x.y, x.m, x.d) === lp;
    const whyHit = `Ο αριθμός της μέρας είναι ${lp}, ίδιος με τον αριθμό της ζωής σου.`;
    for (let i = 1; i <= 7; i++) { const x = dayInfo(base, i); if (hit(x)) return { title: cfg.title, mode: "strong", ...pack(x, whyHit) }; }
    let calm = null;
    for (let i = 1; i <= 7 && !calm; i++) { const x = dayInfo(base, i); const n = personalDay(p.dob1, x.y, x.m, x.d); if (n === 7 || n === 2) calm = { x, n }; }
    if (!calm) calm = { x: dayInfo(base, 1), n: personalDay(p.dob1, dayInfo(base, 1).y, dayInfo(base, 1).m, dayInfo(base, 1).d) };
    let next = null;
    for (let i = 8; i <= LOOK_AHEAD && !next; i++) { const x = dayInfo(base, i); if (hit(x)) next = x; }
    return {
      title: cfg.title, mode: "calm",
      intro: `Αυτή την εβδομάδα καμία μέρα δεν κουβαλά τον αριθμό της ζωής σου, το ${lp}. Η πιο ήρεμη μέρα της εβδομάδας σου είναι:`,
      ...pack(calm.x, `Ο αριθμός της μέρας είναι ${calm.n}, ${calm.n === 7 ? "ο αριθμός της ησυχίας και της σκέψης" : calm.n === 2 ? "ο αριθμός της υπομονής και της ηρεμίας" : "μέρα για να πάρεις ανάσα"}.`),
      next: next ? `Η επόμενη μέρα με τον αριθμό σου έρχεται ${art(next.wd)} ${next.label}. ${whyHit}` : ""
    };
  }

  const charts = [(await natalPoints({ dob: p.dob1, tob: p.tob1, pob: p.pob1 })).pts];
  if (cfg.both && /^\d{4}-\d{2}-\d{2}$/.test(p.dob2 || "")) charts.push((await natalPoints({ dob: p.dob2, tob: p.tob2, pob: p.pob2 })).pts);

  const week = [];
  for (let i = 1; i <= 7; i++) { const x = dayInfo(base, i); week.push({ x, a: astro(cfg, charts, x) }); }
  const strong = week.filter(w => w.a.strong).sort((a, b) => b.a.score - a.a.score)[0];
  if (strong) return { title: cfg.title, mode: "strong", ...pack(strong.x, strong.a.why) };

  const calm = [...week].sort((a, b) => a.a.calmScore - b.a.calmScore)[0];
  let next = null;
  for (let i = 8; i <= LOOK_AHEAD && !next; i++) { const x = dayInfo(base, i); const a = astro(cfg, charts, x); if (a.strong) next = { x, a }; }
  const topic = cfg.topic ? " " + cfg.topic : "";
  return {
    title: cfg.title, mode: "calm",
    intro: `Αυτή την εβδομάδα το σύμπαν δεν δίνει μια δυνατή μέρα${topic}. Σου δίνει όμως την πιο ήρεμη:`,
    ...pack(calm.x, cap(cfg.calm)),
    next: next ? `Η επόμενη δυνατή ${cfg.both ? "μέρα" : "σου μέρα"}${topic} έρχεται ${art(next.x.wd)} ${next.x.label}. ${next.a.why}` : ""
  };
}
const cap = (s) => s.charAt(0).toLocaleUpperCase("el") + s.slice(1);

export async function luckyFor(reading, store, key) {
  if (!reading || reading.lucky !== undefined) return reading ? reading.lucky : null;
  if (!CFG[reading.tool] || (reading.stage && reading.stage !== "q1")) return null;
  const p = reading.inputs || {};
  let lucky = null;
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.dob1 || "")) lucky = await compute(reading.tool, p, new Date(reading.firstPaidAt || Date.now()));
  } catch (e) { console.log("[lucky] " + e.message); return null; }
  try { await store.setJSON(key, { ...reading, lucky }); } catch (e) {}
  return lucky;
}

// Για δοκιμές.
export { compute as _compute };
