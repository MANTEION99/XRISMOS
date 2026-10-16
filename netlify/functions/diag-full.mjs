// ΠΡΟΣΩΡΙΝΟ, μόνο για την προεπισκόπηση: δοκιμάζει την ίδια ερώτηση του πληρωμένου χρησμού στο Claude
// χωρίς streaming και δείχνει τι απαντά (λόγος τερματισμού, είδη περιεχομένου, αρχή κειμένου).
import { readingsStore, fullPrompt, skyBlock, MODEL } from "../lib/epistrofi-common.mjs";

export default async (req) => {
  const url = new URL(req.url);
  if (!url.hostname.includes("deploy-preview")) return new Response("not here", { status: 404 });
  const rid = url.searchParams.get("rid") || "";
  const reading = await readingsStore().get(rid, { type: "json" });
  if (!reading) return new Response("no reading", { status: 404 });
  const hasTime1 = /^\d{2}:\d{2}$/.test(reading.inputs.tob1 || "");
  const prompt = fullPrompt(reading.inputs, reading.charts, reading.teaser, skyBlock(reading.inputs, reading.charts, hasTime1));
  const t0 = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: "user", content: prompt }] })
  });
  const data = await res.json().catch(() => ({}));
  return new Response(JSON.stringify({
    http: res.status, ms: Date.now() - t0, prompt_chars: prompt.length,
    stop_reason: data.stop_reason, types: (data.content || []).map(b => b.type), usage: data.usage, error: data.error,
    text: (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").slice(0, 400),
    state: { genAttempts: reading.genAttempts, genError: reading.genError, lastError: reading.lastError,
      partialLen: (reading.partial || "").length, heartbeatAgo: reading.heartbeat ? Math.round((Date.now() - reading.heartbeat) / 1000) : null,
      progressAgo: reading.progressAt ? Math.round((Date.now() - reading.progressAt) / 1000) : null, full: !!reading.full }
  }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};

export const config = { path: "/api/diag-full" };
