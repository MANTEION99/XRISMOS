// Ειδοποιήσεις για τις μεγάλες στιγμές του χάρτη κάθε μέλους των Εκλεκτών.
// Υπολογίζεται με κώδικα (astronomy-engine): για τις επόμενες 21 μέρες κοιτάμε
// εκλείψεις, στάσεις πλανητών (ανάδρομος, ορθή πορεία) και ακριβείς όψεις των αργών
// πλανητών πάνω στα προσωπικά σημεία του χάρτη. Κάθε γεγονός καταγράφεται μία φορά
// ανά μέλος· τα email τα στέλνει ο Σάββας από την κρυφή σελίδα /eklektoi-admin.

import Astronomy from "./vendor/astronomy.cjs";
import { natalPoints } from "./imerologio.mjs";
import { store, saveMember } from "./eklektoi.mjs";

export const WINDOW_DAYS = 21;
export const KEY_HASH = "a3bfa830fa037de76ee54ebe1d5320fac7d8f48d65e4629a030bee9588ad1e42";

const norm = (x) => ((x % 360) + 360) % 360;
const norm180 = (x) => { x = norm(x); return x > 180 ? x - 360 : x; };
const lonOf = (body, date) => norm(Astronomy.Ecliptic(Astronomy.GeoVector(body, date, true)).elon);
const DAY = 86400000;

// Πώς λέγεται κάθε σημείο του χάρτη και τι αφορά.
const POINT = {
  Sun:     { acc: "τον Ήλιο σου", about: "τον εαυτό σου και τον δρόμο σου" },
  Moon:    { acc: "τη Σελήνη σου", about: "τα συναισθήματα, το σπίτι και την οικογένειά σου" },
  Asc:     { acc: "τον Ωροσκόπο σου", about: "τον τρόπο που ζεις και που σε βλέπουν οι άλλοι" },
  Venus:   { acc: "την Αφροδίτη σου", about: "την αγάπη και τις σχέσεις σου" },
  Mars:    { acc: "τον Άρη σου", about: "τη δύναμη και τη θέλησή σου" },
  Mercury: { acc: "τον Ερμή σου", about: "τις σκέψεις, τα μηνύματα και τις κουβέντες σου" }
};
const ASPECT = { 0: "πάνω από", 180: "απέναντι από", 90: "σε τετράγωνο με", [-90]: "σε τετράγωνο με" };
const ASPECT_VERB = { 0: "περνά πάνω από", 180: "στέκεται απέναντι από", 90: "σχηματίζει τετράγωνο με", [-90]: "σχηματίζει τετράγωνο με" };

function dateGR(d) {
  return new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", day: "numeric", month: "long" }).format(d);
}
const dayKey = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/* ---------- Τα γεγονότα του ουρανού στο παράθυρο (ίδια για όλα τα μέλη) ---------- */

export function skyEvents(now = new Date()) {
  const end = new Date(now.getTime() + WINDOW_DAYS * DAY);
  const ev = { eclipses: [], stations: [], days: [] };

  let le = Astronomy.SearchLunarEclipse(now);
  while (le.peak.date < end) {
    if (le.kind !== "penumbral") ev.eclipses.push({ kind: "lunar", date: le.peak.date, lon: norm(lonOf("Sun", le.peak.date) + 180) });
    le = Astronomy.NextLunarEclipse(le.peak);
  }
  let se = Astronomy.SearchGlobalSolarEclipse(now);
  while (se.peak.date < end) {
    ev.eclipses.push({ kind: "solar", date: se.peak.date, lon: lonOf("Sun", se.peak.date) });
    se = Astronomy.NextGlobalSolarEclipse(se.peak);
  }

  // Θέσεις κάθε μέρας στις 12:00 ώρα Ελλάδας περίπου (10:00 UTC).
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10));
  for (let i = -1; i <= WINDOW_DAYS + 1; i++) {
    const d = new Date(start.getTime() + i * DAY), row = { date: d };
    for (const b of ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]) row[b] = lonOf(b, d);
    ev.days.push(row);
  }
  // Στάσεις: αλλάζει πρόσημο η ημερήσια κίνηση.
  for (const b of ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"]) {
    for (let i = 1; i < ev.days.length - 1; i++) {
      const v0 = norm180(ev.days[i][b] - ev.days[i - 1][b]), v1 = norm180(ev.days[i + 1][b] - ev.days[i][b]);
      if (v0 > 0 && v1 <= 0) ev.stations.push({ body: b, retro: true, date: ev.days[i].date, lon: ev.days[i][b] });
      if (v0 < 0 && v1 >= 0) ev.stations.push({ body: b, retro: false, date: ev.days[i].date, lon: ev.days[i][b] });
    }
  }
  ev.from = now; ev.to = end;
  return ev;
}

/* ---------- Τα κείμενα ---------- */

const BODY_NOM = { Mercury: "ο Ερμής", Venus: "η Αφροδίτη", Mars: "ο Άρης", Jupiter: "ο Δίας", Saturn: "ο Κρόνος" };
const STATION_MEANS = {
  Mercury: "παλιές κουβέντες, μηνύματα και ιστορίες που έμειναν στη μέση ξαναγυρίζουν",
  Venus: "παλιά συναισθήματα και πρόσωπα από το παρελθόν ξαναβγαίνουν στην επιφάνεια",
  Mars: "η ενέργειά σου αλλάζει ρυθμό και ζητά να τη στρέψεις σε αυτό που μετράει πραγματικά",
  Jupiter: "ανοίγει μια περίοδος που ό,τι μεγαλώνει στη ζωή σου ζητά πρώτα να το ξανασκεφτείς",
  Saturn: "μια περίοδος που ζητά υπομονή ξεκινά ή κλείνει, και ό,τι χτίζεις τώρα μένει"
};
const OUTER = {
  Jupiter: { nom: "ο Δίας", means: "μια από τις πιο ευνοϊκές περιόδους του χάρτη σου, που έρχεται περίπου μία φορά στα δώδεκα χρόνια", soft: true },
  Saturn: { nom: "ο Κρόνος", means: "μια περίοδο που ζητά υπομονή και καθαρές αποφάσεις, και ό,τι χτίζεται τότε κρατά χρόνια" },
  Uranus: { nom: "ο Ουρανός", means: "μια περίοδο απρόσμενων αλλαγών, που δίνει ελευθερία σε ό,τι σε κρατούσε κλεισμένο" },
  Neptune: { nom: "ο Ποσειδώνας", means: "μια περίοδο ευαισθησίας και ονείρων, που δίνει έμπνευση αλλά θέλει καθαρή ματιά" },
  Pluto: { nom: "ο Πλούτωνας", means: "μια περίοδο βαθιάς μεταμόρφωσης, που αφήνει πίσω ό,τι έχει τελειώσει" }
};
const END = "Το Μαντείο σού το λέει από πριν, για να ξέρεις τι ζεις και πότε περνά. Αν θέλεις να μάθεις τι σημαίνει ειδικά για σένα, η ερώτηση του μήνα σε περιμένει στη σελίδα των Εκλεκτών.";

/* ---------- Ο έλεγχος για ένα μέλος ---------- */

export async function scanMember(m, ev) {
  if (!m.birth || !m.birth.dob) return [];
  const np = await natalPoints(m.birth);
  const pts = np.pts, out = [];
  const push = (key, date, title, text) => out.push({ key, date: date.toISOString(), day: dayKey(date), title, text: text + "\n\n" + END });

  // 1. Εκλείψεις πάνω ή απέναντι από προσωπικό σημείο (έως 3 μοίρες).
  for (const e of ev.eclipses) {
    for (const p of ["Sun", "Moon", "Asc", "Venus"]) {
      if (pts[p] == null) continue;
      for (const a of [0, 180]) {
        if (Math.abs(norm180(e.lon - pts[p] - a)) <= 3) {
          const name = e.kind === "solar" ? "η έκλειψη Ηλίου" : "η έκλειψη Σελήνης";
          push(`ecl:${dayKey(e.date)}:${p}`, e.date, `${e.kind === "solar" ? "Έκλειψη Ηλίου" : "Έκλειψη Σελήνης"} ${ASPECT[a]} ${POINT[p].acc}`,
            `Στις ${dateGR(e.date)} ${name} πέφτει ακριβώς ${ASPECT[a]} ${POINT[p].acc}. Οι εκλείψεις κλείνουν ένα κεφάλαιο και ανοίγουν ένα καινούργιο, και αυτή αγγίζει ${POINT[p].about}. Ό,τι αλλάζει αυτές τις μέρες, αλλάζει για να ξεκινήσει κάτι νέο.`);
        }
      }
    }
  }

  // 2. Στάσεις πλανητών (ανάδρομος ή ορθή πορεία) πάνω σε προσωπικό σημείο (έως 2 μοίρες).
  for (const s of ev.stations) {
    for (const p of ["Sun", "Moon", "Asc", "Venus", "Mercury"]) {
      if (pts[p] == null) continue;
      if (Math.abs(norm180(s.lon - pts[p])) <= 2) {
        const what = s.retro ? (s.body === "Venus" ? "γυρίζει ανάδρομη" : "γυρίζει ανάδρομος") : "ξαναπαίρνει ορθή πορεία";
        const nom = BODY_NOM[s.body], Nom = nom.charAt(0).toUpperCase() + nom.slice(1);
        push(`st:${s.body}:${s.retro ? "R" : "D"}:${dayKey(s.date)}:${p}`, s.date, `${Nom} ${what} πάνω από ${POINT[p].acc}`,
          `Στις ${dateGR(s.date)} ${nom} ${what} ακριβώς πάνω από ${POINT[p].acc}. Όταν ένας πλανήτης σταματά πάνω σε σημείο του χάρτη σου, η επίδρασή του κρατά μέρες. Αυτή τη φορά αγγίζει ${POINT[p].about}: ${STATION_MEANS[s.body]}.`);
      }
    }
  }

  // 3. Ακριβείς όψεις των αργών πλανητών (η μέρα που περνούν την ακριβή μοίρα).
  const hits = [
    ["Jupiter", ["Sun", "Moon", "Asc", "Venus"], [0]],
    ["Saturn", ["Sun", "Moon", "Asc"], [0, 180, 90, -90]],
    ["Uranus", ["Sun", "Moon", "Asc", "Venus"], [0, 180, 90, -90]],
    ["Neptune", ["Sun", "Moon", "Asc"], [0, 180, 90, -90]],
    ["Pluto", ["Sun", "Moon", "Asc"], [0, 180, 90, -90]]
  ];
  const days = ev.days.filter(r => r.date >= ev.from && r.date < ev.to);
  for (const [b, list, angles] of hits) {
    for (const p of list) {
      if (pts[p] == null) continue;
      for (const a of angles) {
        const target = norm(pts[p] + a);
        for (let i = 1; i < days.length; i++) {
          const d0 = norm180(days[i - 1][b] - target), d1 = norm180(days[i][b] - target);
          if (Math.abs(d0) < 5 && Math.abs(d1) < 5 && (d0 === 0 || d0 * d1 < 0)) {
            const o = OUTER[b], Nom = o.nom.charAt(0).toUpperCase() + o.nom.slice(1);
            push(`tr:${b}:${p}:${a}:${dayKey(days[i].date)}`, days[i].date, `${Nom} ${ASPECT[a]} ${POINT[p].acc}`,
              `Γύρω στις ${dateGR(days[i].date)} ${o.nom} ${ASPECT_VERB[a]} ${POINT[p].acc}. Αγγίζει ${POINT[p].about} και φέρνει ${o.means}.`);
            break;
          }
        }
      }
    }
  }

  // 4. Επιστροφή του Δία και του Κρόνου στη θέση της γέννησης.
  for (const [b, years, text] of [
    ["Jupiter", "δώδεκα", "ανοίγει έναν νέο κύκλο ανάπτυξης, και ό,τι ξεκινά τώρα έχει μπροστά του χρόνο να μεγαλώσει"],
    ["Saturn", "είκοσι εννέα", "κλείνει έναν μεγάλο κύκλο της ζωής σου και ανοίγει τον επόμενο, πιο ώριμο και πιο δικό σου"]
  ]) {
    if (pts[b] == null) continue;
    for (let i = 1; i < days.length; i++) {
      const d0 = norm180(days[i - 1][b] - pts[b]), d1 = norm180(days[i][b] - pts[b]);
      if (Math.abs(d0) < 5 && Math.abs(d1) < 5 && (d0 === 0 || d0 * d1 < 0)) {
        const nom = b === "Jupiter" ? "ο Δίας" : "ο Κρόνος";
        push(`ret:${b}:${dayKey(days[i].date)}`, days[i].date, `Η επιστροφή ${b === "Jupiter" ? "του Δία" : "του Κρόνου"}`,
          `Γύρω στις ${dateGR(days[i].date)} ${nom} επιστρέφει στη θέση που είχε όταν γεννήθηκες. Αυτό συμβαίνει περίπου κάθε ${years} χρόνια και ${text}.`);
        break;
      }
    }
  }
  return out;
}

/* ---------- Ο εβδομαδιαίος έλεγχος για όλα τα μέλη ---------- */

export async function runAll(now = new Date()) {
  const st = store(), ev = skyEvents(now);
  const { blobs } = await st.list({ prefix: "m:" });
  let members = 0, added = 0;
  for (const bl of blobs) {
    const m = await st.get(bl.key, { type: "json" });
    if (!m || !m.birth) continue;
    members++;
    let found = [];
    try { found = await scanMember(m, ev); } catch (e) { console.error("[alerts]", m.token, e && e.message); continue; }
    m.alerts = m.alerts || {};
    let changed = false;
    for (const a of found) {
      if (m.alerts[a.key]) continue;
      m.alerts[a.key] = { ...a, found: now.toISOString(), sent: false };
      added++; changed = true;
    }
    if (changed) await saveMember(m);
  }
  await st.setJSON("alerts:lastRun", { at: now.toISOString(), members, added });
  return { members, added };
}
