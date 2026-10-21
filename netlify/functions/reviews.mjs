// Κριτικές από πελάτισσες που ΠΛΗΡΩΣΑΝ χρησμό.
// GET  /api/reviews          οι δημοσιευμένες κριτικές (νεότερες πρώτα), πλήθος και μέσος όρος αστεριών
// POST /api/reviews          { reading_id, session_id, rating 1-5, text, name, publish }
//   Δεκτή μόνο αν ο χρησμός πληρώθηκε με αυτό ακριβώς το session του Stripe (επιβεβαιωμένη αγορά).
//   Μία κριτική ανά χρησμό. Δημοσιεύεται μόνο αν η πελάτισσα το επιτρέψει.
// Για να κρυφτεί μια κριτική: διαγραφή του αντίστοιχου blob στο store "reviews" από το Netlify.

import { getStore } from "@netlify/blobs";

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
    const items = [];
    for (const b of blobs) {
      try {
        const r = await store.get(b.key, { type: "json" });
        if (r && r.publish) items.push(r);
      } catch {}
    }
    items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const avg = items.length ? items.reduce((s, r) => s + r.rating, 0) / items.length : 0;
    return json(200, {
      count: items.length,
      avg: Math.round(avg * 10) / 10,
      items: items.slice(0, 12).map(r => ({ name: r.name, rating: r.rating, text: r.text, tool: TOOL_NAMES[r.tool] || "", date: r.createdAt }))
    }, { "Cache-Control": "public, max-age=60" });
  }

  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }
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
