// Πληρωμές μέσω Viva (για IRIS, και ό,τι άλλο δείχνει το Smart Checkout της Viva).
// Μεταβλητές στο Netlify: VIVA_CLIENT_ID, VIVA_CLIENT_SECRET, VIVA_SOURCE_CODE, και VIVA_ENV=demo όσο δοκιμάζουμε.
// Στη Viva, στην πηγή πληρωμών (Source) του manteio.live: Success URL και Failure URL = /api/viva-return
import { getStore } from "@netlify/blobs";

const demo = () => (process.env.VIVA_ENV || "").toLowerCase() === "demo";
const H = () => demo()
  ? { accounts: "https://demo-accounts.vivapayments.com", api: "https://demo-api.vivapayments.com", web: "https://demo.vivapayments.com" }
  : { accounts: "https://accounts.vivapayments.com", api: "https://api.vivapayments.com", web: "https://www.vivapayments.com" };

export const vivaReady = () => !!(process.env.VIVA_CLIENT_ID && process.env.VIVA_CLIENT_SECRET && process.env.VIVA_SOURCE_CODE);
// Strong όπου υποστηρίζεται (functions v2). Στις παλιές lambda (create-checkout, epistrofi-agora) δεν υποστηρίζεται, οπότε πέφτουμε σε κανονική.
const isStrongErr = (e) => /strong consistency|uncachedEdgeURL/i.test(String(e && e.message || e));
export const vivaOrders = () => {
  const strong = getStore({ name: "viva-orders", consistency: "strong" });
  const plain = () => getStore({ name: "viva-orders" });
  const wrap = (fn) => async (...a) => { try { return await strong[fn](...a); } catch (e) { if (isStrongErr(e)) return plain()[fn](...a); throw e; } };
  return { get: wrap("get"), setJSON: wrap("setJSON") };
};

export async function vivaOrderCheck() {
  try {
    const t = await token();
    const r = await fetch(`${H().api}/checkout/v2/orders`, { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 100, customerTrns: "Δοκιμή", merchantTrns: "check", sourceCode: String(process.env.VIVA_SOURCE_CODE || "").trim(), paymentTimeout: 300 }) });
    const txt = await r.text();
    return r.ok && /orderCode/.test(txt) ? "ok" : `order ${r.status} ${txt.slice(0, 300)}`;
  } catch (e) { return String(e.message || e); }
}

export async function vivaTokenCheck() { try { await token(); return "ok"; } catch (e) { return String(e.message || e); } }

async function token() {
  // Δοκιμάζουμε το Client ID όπως μπήκε στο Netlify και, αν δεν περάσει, με/χωρίς την κατάληξη .apps.vivapayments.com
  const raw = String(process.env.VIVA_CLIENT_ID || "").trim();
  const sec = String(process.env.VIVA_CLIENT_SECRET || "").trim();
  const suf = ".apps.vivapayments.com";
  const ids = [...new Set([raw, raw.endsWith(suf) ? raw.slice(0, -suf.length) : raw + suf])].filter(Boolean);
  let last = "";
  for (const cid of ids) {
    const r = await fetch(`${H().accounts}/connect/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${cid}:${sec}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials"
    });
    const d = await r.json().catch(() => ({}));
    if (d.access_token) return d.access_token;
    last = `Viva token: ${r.status} ${d.error || ""} ${d.error_description || ""}`.trim();
  }
  throw new Error(last || "Viva token: no client id");
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
      sourceCode: String(process.env.VIVA_SOURCE_CODE || "").trim(),
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
  // Η Viva μπορεί να χρεώσει στρογγυλεμένο ποσό (π.χ. 5,00€ αντί για 4,99€): δεχόμαστε ίσο ή έως 10 λεπτά παραπάνω, ποτέ λιγότερο.
  const paidCents = Math.round(Number(d.amount) * 100);
  const ok = d.statusId === "F" && String(d.orderCode) === String(orderCode) && paidCents >= rec.amount && paidCents <= rec.amount + 10;
  if (ok) {
    Object.assign(rec, { paid: true, transactionId, paidCents, email: d.email || "", fullName: d.fullName || "", paidAt: new Date().toISOString() });
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
