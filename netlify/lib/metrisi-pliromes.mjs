// Μέτρηση πληρωμών από τον server, χωρίς cookies και χωρίς προσωπικά στοιχεία.
// Μια πληρωμή μετράει μία φορά για πάντα, μόνο όταν την έχει επιβεβαιώσει το Stripe ή η Viva,
// και γράφεται στη μέρα που έγινε (ώρα Ελλάδας). Κρατάμε μόνο ένα σύντομο αποτύπωμα του κωδικού πληρωμής.
// Τα ανοίγματα της πληρωμένης απάντησης μετά το πρώτο μετράνε χωριστά, ως «ksanaeidan».
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const dayStore = () => getStore({ name: "metrisi", consistency: "strong" });
const payStore = () => getStore({ name: "metrisi-pliromes", consistency: "strong" });
const hashId = (id) => createHash("sha256").update(String(id)).digest("hex").slice(0, 16);

export function athensDay(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Το όνομα της σελίδας όπως το γράφει η μέτρηση (π.χ. η υπηρεσία tyxeres ζει στη σελίδα tyxeres-meres).
const PAGE_OF = { tyxeres: "tyxeres-meres" };
function splitTool(tool) {
  const t = String(tool || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  const m = /^(.*)_q([23])$/.exec(t);
  const base = m ? m[1] : t;
  return { page: PAGE_OF[base] || base || "agnosti", stage: m ? "q" + m[2] : "q1" };
}

// Αλλαγή στη μέρα της μέτρησης, με προστασία όταν γράφουν δύο ταυτόχρονα.
async function bumpDay(day, fn) {
  const st = dayStore();
  for (let i = 0; i < 4; i++) {
    const cur = await st.getWithMetadata(day, { type: "json" });
    const data = (cur && cur.data) || { v: {}, s: {}, e: {} };
    data.e = data.e || {};
    fn(data);
    const opt = cur && cur.etag ? { onlyIfMatch: cur.etag } : { onlyIfNew: true };
    const res = await st.setJSON(day, data, opt);
    if (!res || res.modified !== false) return true;
  }
  return false;
}
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

// Καλείται μόνο όταν η πληρωμή είναι επιβεβαιωμένη και οριστική (χρεωμένη κάρτα ή πληρωμένο IRIS).
// id: ο κωδικός της πληρωμής (cs_... ή vv_...), tool: από τα στοιχεία της πληρωμής, ts: πότε έγινε.
export async function recordPayment({ id, tool, method, ts }) {
  try {
    if (!id) return;
    const h = hashId(id), st = payStore();
    let rec = null;
    for (let i = 0; i < 4; i++) {
      const cur = await st.getWithMetadata(h, { type: "json" });
      const old = (cur && cur.data) || {};
      if (old.paid) return;                                   // έχει ήδη μετρηθεί
      const when = ts && !isNaN(new Date(ts)) ? new Date(ts) : new Date();
      rec = { ...old, paid: 1, day: athensDay(when) };
      const opt = cur && cur.etag ? { onlyIfMatch: cur.etag } : { onlyIfNew: true };
      const res = await st.setJSON(h, rec, opt);
      if (!res || res.modified !== false) break;
      rec = null;
    }
    if (!rec) return;
    const { page, stage } = splitTool(tool);
    const m = method === "iris" ? "iris" : "karta";
    await bumpDay(rec.day, (d) => {
      inc(d.e, "pliromeni:" + page);
      inc(d.e, "tropos-pliromis:" + m);
      inc(d.e, "erotisi:" + stage);
      // Αν η απάντηση είχε ήδη ανοίξει πριν οριστικοποιηθεί η χρέωση, ξέρουμε ήδη αν ήταν νέα ή ξαναήρθε.
      if (rec.r === "n" || rec.r === "r") { d.pr = d.pr || {}; inc(d.pr, rec.r); }
    });
  } catch (e) {
    console.error("[metrisi-pliromes]", e.message);
  }
}

// Καλείται από τη μέτρηση όταν ανοίγει η πληρωμένη απάντηση. Το πρώτο άνοιγμα δεν μετράει ως επιστροφή.
export async function recordView({ id, page, r }) {
  try {
    if (!id) return;
    const h = hashId(id), st = payStore();
    const rr = r === "r" || r === "n" ? r : "";
    for (let i = 0; i < 4; i++) {
      const cur = await st.getWithMetadata(h, { type: "json" });
      const old = (cur && cur.data) || null;
      const opt = cur && cur.etag ? { onlyIfMatch: cur.etag } : { onlyIfNew: true };
      if (old && old.viewed) {
        await bumpDay(athensDay(), (d) => inc(d.e, "ksanaeidan:" + (page || "agnosti")));
        return;
      }
      const rec = { ...(old || {}), viewed: 1, ...(rr ? { r: rr } : {}) };
      const res = await st.setJSON(h, rec, opt);
      if (res && res.modified === false) continue;
      // Πρώτο άνοιγμα πληρωμής που έχει ήδη μετρηθεί: γράφουμε αν ήταν νέα ή ξαναήρθε, στη μέρα της πληρωμής.
      if (old && old.paid && rr) await bumpDay(old.day, (d) => { d.pr = d.pr || {}; inc(d.pr, rr); });
      return;
    }
  } catch (e) {
    console.error("[metrisi-pliromes]", e.message);
  }
}

// Βοηθός για τα σημεία ελέγχου πληρωμής: μετράει τη συνεδρία αν είναι οριστικά πληρωμένη.
// Stripe: μόνο όταν η χρέωση έχει ολοκληρωθεί (όχι όσο το ποσό είναι μόνο δεσμευμένο). Viva: όταν είναι πληρωμένη.
export async function recordSession(s) {
  try {
    if (!s || !s.id) return;
    const tool = (s.metadata && s.metadata.tool) || "";
    if (s.viva) return recordPayment({ id: s.id, tool, method: "iris", ts: s.paid_at });
    const pi = s.payment_intent && typeof s.payment_intent === "object" ? s.payment_intent : null;
    const final = pi ? pi.status === "succeeded" : s.payment_status === "paid";
    if (!final) return;
    const created = (pi && pi.created) || s.created;
    return recordPayment({ id: s.id, tool, method: "karta", ts: created ? created * 1000 : Date.now() });
  } catch (e) {
    console.error("[metrisi-pliromes]", e.message);
  }
}
