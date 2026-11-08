// Η σελίδα της μηνιαίας συνομιλίας μιλά μόνο εδώ.
// { action: "open", code }                          τι υπάρχει ήδη στη συνομιλία
// { action: "profile", code, name, dob, tob, pob }  στοιχεία γέννησης (μία φορά) και πρώτο μήνυμα του Μαντείου
// { action: "ask", code, text }                     νέα ερώτηση
// { action: "poll", code }                          η απάντηση όσο γράφεται
// { action: "retry", code }                         ξαναγράφει μια απάντηση που απέτυχε

import { computeData, publicData } from "../lib/oracle-tools.mjs";
import { chatStore, cleanCode, json, publicSession, MAX_QUESTIONS } from "../lib/synomilia.mjs";

const clip = (v, n) => String(v || "").trim().slice(0, n);
const STALE_MS = 60 * 1000;
const MAX_ATTEMPTS = 4;

async function start(req, store, key, s) {
  const genId = crypto.randomUUID();
  const attempts = s.pending && s.pending.attempts ? s.pending.attempts + 1 : 1;
  s.pending = { genId, since: Date.now(), heartbeat: Date.now(), partial: "", attempts };
  s.lastError = null;
  await store.setJSON(key, s);
  const origin = new URL(req.url).origin;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  const r = await fetch(`${origin}/.netlify/functions/synomilia-background`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: s.code, gen_id: genId }),
    signal: ctl.signal
  }).catch(e => ({ status: "aborted/" + e.name }));
  clearTimeout(timer);
  console.log(`[synomilia] ${s.code} background status=${r.status} attempt=${attempts}`);
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });
  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }

  const code = cleanCode(b.code);
  if (code.length < 4) return json(400, { error: "Γράψε τον κωδικό σου." });
  const store = chatStore();
  const c = await store.get(`code/${code}`, { type: "json" });
  if (!c) return json(404, { error: "Ο κωδικός δεν βρέθηκε. Έλεγξε ότι τον έγραψες όπως σου τον στείλαμε." });
  if (c.revoked) return json(403, { error: "Ο κωδικός δεν είναι πια ενεργός." });
  if (Date.now() > Date.parse(c.expiresAt)) return json(403, { error: "Ο κωδικός έχει λήξει. Ζήτησε τον κωδικό του νέου μήνα στο Messenger της σελίδας." });

  const key = `session/${code}`;
  let s = await store.get(key, { type: "json" });
  const action = String(b.action || "open");

  if (action === "open" || action === "poll") {
    // Αν η συγγραφή σταμάτησε χωρίς να τελειώσει (π.χ. διακοπή), ξεκινά ξανά.
    if (s && s.pending && Date.now() - (s.pending.heartbeat || s.pending.since) > STALE_MS) {
      if ((s.pending.attempts || 1) < MAX_ATTEMPTS) await start(req, store, key, s);
      else { s.pending = null; s.lastError = "Η απάντηση δεν ολοκληρώθηκε. Πάτησε «Ξαναδοκίμασε»."; await store.setJSON(key, s); }
    }
    return json(200, publicSession(c, s));
  }

  if (action === "profile") {
    if (s && s.profile) return json(409, { error: "Τα στοιχεία γέννησης έχουν ήδη δοθεί για αυτόν τον κωδικό." });
    const name = clip(b.name, 40);
    const dob = clip(b.dob, 10);
    const tob = clip(b.tob, 5);
    const pob = clip(b.pob, 80);
    if (name.length < 2) return json(400, { error: "Γράψε το όνομά σου." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return json(400, { error: "Γράψε την ημερομηνία γέννησης." });
    const y = +dob.slice(0, 4);
    if (y < 1920 || y > new Date().getFullYear() - 16) return json(400, { error: "Έλεγξε την ημερομηνία γέννησης." });
    if (tob && !/^\d{2}:\d{2}$/.test(tob)) return json(400, { error: "Έλεγξε την ώρα γέννησης." });
    if (pob.length < 2) return json(400, { error: "Γράψε τον τόπο γέννησης." });
    const p = { name1: name, dob1: dob, tob1: tob, pob1: pob };
    let data;
    try { data = await computeData("xartis", p); }
    catch (e) { console.error("[synomilia] chart", e); return json(500, { error: "Ο χάρτης δεν υπολογίστηκε. Δοκίμασε ξανά σε λίγο." }); }
    s = { code, profile: p, data, big3: publicData("xartis", data).big3 || null, messages: [], used: 0, pending: null, done: false, createdAt: new Date().toISOString() };
    await start(req, store, key, s);
    return json(200, publicSession(c, await store.get(key, { type: "json" })));
  }

  if (!s || !s.profile) return json(409, { error: "Πρώτα γράψε τα στοιχεία γέννησής σου." });

  if (action === "ask") {
    if (s.done || (s.used || 0) >= MAX_QUESTIONS) return json(409, { error: "Έκανες και τις " + MAX_QUESTIONS + " ερωτήσεις του μήνα." });
    if (s.pending) return json(409, { error: "Το Μαντείο γράφει ακόμα την προηγούμενη απάντηση." });
    const text = clip(b.text, 500);
    if (text.length < 3) return json(400, { error: "Γράψε την ερώτησή σου." });
    s.messages.push({ role: "user", text, at: new Date().toISOString() });
    s.pending = null;
    await start(req, store, key, s);
    return json(200, publicSession(c, await store.get(key, { type: "json" })));
  }

  if (action === "retry") {
    if (s.pending) return json(200, publicSession(c, s));
    const needs = s.messages.length === 0 || s.messages[s.messages.length - 1].role === "user";
    if (!needs) return json(200, publicSession(c, s));
    s.pending = null;
    await start(req, store, key, s);
    return json(200, publicSession(c, await store.get(key, { type: "json" })));
  }

  return json(400, { error: "Λάθος αίτημα." });
};

export const config = {
  path: "/api/synomilia",
  method: "POST",
  rateLimit: { windowLimit: 90, windowSize: 60, aggregateBy: ["ip", "domain"] }
};
