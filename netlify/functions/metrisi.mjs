// Δικός μας μετρητής επισκέψεων, χωρίς cookies και χωρίς προσωπικά δεδομένα.
// POST /api/metrisi  { t: "v"|"e", p: σελίδα, s: πηγή, e: γεγονός }  -> αυξάνει τους μετρητές της μέρας
// GET  /api/metrisi?k=ΚΛΕΙΔΙ&days=30                                 -> σύνολα ανά μέρα (μόνο με το κλειδί)
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const KEY_HASH = "a3bfa830fa037de76ee54ebe1d5320fac7d8f48d65e4629a030bee9588ad1e42";
const store = () => getStore({ name: "metrisi", consistency: "strong" });
const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const clean = (x, n) => String(x || "").toLowerCase().replace(/[^a-z0-9\/:_\-.]/g, "").slice(0, n);
const SOURCES = new Set(["tiktok", "instagram", "facebook", "google", "messenger", "youtube", "esoteriki", "agnosti", "alli"]);

function athensDay(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export default async (req) => {
  if (req.method === "POST") {
    let b; try { b = await req.json(); } catch { return json(400, { ok: false }); }
    const ua = req.headers.get("user-agent") || "";
    if (/bot|crawl|spider|preview|headless|facebookexternalhit/i.test(ua)) return json(200, { ok: true });
    const t = b.t === "e" ? "e" : "v";
    const p = clean(b.p, 40) || "/";
    const s = SOURCES.has(b.s) ? b.s : "alli";
    const e = clean(b.e, 40);
    // Για τις πληρωμές κρατάμε μόνο ένα σύντομο αποτύπωμα της πληρωμής, για να μη μετριέται δύο φορές
    const u = b.u ? createHash("sha256").update(String(b.u)).digest("hex").slice(0, 16) : "";
    const day = athensDay();
    const st = store();
    for (let i = 0; i < 3; i++) {
      const cur = await st.getWithMetadata(day, { type: "json" });
      const data = (cur && cur.data) || { v: {}, s: {}, e: {} };
      if (t === "v") { data.v[p] = (data.v[p] || 0) + 1; data.s[s] = (data.s[s] || 0) + 1; }
      else if (e) {
        if (u) { data.u = data.u || {}; if (data.u[u]) break; data.u[u] = 1; }
        data.e[e] = (data.e[e] || 0) + 1;
      }
      const opt = cur && cur.etag ? { onlyIfMatch: cur.etag } : { onlyIfNew: true };
      const r = await st.setJSON(day, data, opt);
      if (!r || r.modified !== false) break;
    }
    return json(200, { ok: true });
  }
  if (req.method === "GET") {
    const u = new URL(req.url);
    const k = u.searchParams.get("k") || "";
    if (createHash("sha256").update(k).digest("hex") !== KEY_HASH) return json(403, { error: "Λάθος κωδικός" });
    const days = Math.min(90, Math.max(1, parseInt(u.searchParams.get("days") || "30", 10)));
    const st = store(); const out = [];
    for (let i = 0; i < days; i++) {
      const d = athensDay(new Date(Date.now() - i * 86400000));
      const data = await st.get(d, { type: "json" });
      const x = data || { v: {}, s: {}, e: {} }; delete x.u;
      out.push({ day: d, ...x });
    }
    return json(200, { days: out });
  }
  return json(405, { error: "Method Not Allowed" });
};

export const config = { path: "/api/metrisi" };
