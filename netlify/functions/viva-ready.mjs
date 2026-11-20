import { vivaReady, vivaTokenCheck, vivaOrderCheck, vivaCreateOrder } from "../lib/viva.mjs";
// /api/viva-ready: αν η IRIS είναι ρυθμισμένη. Με ?check=1 δοκιμάζει και τη σύνδεση με τη Viva (χωρίς να δείχνει κλειδιά).
export default async (req) => {
  const out = { ready: vivaReady() };
  const c = new URL(req.url).searchParams.get("check");
  if (c === "1" && out.ready) out.viva = await vivaTokenCheck();
  if (c === "order" && out.ready) out.order = await vivaOrderCheck();
  if (c === "full" && out.ready) {
    try { out.full = await vivaCreateOrder({ tool: "check", name: "Δοκιμή", priceCents: 100, readingId: "", returnUrl: "/", src: "check" }); }
    catch (e) { out.full = "ERR " + String(e.message || e).slice(0, 300); }
  }
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
};
export const config = { path: "/api/viva-ready" };
