import { vivaReady, vivaTokenCheck } from "../lib/viva.mjs";
// /api/viva-ready: αν η IRIS είναι ρυθμισμένη. Με ?check=1 δοκιμάζει και τη σύνδεση με τη Viva (χωρίς να δείχνει κλειδιά).
export default async (req) => {
  const out = { ready: vivaReady() };
  if (new URL(req.url).searchParams.get("check") === "1" && out.ready) out.viva = await vivaTokenCheck();
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
};
export const config = { path: "/api/viva-ready" };
