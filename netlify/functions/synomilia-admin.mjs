// Διαχείριση των κωδικών της μηνιαίας συνομιλίας (μόνο για τον διαχειριστή).
// Κλειδί πρόσβασης: η μεταβλητή περιβάλλοντος CHAT_ADMIN_KEY στο Netlify.
// { key, action: "create", name }   νέος κωδικός για μια συνδρομήτρια
// { key, action: "list" }           όλοι οι κωδικοί με την κατάστασή τους
// { key, action: "revoke", code }   ακυρώνει έναν κωδικό

import { chatStore, newCode, cleanCode, json, CODE_DAYS, MAX_QUESTIONS } from "../lib/synomilia.mjs";

function sameKey(a, b) {
  a = String(a || ""); b = String(b || "");
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });
  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }
  const admin = process.env.CHAT_ADMIN_KEY;
  if (!admin) return json(500, { error: "Λείπει το CHAT_ADMIN_KEY στις ρυθμίσεις του Netlify." });
  if (!sameKey(b.key, admin)) return json(401, { error: "Λάθος κλειδί διαχείρισης." });

  const store = chatStore();
  const action = String(b.action || "list");

  if (action === "create") {
    const name = String(b.name || "").trim().slice(0, 60);
    if (name.length < 2) return json(400, { error: "Γράψε το όνομα της συνδρομήτριας." });
    let code = "";
    for (let i = 0; i < 5; i++) {
      code = newCode();
      if (!(await store.get(`code/${code}`))) break;
    }
    const now = new Date();
    const rec = { code, name, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + CODE_DAYS * 86400000).toISOString() };
    await store.setJSON(`code/${code}`, rec);
    return json(200, rec);
  }

  if (action === "revoke") {
    const code = cleanCode(b.code);
    const rec = await store.get(`code/${code}`, { type: "json" });
    if (!rec) return json(404, { error: "Δεν βρέθηκε." });
    await store.setJSON(`code/${code}`, { ...rec, revoked: true });
    return json(200, { ok: true });
  }

  if (action === "list") {
    const { blobs } = await store.list({ prefix: "code/" });
    const rows = await Promise.all(blobs.map(async ({ key }) => {
      const rec = await store.get(key, { type: "json" });
      if (!rec) return null;
      const s = await store.get(`session/${rec.code}`, { type: "json" });
      const status = rec.revoked ? "ακυρώθηκε"
        : Date.now() > Date.parse(rec.expiresAt) ? "έληξε"
        : !s ? "δεν μπήκε ακόμα"
        : s.done ? "ολοκληρώθηκε"
        : `σε εξέλιξη ${s.used || 0}/${MAX_QUESTIONS}`;
      return { ...rec, status, person: s && s.profile ? s.profile.name1 : "" };
    }));
    return json(200, { codes: rows.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  }

  return json(400, { error: "Λάθος αίτημα." });
};

export const config = {
  path: "/api/synomilia-admin",
  method: "POST",
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] }
};
