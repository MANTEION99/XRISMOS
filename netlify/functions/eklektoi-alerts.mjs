// Κρυφή σελίδα του Σάββα για τις ειδοποιήσεις των Εκλεκτών (/eklektoi-admin).
// GET ?k=ΚΩΔΙΚΟΣ: όλες οι ειδοποιήσεις. POST {k, action:"run"}: έλεγχος τώρα. POST {k, action:"sent", token, key, sent}: σημείωση «στάλθηκε».
import { createHash } from "node:crypto";
import { json } from "../lib/epistrofi-common.mjs";
import { store, getMember, saveMember, validToken } from "../lib/eklektoi.mjs";
import { runAll, KEY_HASH } from "../lib/eklektoi-alerts.mjs";

const okKey = (k) => {
  k = String(k || "");
  const envKey = (process.env.METRISI_KEY || "").trim();
  return (envKey && k.trim() === envKey) || createHash("sha256").update(k).digest("hex") === KEY_HASH;
};

export default async (req) => {
  if (req.method === "GET") {
    const u = new URL(req.url);
    if (!okKey(u.searchParams.get("k"))) return json(403, { error: "Λάθος κωδικός" });
    const st = store();
    const { blobs } = await st.list({ prefix: "m:" });
    const items = [], members = [];
    for (const bl of blobs) {
      const m = await st.get(bl.key, { type: "json" });
      if (!m) continue;
      members.push({ name: (m.birth && m.birth.name) || m.name || "", email: m.email || "", hasBirth: !!m.birth, since: m.createdAt });
      for (const a of Object.values(m.alerts || {})) {
        items.push({ token: m.token, name: (m.birth && m.birth.name) || m.name || "", email: m.email || "", ...a });
      }
    }
    items.sort((a, b) => (a.sent - b.sent) || String(a.date).localeCompare(String(b.date)));
    return json(200, { lastRun: await st.get("alerts:lastRun", { type: "json" }), members, items });
  }
  if (req.method === "POST") {
    let b = {};
    try { b = await req.json(); } catch (e) {}
    if (!okKey(b.k)) return json(403, { error: "Λάθος κωδικός" });
    if (b.action === "run") return json(200, await runAll());
    if (b.action === "sent") {
      if (!validToken(b.token)) return json(400, { error: "token" });
      const m = await getMember(b.token);
      if (!m || !m.alerts || !m.alerts[b.key]) return json(404, { error: "Δεν βρέθηκε" });
      m.alerts[b.key].sent = !!b.sent; m.alerts[b.key].sentAt = b.sent ? new Date().toISOString() : null;
      await saveMember(m);
      return json(200, { ok: true });
    }
    return json(400, { error: "action" });
  }
  return json(405, { error: "Method Not Allowed" });
};

export const config = { path: "/api/eklektoi-alerts" };
