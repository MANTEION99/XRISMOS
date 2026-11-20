// Πληρωμές μέσω Viva (για IRIS, και ό,τι άλλο δείχνει το Smart Checkout της Viva).
// Μεταβλητές στο Netlify: VIVA_CLIENT_ID, VIVA_CLIENT_SECRET, VIVA_SOURCE_CODE, και VIVA_ENV=demo όσο δοκιμάζουμε.
// Στη Viva, στην πηγή πληρωμών (Source) του manteio.live: Success URL και Failure URL = /api/viva-return
import { getStore } from "@netlify/blobs";

const demo = () => (process.env.VIVA_ENV || "").toLowerCase() === "demo";
const H = () => demo()
  ? { accounts: "https://demo-accounts.vivapayments.com", api: "https://demo-api.vivapayments.com", web: "https://demo.vivapayments.com" }
  : { accounts: "https://accounts.vivapayments.com", api: "https://api.vivapayments.com", web: "https://www.vivapayments.com" };

export const vivaReady = () => !!(process.env.VIVA_CLIENT_ID && process.env.VIVA_CLIENT_SECRET && process.env.VIVA_SOURCE_CODE);
export const vivaOrders = () => getStore({ name: "viva-orders", consistency: "strong" });

export async function vivaTokenCheck() { try { await token(); return "ok"; } catch (e) { return String(e.message || e); } }

async function token() {
  // Το Client ID της Viva τελειώνει σε ".apps.vivapayments.com". Αν μπήκε χωρίς αυτό στο Netlify, το προσθέτουμε εδώ.
  let cid = String(process.env.VIVA_CLIENT_ID || "").trim();
  if (cid && !cid.includes(".")) cid += ".apps.vivapayments.com";
  const auth = Buffer.from(`${cid}:${String(process.env.VIVA_CLIENT_SECRET || "").trim()}`).toString("base64");
  const r = await fetch(`${H().accounts}/connect/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  const d = await r.json().catch(() => ({}));
  if (!d.access_token) throw new Error("Viva token: " + r.status);
  return d.access_token;
}

// Δημιουργεί παραγγελία και επιστρέφει τη διεύθυνση της σελίδας πληρωμής της Viva.
export async function vivaCreateOrder({ tool, name, priceCents, readingId, returnUrl, src }) {
  const t = await token();
  const r = await fetch(`${H().api}/checkout/v2/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: priceCents,
      customerTrns: name,
      merchantTrns: `${tool}${readingId ? " " + readingId : ""}`.slice(0, 100),
      sourceCode: process.env.VIVA_SOURCE_CODE,
      paymentTimeout: 1800,
      disableExactAmount: true,
      allowRecurring: false
    })
  });
  const d = await r.json().catch(() => ({}));
  if (!d.orderCode) throw new Error("Viva order: " + r.status + " " + JSON.stringify(d).slice(0, 200));
  const orderCode = String(d.orderCode);
  await vivaOrders().setJSON(orderCode, { orderCode, tool, readingId: readingId || "", returnUrl, src: src || "", amount: priceCents, paid: false, createdAt: new Date().toISOString() });
  return `${H().web}/web/checkout?ref=${orderCode}&color=8C6420`;
}

// Επαληθεύει στη Viva ότι η συναλλαγή ολοκληρώθηκε, για αυτή την παραγγελία και αυτό το ποσό.
export async function vivaConfirm(transactionId, orderCode) {
  const st = vivaOrders();
  const rec = await st.get(String(orderCode), { type: "json" });
  if (!rec) return { rec: null, ok: false };
  if (rec.paid) return { rec, ok: true };
  if (!/^[0-9a-f-]{36}$/i.test(String(transactionId || ""))) return { rec, ok: false };
  const t = await token();
  const r = await fetch(`${H().api}/checkout/v2/transactions/${transactionId}`, { headers: { Authorization: `Bearer ${t}` } });
  const d = await r.json().catch(() => ({}));
  const ok = d.statusId === "F" && String(d.orderCode) === String(orderCode) && Math.round(Number(d.amount) * 100) === rec.amount;
  if (ok) {
    Object.assign(rec, { paid: true, transactionId, email: d.email || "", fullName: d.fullName || "", paidAt: new Date().toISOString() });
    await st.setJSON(String(orderCode), rec);
  } else {
    console.error("[viva] not confirmed", orderCode, d.statusId, d.amount);
  }
  return { rec, ok };
}

// Για τον υπόλοιπο κώδικα: η πληρωμή της Viva μοιάζει με «session» του Stripe με id vv_<orderCode>.
export async function vivaSession(sessionId, tool, readingId) {
  const m = /^vv_(\d{6,20})$/.exec(String(sessionId || ""));
  if (!m) return null;
  const rec = await vivaOrders().get(m[1], { type: "json" });
  if (!rec || !rec.paid) return null;
  if (tool && rec.tool !== tool) return null;
  if (readingId && rec.readingId !== readingId) return null;
  return { id: sessionId, viva: true, payment_status: "paid", payment_intent: null,
    metadata: { tool: rec.tool, reading_id: rec.readingId, src: rec.src },
    customer_details: { name: rec.fullName || "", email: rec.email || "" } };
}
