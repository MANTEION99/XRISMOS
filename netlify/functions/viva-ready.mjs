import { vivaReady } from "../lib/viva.mjs";
export default async () => new Response(JSON.stringify({ ready: vivaReady() }), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });
export const config = { path: "/api/viva-ready" };
