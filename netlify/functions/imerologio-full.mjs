// «Οι καλές σου μέρες του 2027»: όλη η χρονιά, μετά την πληρωμή.
// Ελέγχει την πληρωμή (Stripe ή Viva) για αυτό ακριβώς το ημερολόγιο και στέλνει τους 12 μήνες.
// Η σελίδα μπορεί να ξανανοίξει όσες φορές θέλει με το ίδιο link.

import { json, verifyStripeSession, capturePayment } from "../lib/epistrofi-common.mjs";
import { oracleStore } from "../lib/oracle-store.mjs";
import { TOOL } from "../lib/imerologio.mjs";

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });
  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }
  const readingId = String(b.reading_id || "");
  const sessionId = String(b.session_id || "");
  if (!/^[0-9a-f-]{36}$/.test(readingId)) return json(400, { error: "Λάθος αίτημα." });

  const store = oracleStore();
  const r = await store.get(readingId, { type: "json" });
  if (!r || r.tool !== TOOL) return json(404, { error: "Δεν βρέθηκε το ημερολόγιο." });

  if (r.paidSession !== sessionId) {
    const s = await verifyStripeSession(sessionId, TOOL, readingId);
    if (!s) return json(402, { error: "Δεν βρέθηκε έγκυρη πληρωμή για αυτό το ημερολόγιο." });
    // Το ημερολόγιο είναι έτοιμο αμέσως, άρα η χρέωση γίνεται οριστική εδώ, αν είχε μόνο δεσμευτεί.
    await capturePayment(s).catch(() => {});
    r.paidSession = sessionId;
    r.paidAt = r.paidAt || new Date().toISOString();
    r.full = "imerologio";
    await store.setJSON(readingId, r);
  }

  return json(200, {
    status: "done", name: r.inputs.name1, year: r.data.year, hasTime: r.data.hasTime,
    months: r.data.months
  });
};

export const config = { path: "/api/imerologio-full", method: "POST" };
