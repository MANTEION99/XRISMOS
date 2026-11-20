// Η Viva στέλνει εδώ την πελάτισσα μετά την πληρωμή (?t=transactionId&s=orderCode).
// Επαληθεύουμε και τη γυρίζουμε στο εργαλείο με session_id=vv_<orderCode>, όπως κάνει και το Stripe.
import { vivaConfirm } from "../lib/viva.mjs";

export default async (req) => {
  const u = new URL(req.url);
  const t = u.searchParams.get("t") || "", s = (u.searchParams.get("s") || "").replace(/\D/g, "");
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
