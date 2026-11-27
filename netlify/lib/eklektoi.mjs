// «Οι Εκλεκτοί του Μαντείου»: μηνιαία συνδρομή μέσω Stripe (μόνο κάρτα).
// Κάθε μέλος έχει ένα προσωπικό κλειδί (token). Με αυτό παίρνει μία ερώτηση τον μήνα σε μία από τις 8 υπηρεσίες,
// βλέπει τις τυχερές μέρες της εβδομάδας στη σελίδα του και διαχειρίζεται/ακυρώνει τη συνδρομή στο Stripe.
import { getStore } from "@netlify/blobs";

export const PRICE_CENTS = 1290;
export const NAME = "Οι Εκλεκτοί του Μαντείου";
export const Q1_TOOLS = ["epistrofi", "agapi", "alitheia", "symvatotita", "oikonomika", "erotima", "numerology", "taro"];
export const store = () => getStore({ name: "eklektoi", consistency: "strong" });
export const validToken = (t) => /^[0-9a-f]{32}$/.test(String(t || ""));
export const monthKey = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit" }).format(d).slice(0, 7);

export async function stripeGet(path) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } });
  return r.json().catch(() => ({}));
}

export async function getMember(token) {
  if (!validToken(token)) return null;
  return store().get("m:" + token, { type: "json" });
}
export async function saveMember(m) { await store().setJSON("m:" + m.token, m); }

// Ενεργή συνδρομή: active ή trialing (και past_due όσο το Stripe ξαναπροσπαθεί τη χρέωση).
export async function subStatus(m) {
  if (!m || !m.sub) return { active: false, status: "none" };
  const s = await stripeGet(`subscriptions/${m.sub}`);
  const status = s.status || "unknown";
  return { active: ["active", "trialing", "past_due"].includes(status), status, cancelAt: s.cancel_at_period_end ? s.current_period_end : null, periodEnd: s.current_period_end || null };
}

// Η ερώτηση του μήνα. Επιστρέφει ψεύτικη «πληρωμένη» συνεδρία για τον μηχανισμό του χρησμού, χωρίς χρέωση.
// Μία ερώτηση ανά ημερολογιακό μήνα (ώρα Ελλάδας). Ο ίδιος χρησμός μπορεί να ξαναελεγχθεί όσες φορές χρειαστεί.
export async function claimCredit(sessionId, tool, readingId) {
  const token = String(sessionId).slice(3);
  if (!Q1_TOOLS.includes(tool) || !/^[0-9a-f-]{36}$/.test(String(readingId || ""))) return null;
  const m = await getMember(token);
  if (!m) return null;
  m.credits = m.credits || {};
  const used = Object.values(m.credits).includes(readingId);
  if (!used) {
    const st = await subStatus(m);
    if (!st.active) return null;
    const mk = monthKey();
    if (m.credits[mk]) return null;
    m.credits[mk] = readingId;
    m.creditTools = { ...(m.creditTools || {}), [mk]: tool };
    await saveMember(m);
  }
  return { id: sessionId, member: true, metadata: { tool, reading_id: readingId }, payment_intent: null, payment_status: "paid" };
}
