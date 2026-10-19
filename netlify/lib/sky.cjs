// Πραγματικός ουρανός για τους χρησμούς:
// 1. Η σωστή διαφορά ώρας της Ελλάδας για κάθε ημερομηνία γέννησης (θερινή/χειμερινή ώρα, και ιστορικά).
// 2. Οι κινήσεις των πλανητών τους επόμενους 12 μήνες και οι μέρες που αγγίζουν τα σημεία των δύο χαρτών,
//    ώστε η «περίοδος επιστροφής» να βγαίνει από αληθινές ημερομηνίες και όχι από φαντασία.

// Το astronomy-engine δίνεται απ' έξω (δες το τέλος), ώστε το αρχείο να δουλεύει ίδιο
// και από τα ESM (.mjs) και από τα CJS (.js) functions, χωρίς require μέσα στο bundle.
let Astronomy = null;

/* ---------- 1. Διαφορά ώρας ---------- */

const fmtCache = new Map();
function fmtFor(tzName) {
  if (!fmtCache.has(tzName)) {
    fmtCache.set(tzName, new Intl.DateTimeFormat("en-US", {
      timeZone: tzName, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
    }));
  }
  return fmtCache.get(tzName);
}

function offsetAt(ts, tzName = "Europe/Athens") {
  const parts = Object.fromEntries(fmtFor(tzName).formatToParts(new Date(ts)).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - ts) / 3600000;
}

// Διαφορά από UTC για τοπική ώρα σε οποιαδήποτε ζώνη ώρας (π.χ. "Europe/Athens", "America/New_York"),
// με θερινή ώρα και ιστορικές αλλαγές. Αν η ζώνη δεν αναγνωρίζεται, γυρίζει στην Ελλάδα.
function zoneOffset(tzName, year, month, day, hour, min) {
  let zone = tzName || "Europe/Athens";
  try { fmtFor(zone); } catch { zone = "Europe/Athens"; }
  const local = Date.UTC(year, month - 1, day, hour, min);
  let off = 2;
  for (let i = 0; i < 3; i++) off = offsetAt(local - off * 3600000, zone);
  return off;
}

// Επιστρέφει τη διαφορά από UTC (π.χ. 2 ή 3) για τοπική ώρα Ελλάδας στη συγκεκριμένη ημερομηνία.
function greeceTzone(year, month, day, hour, min) {
  return zoneOffset("Europe/Athens", year, month, day, hour, min);
}

// Χωρίς ώρα γέννησης: αλλάζει ζώδιο η Σελήνη μέσα σε εκείνη τη μέρα (ώρα Ελλάδας);
// Αν ναι, το ζώδιο της Σελήνης είναι αβέβαιο και δεν πρέπει να αναφερθεί.
function moonChangesSign(dob, tzName) {
  const [y, m, d] = String(dob || "").split("-").map(n => parseInt(n, 10));
  if (!y || !m || !d) return false;
  const at = (h, mi) => new Date(Date.UTC(y, m - 1, d, h, mi) - zoneOffset(tzName, y, m, d, h, mi) * 3600000);
  const sign = (date) => Math.floor(lonOf("Moon", date) / 30);
  return sign(at(0, 0)) !== sign(at(23, 59));
}

/* ---------- 2. Διελεύσεις ---------- */

const SIGNS = ["Κριό", "Ταύρο", "Διδύμους", "Καρκίνο", "Λέοντα", "Παρθένο", "Ζυγό", "Σκορπιό", "Τοξότη", "Αιγόκερω", "Υδροχόο", "Ιχθύες"];
const MONTHS = ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"];
const RETRO = { Venus: "ανάδρομη" };
const GR = { Mercury: "ο Ερμής", Venus: "η Αφροδίτη", Mars: "ο Άρης", Jupiter: "ο Δίας", Saturn: "ο Κρόνος" };
const ASPECTS = [
  { angle: 0, name: "ενώνεται με" },
  { angle: 60, name: "κάνει εξάγωνο (αρμονική επαφή) με" },
  { angle: 90, name: "κάνει τετράγωνο (ένταση, δοκιμασία) με" },
  { angle: 120, name: "κάνει τρίγωνο (ροή, εύκολο άνοιγμα) με" },
  { angle: 180, name: "κάνει αντίθεση (συνάντηση με τον άλλον) με" }
];

const WEEKDAYS = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
// Η μέρα της εβδομάδας μπαίνει από τον κώδικα, ώστε το μοντέλο να μη χρειάζεται να τη μαντέψει.
const fmtDate = (d) => `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const norm180 = (x) => { x = ((x % 360) + 360) % 360; return x > 180 ? x - 360 : x; };
const signOf = (lon) => SIGNS[Math.floor((((lon % 360) + 360) % 360) / 30)];
// «στον Κριό», αλλά «στους Διδύμους», «στους Ιχθύες».
const inSign = (sign) => (sign === "Διδύμους" || sign === "Ιχθύες" ? "στους " : "στον ") + sign;

function lonOf(body, date) {
  return Astronomy.Ecliptic(Astronomy.GeoVector(body, date, true)).elon;
}

const DAY = 86400000;

// Ημερήσιες θέσεις για 366 μέρες από σήμερα (12:00 UTC).
function sampleYear(bodies, start) {
  const t0 = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 12);
  const days = [];
  for (let i = 0; i <= 366; i++) {
    const date = new Date(t0 + i * DAY);
    const pos = {};
    for (const b of bodies) pos[b] = lonOf(b, date);
    days.push({ date, pos });
  }
  return days;
}

// Τα σημεία των χαρτών που μας ενδιαφέρουν για την αγάπη.
// Ποια σημεία των χαρτών κοιτάμε. Χωρίς spec: τα σημεία της αγάπης (για την Επιστροφή).
// spec: { p1: {Venus:"την Αφροδίτη",...}, desc1, mc1, p2: {...}, who1, who2 }
function natalTargets(p, charts, hasTime1, spec) {
  if (spec) return natalTargetsSpec(p, charts, hasTime1, spec);
  const out = [];
  const moonUnsure = !hasTime1 && moonChangesSign(p.dob1);
  const pick = (chart, who, names) => {
    for (const pl of (chart && chart.planets) || []) {
      if (pl.name === "Moon" && moonUnsure && chart === charts.chart1) continue;
      if (names[pl.name] && Number.isFinite(+pl.full_degree)) {
        out.push({ label: `${names[pl.name]} ${who} (${signOf(+pl.full_degree)})`, lon: +pl.full_degree });
      }
    }
  };
  pick(charts.chart1, `της ${p.name1}`, { Moon: "τη Σελήνη", Venus: "την Αφροδίτη" });
  if (hasTime1 && charts.chart1 && Number.isFinite(+charts.chart1.ascendant)) {
    const desc = (+charts.chart1.ascendant + 180) % 360;
    out.push({ label: `τον Δύοντα της ${p.name1}, την πόρτα του 7ου οίκου των σχέσεων (${signOf(desc)})`, lon: desc });
  }
  pick(charts.chart2, `του/της ${p.name2}`, { Sun: "τον Ήλιο", Venus: "την Αφροδίτη", Mars: "τον Άρη" });
  return out;
}

function natalTargetsSpec(p, charts, hasTime1, spec) {
  const out = [];
  const moonUnsure = !hasTime1 && moonChangesSign(p.dob1);
  const pick = (chart, who, names, isFirst) => {
    for (const pl of (chart && chart.planets) || []) {
      if (pl.name === "Moon" && moonUnsure && isFirst) continue;
      if (names && names[pl.name] && Number.isFinite(+pl.full_degree)) {
        out.push({ label: `${names[pl.name]} ${who} (${signOf(+pl.full_degree)})`, lon: +pl.full_degree });
      }
    }
  };
  const who1 = spec.who1 || `του/της ${p.name1}`;
  pick(charts.chart1, who1, spec.p1, true);
  if (hasTime1 && charts.chart1 && spec.desc1 && Number.isFinite(+charts.chart1.ascendant)) {
    const desc = (+charts.chart1.ascendant + 180) % 360;
    out.push({ label: `τον Δύοντα ${who1}, την πόρτα του 7ου οίκου των σχέσεων (${signOf(desc)})`, lon: desc });
  }
  if (hasTime1 && charts.chart1 && spec.mc1 && Number.isFinite(+charts.chart1.midheaven)) {
    const mc = +charts.chart1.midheaven;
    out.push({ label: `το Μεσουράνημα ${who1}, το σημείο της καριέρας και της επαγγελματικής τύχης (${signOf(mc)})`, lon: mc });
  }
  if (charts.chart2 && spec.p2) pick(charts.chart2, spec.who2 || `του/της ${p.name2}`, spec.p2, false);
  return out;
}

// Ένα ανάδρομο διάστημα γραμμένο έτσι ώστε να μην μπορεί να διαβαστεί ανάποδα:
// λέει ρητά τι ισχύει ΠΡΙΝ, ΜΕΣΑ και ΜΕΤΑ από τις ημερομηνίες.
function retroText(b, start, end, signs) {
  const name = `${GR[b]} ${RETRO[b] || "ανάδρομος"} ${signs.map(inSign).join(" και ")}`;
  const meaning = "παρεξηγήσεις και καθυστερήσεις, ξαναζωντανεύουν παλιές ιστορίες και πρόσωπα από το παρελθόν";
  if (!start) {
    return `ΗΔΗ ΤΩΡΑ και έως ${fmtDate(end)}: ${name}. ΣΕ ΟΛΟ αυτό το διάστημα, δηλαδή από σήμερα: ${meaning}. ΜΕΤΑ από ${fmtDate(end)}: ό,τι μπερδεύτηκε ξεκαθαρίζει.`;
  }
  if (!end) {
    return `από ${fmtDate(start)}: ${name}. ΠΡΙΝ από ${fmtDate(start)}: καλή στιγμή να ειπωθούν ή να κλείσουν όσα πρέπει. ΑΠΟ ${fmtDate(start)} και μετά: ${meaning}.`;
  }
  return `από ${fmtDate(start)} έως ${fmtDate(end)}: ${name}. ΠΡΙΝ από ${fmtDate(start)}: καλή στιγμή να ειπωθούν ή να κλείσουν όσα πρέπει. ΜΕΣΑ στο διάστημα ${fmtDate(start)} έως ${fmtDate(end)}: ${meaning}. ΜΕΤΑ από ${fmtDate(end)}: ό,τι μπερδεύτηκε ξεκαθαρίζει.`;
}

// Κανόνες για τις ημερομηνίες· μπαίνουν σε κάθε prompt που έχει ουρανό.
const DATE_RULES = `ΚΑΝΟΝΕΣ ΓΙΑ ΤΙΣ ΗΜΕΡΟΜΗΝΙΕΣ, ΑΥΣΤΗΡΑ:
• Γράφεις κάθε ημερομηνία ακριβώς όπως είναι στη λίστα. Τη μέρα της εβδομάδας τη γράφεις μόνο όπως τη δίνει η λίστα, ή την παραλείπεις. ΠΟΤΕ δεν την υπολογίζεις μόνος/η σου.
• Ένα διάστημα «από Χ έως Υ» ισχύει ΜΟΝΟ μέσα σε αυτές τις μέρες. Η προειδοποίηση για ανάδρομο πλανήτη αφορά τις μέρες ΑΠΟ την έναρξη ΕΩΣ το τέλος του, ΠΟΤΕ τις μέρες πριν από την έναρξη. Οι μέρες πριν από την έναρξη είναι καλή στιγμή για να ειπωθούν ή να κλείσουν πράγματα.
• Μια αλλαγή ζωδίου ισχύει από εκείνη τη μέρα και μετά, όχι από σήμερα.
• Κάθε πρακτική συμβουλή με ημερομηνία πρέπει να συμφωνεί με τα παραπάνω. Ξαναδιάβασέ την πριν τη γράψεις.
• Αναφέρεσαι μόνο σε μελλοντικές ημερομηνίες, από σήμερα και μετά.`;

function upcomingSky(p, charts, hasTime1, start = new Date(), spec = null) {
  const bodies = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
  const days = sampleYear(bodies, start);
  const general = [];
  const personal = [];

  // Αλλαγές ζωδίου και ανάδρομες περίοδοι.
  for (const b of bodies) {
    let retroStart = null;
    // Τα ζώδια από τα οποία περνά ο πλανήτης όσο είναι ανάδρομος (ξεκινώντας από σήμερα αν είναι ήδη ανάδρομος).
    let retroSigns = norm180(days[1].pos[b] - days[0].pos[b]) < 0 ? [signOf(days[0].pos[b])] : [];
    const addSign = (lon) => { const sg = signOf(lon); if (!retroSigns.includes(sg)) retroSigns.push(sg); };
    for (let i = 1; i < days.length; i++) {
      const prev = days[i - 1].pos[b], cur = days[i].pos[b];
      if (b !== "Mercury" && signOf(prev) !== signOf(cur)) {
        general.push({ t: days[i].date, text: `από ${fmtDate(days[i].date)} και μετά: ${GR[b]} μπαίνει ${inSign(signOf(cur))} (μέχρι τότε είναι ακόμα ${inSign(signOf(prev))})` });
      }
      const motion = norm180(cur - prev);
      const prevMotion = i > 1 ? norm180(prev - days[i - 2].pos[b]) : motion;
      if (prevMotion > 0 && motion < 0) { retroStart = days[i - 1].date; retroSigns = [signOf(prev)]; }
      if (motion < 0) addSign(cur);
      if (prevMotion < 0 && motion > 0) {
        general.push({ t: retroStart || days[0].date, text: retroText(b, retroStart, days[i - 1].date, retroSigns) });
        retroStart = null; retroSigns = [];
      }
    }
    if (retroStart) {
      general.push({ t: retroStart, text: retroText(b, retroStart, null, retroSigns) });
    }
  }

  // Ακριβείς επαφές των Αφροδίτης, Άρη, Δία με τα σημεία των δύο χαρτών.
  const targets = natalTargets(p, charts, hasTime1, spec);
  const allowed = { Venus: [0, 60, 120, 180], Jupiter: [0, 60, 120, 180], Mars: [0, 120] };
  for (const b of ["Venus", "Mars", "Jupiter"]) {
    for (const tg of targets) {
      for (const a of ASPECTS.filter(x => allowed[b].includes(x.angle))) {
        for (const sign of a.angle === 0 || a.angle === 180 ? [1] : [1, -1]) {
          for (let i = 1; i < days.length; i++) {
            const d0 = norm180(days[i - 1].pos[b] - tg.lon - sign * a.angle);
            const d1 = norm180(days[i].pos[b] - tg.lon - sign * a.angle);
            if (Math.abs(d0) < 10 && Math.abs(d1) < 10 && (d0 === 0 || (d0 < 0) !== (d1 < 0))) {
              personal.push({ t: days[i].date, text: `${fmtDate(days[i].date)}: ${GR[b]} του ουρανού ${a.name} ${tg.label} (κορύφωση αυτή τη μέρα, νιώθεται λίγες μέρες πριν και μετά)` });
            }
          }
        }
      }
    }
  }

  general.sort((x, y) => x.t - y.t);
  personal.sort((x, y) => x.t - y.t);
  return { general: general.map(x => x.text), personal: personal.map(x => x.text) };
}

// Η «σημερινή» μέρα με ώρα Ελλάδας (στις 01:00 ώρα Ελλάδας είναι ακόμα χθες σε UTC).
function athensDay(now) {
  const parts = Object.fromEntries(fmtFor("Europe/Athens").formatToParts(now).map(x => [x.type, x.value]));
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, 12));
}

function skyBlock(p, charts, hasTime1, now = new Date(), spec = null) {
  const start = athensDay(now);
  const s = upcomingSky(p, charts, hasTime1, start, spec);
  return `ΠΡΑΓΜΑΤΙΚΟΣ ΟΥΡΑΝΟΣ ΤΩΝ ΕΠΟΜΕΝΩΝ 12 ΜΗΝΩΝ (σήμερα είναι ${fmtDate(start)}). Υπολογισμένες ημερομηνίες, οι ΜΟΝΕΣ που επιτρέπεται να χρησιμοποιήσεις:
(Είναι κινήσεις των πλανητών του σημερινού ουρανού, όχι πλανήτες των χαρτών τους. Γράψε π.χ. «η Αφροδίτη του ουρανού ενώνεται με την Αφροδίτη του», ποτέ «η Αφροδίτη του» για πλανήτη που περνά.)
Γενικές κινήσεις:
${s.general.map(x => "• " + x).join("\n")}

Επαφές με τα σημεία ${charts.chart2 ? "των δύο χαρτών" : "του χάρτη"}:
${s.personal.length ? s.personal.map(x => "• " + x).join("\n") : "• (καμία ακριβής επαφή)"}

${DATE_RULES}`;
}

module.exports = function makeSky(astronomyEngine) {
  Astronomy = astronomyEngine;
  return { greeceTzone, zoneOffset, upcomingSky, skyBlock, moonChangesSign };
};
