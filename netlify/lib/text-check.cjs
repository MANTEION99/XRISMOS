// Έλεγχος του κειμένου ενός χρησμού μετά τη γραφή (και όσο γράφεται).
//
// 1. Διορθώνει αυτόματα λάθος μέρα της εβδομάδας δίπλα σε ημερομηνία
//    (π.χ. «Πέμπτη 31 Οκτωβρίου» όταν η 31η είναι Σάββατο), γιατί τα μοντέλα τη μαντεύουν.
// 2. Καταγράφει ό,τι δεν μπορεί να διορθωθεί με ασφάλεια, για να το βλέπουμε στα logs:
//    ημερομηνίες που δεν υπάρχουν στη λίστα του ουρανού, ημερομηνίες που έχουν περάσει,
//    τις απαγορευμένες λέξεις «ίσως» και «μπορεί», παύλες.

const MONTHS = ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"];
const WEEKDAYS = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
// Και οι μορφές «την Πέμπτη», «το Σάββατο», «της Παρασκευής» κ.λπ.
const WD_FORMS = {
  "Κυριακή": 0, "Κυριακής": 0, "Δευτέρα": 1, "Δευτέρας": 1, "Τρίτη": 2, "Τρίτης": 2,
  "Τετάρτη": 3, "Τετάρτης": 3, "Πέμπτη": 4, "Πέμπτης": 4, "Παρασκευή": 5, "Παρασκευής": 5,
  "Σάββατο": 6, "Σαββάτου": 6
};
const GENITIVE = { 0: "Κυριακής", 1: "Δευτέρας", 2: "Τρίτης", 3: "Τετάρτης", 4: "Πέμπτης", 5: "Παρασκευής", 6: "Σαββάτου" };

const monthIdx = (name) => MONTHS.findIndex(m => m.toLowerCase() === name.toLowerCase());
const WD_ALT = Object.keys(WD_FORMS).join("|");
const MONTH_ALT = MONTHS.join("|");
// [μέρα εβδομάδας] [,] αριθμός [η|ης] μήνας [έτος]
const DATE_RE = new RegExp(`(?:(?<art>την|το|της|του)\\s+)?(?:(?<wd>${WD_ALT})\\s*,?\\s+)?(?<d>\\d{1,2})(?:η|ης)?\\s+(?<mon>${MONTH_ALT})(?:\\s+(?<yr>\\d{4}))?`, "giu");

// Η ημερομηνία «σήμερα» με ώρα Ελλάδας, στις 12:00 UTC.
function athensToday(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now).map(x => [x.type, x.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, 12);
}

// Χωρίς έτος: η πρώτη τέτοια ημερομηνία από σήμερα και μετά (εκτός αν είναι πολύ πρόσφατα περασμένη).
function resolveYear(day, month, year, today) {
  if (year) return +year;
  const y = new Date(today).getUTCFullYear();
  const t = Date.UTC(y, month, day, 12);
  return t < today - 45 * 86400000 ? y + 1 : y;
}

// Όλες οι ημερομηνίες (μέρα-μήνας-έτος) που εμφανίζονται σε ένα κείμενο, π.χ. στη λίστα του ουρανού μέσα στο prompt.
function datesIn(text, today = athensToday()) {
  const out = new Set();
  for (const { groups: g } of String(text || "").matchAll(DATE_RE)) {
    const mi = monthIdx(g.mon);
    if (mi < 0) continue;
    out.add(`${+g.d}-${mi}-${resolveYear(+g.d, mi, g.yr, today)}`);
  }
  return out;
}

// Διορθώνει λάθος μέρα της εβδομάδας. Επιστρέφει { text, fixes }.
function fixWeekdays(text, today = athensToday()) {
  const fixes = [];
  const out = String(text || "").replace(DATE_RE, (...args) => {
    const whole = args[0];
    const { art, wd, d, mon, yr } = args[args.length - 1];
    if (!wd) return whole;
    const mi = monthIdx(mon);
    if (mi < 0) return whole;
    const y = resolveYear(+d, mi, yr, today);
    const real = new Date(Date.UTC(y, mi, +d, 12)).getUTCDay();
    if (WD_FORMS[wd] === real) return whole;
    const isGen = /(ς|ου)$/.test(wd);
    const right = isGen ? GENITIVE[real] : WEEKDAYS[real];
    fixes.push(`${wd} ${d} ${mon} σε ${right}`);
    let fixed = whole.replace(wd, right);
    // Το άρθρο ακολουθεί το γένος: «το Σάββατο», «την Πέμπτη», «του Σαββάτου», «της Πέμπτης».
    if (art) {
      const sat = real === 6;
      const want = isGen ? (sat ? "του" : "της") : (sat ? "το" : "την");
      const cased = art[0] === art[0].toUpperCase() ? want[0].toUpperCase() + want.slice(1) : want;
      fixed = fixed.replace(art, cased);
    }
    return fixed;
  });
  return { text: out, fixes };
}

// Όλες οι ασφαλείς αυτόματες διορθώσεις: μέρα της εβδομάδας και παύλες ανάμεσα σε λέξεις (γίνονται κόμμα).
function fixText(text, today = athensToday()) {
  const w = fixWeekdays(text, today);
  let dashes = 0;
  const out = w.text.replace(/\s[–—]\s/g, () => { dashes++; return ", "; });
  return { text: out, fixes: dashes ? [...w.fixes, `παύλες: ${dashes}`] : w.fixes };
}

// Έλεγχος για καταγραφή. allowedSource: το prompt (περιέχει τη λίστα του ουρανού).
function audit(text, allowedSource = "", now = new Date()) {
  const today = athensToday(now);
  const issues = [];
  const allowed = datesIn(allowedSource, today);
  const hasSky = /ΠΡΑΓΜΑΤΙΚΟΣ ΟΥΡΑΝΟΣ/.test(allowedSource);
  for (const m of String(text || "").matchAll(DATE_RE)) {
    const g = m.groups;
    const mi = monthIdx(g.mon);
    if (mi < 0) continue;
    const y = resolveYear(+g.d, mi, g.yr, today);
    const t = Date.UTC(y, mi, +g.d, 12);
    if (t < today) issues.push(`περασμένη ημερομηνία: ${m[0].trim()}`);
    else if (hasSky && !allowed.has(`${+g.d}-${mi}-${y}`)) issues.push(`ημερομηνία εκτός λίστας: ${m[0].trim()}`);
  }
  const banned = String(text || "").match(/(^|[^\p{L}])(ίσως|μπορεί)(?=[^\p{L}]|$)/giu);
  if (banned) issues.push(`απαγορευμένες λέξεις: ${banned.length} (ίσως/μπορεί)`);
  if (/\s[–—]\s/.test(text || "")) issues.push("παύλα στο κείμενο");
  return issues;
}

module.exports = { fixText, fixWeekdays, audit, datesIn, athensToday };
