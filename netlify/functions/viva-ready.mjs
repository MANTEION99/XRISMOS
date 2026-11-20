import { vivaReady, vivaTokenCheck, vivaOrderCheck } from "../lib/viva.mjs";
// /api/viva-ready: αν η IRIS είναι ρυθμισμένη. Με ?check=1 δοκιμάζει και τη σύνδεση με τη Viva (χωρίς να δείχνει κλειδιά).
export default async (req) => {
  const out = { ready: vivaReady() };
  const c = new URL(req.url).searchParams.get("check");
  if (c === "1" && out.ready) out.viva = await vivaTokenCheck();
  if (c === "order" && out.ready) out.order = await vivaOrderCheck();
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
};
export const config = { path: "/api/viva-ready" };
