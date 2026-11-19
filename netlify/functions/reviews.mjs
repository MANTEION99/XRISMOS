// Κριτικές από πελάτισσες που ΠΛΗΡΩΣΑΝ χρησμό.
// GET  /api/reviews          οι δημοσιευμένες κριτικές (νεότερες πρώτα), πλήθος και μέσος όρος αστεριών
// POST /api/reviews          { reading_id, session_id, rating 1-5, text, name, publish }
//   Δεκτή μόνο αν ο χρησμός πληρώθηκε με αυτό ακριβώς το session του Stripe (επιβεβαιωμένη αγορά).
//   Μία κριτική ανά χρησμό. Δημοσιεύεται μόνο αν η πελάτισσα το επιτρέψει.
// Για να κρυφτεί μια κριτική: από τη σελίδα /metrisi (με τον κωδικό), ενότητα «Κριτικές».
// Ο μέσος όρος αστεριών μετράει ΟΛΕΣ τις βαθμολογίες, και τις κρυμμένες, ώστε το κρύψιμο να μην αλλάζει τη βαθμολογία.

import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
const KEY_HASH = "a3bfa830fa037de76ee54ebe1d5320fac7d8f48d65e4629a030bee9588ad1e42";
const isAdmin = (k) => createHash("sha256").update(String(k || "")).digest("hex") === KEY_HASH;

const reviewsStore = () => getStore({ name: "reviews", consistency: "strong" });
const STORES = ["oracle-readings", "epistrofi-readings"];

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", ...extra }
});

const TOOL_NAMES = {
  epistrofi: "Η Επιστροφή της Χαμένης Αγάπης", erotima: "Ρώτα το Μαντείο", agapi: "Ο Χρησμός της Αγάπης",
  alitheia: "Ο Χρησμός της Αλήθειας", symvatotita: "Ταιριάζετε;", oikonomika: "Οικονομική Αρχή",
  numerology: "Αριθμολογία", taro: "Το Τρίφυλλο Ταρώ"
};

const firstName = (v) => String(v || "").trim().split(/\s+/)[0].slice(0, 20)
  .replace(/^(\S)/, (c) => c.toLocaleUpperCase("el"));

export default async (req) => {
  const store = reviewsStore();

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const all = [];
    for (const b of blobs) {
      try {
        const r = await store.get(b.key, { type: "json" });
        if (r && r.rating) all.push(r);
      } catch {}
    }
    all.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const k = new URL(req.url).searchParams.get("k");
    if (k) {
      if (!isAdmin(k)) return json(403, { error: "Λάθος κωδικός" });
      return json(200, { items: all.map(r => ({ id: r.readingId, name: r.name, rating: r.rating, text: r.text, tool: TOOL_NAMES[r.tool] || "", date: r.createdAt, publish: !!r.publish, hidden: !!r.hidden })) }, { "Cache-Control": "no-store" });
    }
    const items = all.filter(r => r.publish && !r.hidden);
    const avg = all.length ? all.reduce((s, r) => s + r.rating, 0) / all.length : 0;
    return json(200, {
      count: all.length,
      avg: Math.round(avg * 10) / 10,
      items: items.slice(0, 12).map(r => ({ name: r.name, rating: r.rating, text: r.text, tool: TOOL_NAMES[r.tool] || "", date: r.createdAt }))
    }, { "Cache-Control": "public, max-age=60" });
  }

  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }
  if (b && b.k !== undefined) {
    if (!isAdmin(b.k)) return json(403, { error: "Λάθος κωδικός" });
    const id = String(b.id || "");
    const r = await store.get(id, { type: "json" });
    if (!r) return json(404, { error: "Δεν βρέθηκε" });
    r.hidden = !!b.hidden;
    await store.setJSON(id, r);
    return json(200, { ok: true, hidden: r.hidden });
  }
  const readingId = String(b.reading_id || "");
  const sessionId = String(b.session_id || "");
  const rating = Math.round(Number(b.rating));
  const text = String(b.text || "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (!/^[0-9a-f-]{36}$/.test(readingId) || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return json(400, { error: "Λάθος στοιχεία." });
  if (!(rating >= 1 && rating <= 5)) return json(400, { error: "Διάλεξε από 1 έως 5 αστέρια." });

  // Επιβεβαίωση αγοράς: ο χρησμός υπάρχει και πληρώθηκε με αυτό το session.
  let reading = null;
  for (const name of STORES) {
    try {
      const r = await getStore({ name, consistency: "strong" }).get(readingId, { type: "json" });
      if (r) { reading = r; break; }
    } catch {}
  }
  if (!reading || reading.paidSession !== sessionId || !reading.full) {
    return json(403, { error: "Η κριτική γράφεται μόνο μετά από ολοκληρωμένο χρησμό." });
  }

  // Σύνδεσμοι και email δεν δημοσιεύονται ποτέ (spam).
  const hasLink = /(https?:\/\/|www\.|\.com|\.gr|@)/i.test(text);
  const publish = b.publish === true && text.length >= 3 && !hasLink;

  await store.setJSON(readingId, {
    readingId, tool: reading.tool || "epistrofi", rating, text,
    name: firstName(b.name) || firstName(reading.inputs && reading.inputs.name1) || "Πελάτισσα",
    publish, createdAt: new Date().toISOString()
  });
  return json(200, { ok: true, published: publish });
};

export const config = {
  path: "/api/reviews",
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] }
};
