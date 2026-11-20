// Η Viva στέλνει εδώ την πελάτισσα μετά την πληρωμή (?t=transactionId&s=orderCode).
// Επαληθεύουμε και τη γυρίζουμε στο εργαλείο με session_id=vv_<orderCode>, όπως κάνει και το Stripe.
import { vivaConfirm } from "../lib/viva.mjs";

export default async (req) => {
  const u = new URL(req.url);
  // Ανθεκτικό αν η Viva κολλήσει τις παραμέτρους με δεύτερο «?» (π.χ. ?ok=1?t=...&s=...)
  const raw = decodeURIComponent(u.search || "");
  const pick = (k) => u.searchParams.get(k) || ((raw.match(new RegExp("[?&]" + k + "=([^&?#]*)")) || [])[1] || "");
  const t = pick("t"), s = pick("s").replace(/\D/g, "");
  let target = "/";
  try {
    const { rec, ok } = await vivaConfirm(t, s);
    if (rec && rec.returnUrl) {
      const ru = new URL(rec.returnUrl, u.origin);
      if (ru.host !== u.host) ru.href = u.origin + "/";
      if (ok) ru.searchParams.set("session_id", "vv_" + s); else ru.searchParams.set("pay", "fail");
      target = ru.pathname + ru.search;
    }
  } catch (e) { console.error("[viva-return]", e.message); }
  return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store" } });
};

export const config = { path: "/api/viva-return" };
