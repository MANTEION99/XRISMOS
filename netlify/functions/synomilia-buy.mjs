// Αγορά της συνομιλίας από όσους δεν είναι συνδρομητές (29,99€, μία φορά).
// { session_id }  επαληθεύει την πληρωμή στο Stripe και δίνει κωδικό (ο ίδιος κωδικός αν ξαναμπεί).
import { chatStore, newCode, json, CODE_DAYS } from "../lib/synomilia.mjs";
import { verifyStripeSession } from "../lib/epistrofi-common.mjs";

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });
  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }
  const sid = String(b.session_id || "");
  const s = await verifyStripeSession(sid, "synomilia");
  if (!s) return json(402, { error: "Η πληρωμή δεν επιβεβαιώθηκε. Αν χρεώθηκες, στείλε μας μήνυμα στο Messenger." });

  const store = chatStore();
  const prev = await store.get(`buy/${sid}`, { type: "json" });
  if (prev && prev.code) return json(200, { code: prev.code });

  let code = "";
  for (let i = 0; i < 8; i++) {
    code = newCode();
    if (!(await store.get(`code/${code}`))) break;
  }
  const now = new Date();
  const name = String((s.customer_details && s.customer_details.name) || "").trim().slice(0, 60);
  const rec = { code, name, paid: true, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + CODE_DAYS * 86400000).toISOString() };
  await store.setJSON(`code/${code}`, rec);
  await store.setJSON(`buy/${sid}`, { code });
  return json(200, { code });
};

export const config = {
  path: "/api/synomilia-buy",
  method: "POST",
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] }
};
