// Η σελίδα των Εκλεκτών του Μαντείου: εγγραφή μετά την πληρωμή, στοιχεία μέλους, τυχερές μέρες, διαχείριση συνδρομής.
import { json, isAdult, ADULTS_ONLY } from "../lib/epistrofi-common.mjs";
import { store, getMember, saveMember, subStatus, stripeGet, monthKey, validToken } from "../lib/eklektoi.mjs";
import { computeWeek } from "../lib/tyxeres.mjs";

const clip = (v, n) => String(v || "").trim().slice(0, n);
const DEMO = { name: "Σάββας", dob: "1980-08-15", tob: "10:30", pob: "Αθήνα" };

function slimWeek(d) {
  return {
    week: d.week,
    days: d.days.map(x => ({ date: x.date, label: x.label, tier: x.tier, best: !!x.best, why: x.astro.why, cat: x.astro.cat, num: x.num.n, numText: x.num.text, card: x.card && (x.card.name || x.card.title || "") }))
  };
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });
  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }
  const action = String(b.action || "");

  // Δείγμα της σελίδας (για προεπισκόπηση), χωρίς μέλος.
  if (action === "demo") {
    try { return json(200, { week: slimWeek(await computeWeek(DEMO)) }); } catch { return json(500, { error: "Δοκίμασε ξανά." }); }
  }

  // Μετά την πληρωμή της συνδρομής: δημιουργεί (μία φορά) το προσωπικό κλειδί του μέλους.
  if (action === "join") {
    const sid = String(b.sid || "");
    if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) return json(400, { error: "Λάθος αίτημα." });
    const st = store();
    const prev = await st.get("sid:" + sid, { type: "json" });
    if (prev && prev.token) return json(200, { token: prev.token });
    const s = await stripeGet(`checkout/sessions/${sid}`);
    if (s.mode !== "subscription" || s.status !== "complete" || !s.subscription) return json(402, { error: "Δεν βρέθηκε ολοκληρωμένη συνδρομή." });
    const token = crypto.randomUUID().replace(/-/g, "");
    await saveMember({
      token, sub: s.subscription, customer: s.customer, email: (s.customer_details && s.customer_details.email) || "",
      name: clip(s.customer_details && s.customer_details.name, 60),
      createdAt: new Date().toISOString(), credits: {}, firstTool: (s.metadata && s.metadata.tool) || "", firstReading: (s.metadata && s.metadata.reading_id) || ""
    });
    await st.setJSON("sid:" + sid, { token });
    return json(200, { token });
  }

  const m = await getMember(b.token);
  if (!m) return json(404, { error: "Δεν βρέθηκε η συνδρομή σου." });

  if (action === "me") {
    const st = await subStatus(m);
    const mk = monthKey();
    return json(200, {
      active: st.active, status: st.status, cancelAt: st.cancelAt, periodEnd: st.periodEnd, email: m.email,
      creditUsed: !!(m.credits || {})[mk], creditTool: (m.creditTools || {})[mk] || "", birth: m.birth || null,
      name: (m.birth && m.birth.name) || m.name || "", photo: m.photo || "", since: m.createdAt
    });
  }

  if (action === "birth") {
    const p = { name: clip(b.name, 60), dob: clip(b.dob, 10), tob: clip(b.tob, 5), pob: clip(b.pob, 60) };
    if (!p.name || !/^\d{4}-\d{2}-\d{2}$/.test(p.dob)) return json(400, { error: "Γράψε όνομα και ημερομηνία γέννησης." });
    if (p.tob && !/^\d{2}:\d{2}$/.test(p.tob)) p.tob = "";
    if (!isAdult(p.dob)) return json(403, { error: ADULTS_ONLY });
    m.birth = p; await saveMember(m);
    return json(200, { ok: true });
  }

  // Φωτογραφία προφίλ: μικρή εικόνα (μικραίνει στο κινητό πριν σταλεί), έως περίπου 150KB.
  if (action === "photo") {
    const img = String(b.img || "");
    if (img === "") { delete m.photo; await saveMember(m); return json(200, { ok: true }); }
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > 200000) return json(400, { error: "Η φωτογραφία δεν ανέβηκε. Δοκίμασε μια άλλη." });
    m.photo = img; await saveMember(m);
    return json(200, { ok: true });
  }

  if (action === "week") {
    const st = await subStatus(m);
    if (!st.active) return json(402, { error: "Η συνδρομή σου δεν είναι ενεργή." });
    if (!m.birth) return json(400, { error: "Λείπουν τα στοιχεία γέννησης." });
    try { return json(200, { week: slimWeek(await computeWeek(m.birth, new Date(), b.mode === "next" ? "next" : "today")) }); }
    catch (e) { console.error("[eklektoi] week", e); return json(500, { error: "Δοκίμασε ξανά σε λίγο." }); }
  }

  if (action === "portal") {
    const origin = new URL(req.url).origin;
    const r = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: `customer=${encodeURIComponent(m.customer)}&return_url=${encodeURIComponent(origin + "/eklektoi")}`
    });
    const d = await r.json().catch(() => ({}));
    if (!d.url) { console.error("[eklektoi] portal", JSON.stringify(d.error || {}).slice(0, 200)); return json(500, { error: "Η διαχείριση της συνδρομής δεν άνοιξε. Στείλε μήνυμα στο Μαντείο." }); }
    return json(200, { url: d.url });
  }

  return json(400, { error: "Λάθος αίτημα." });
};

export const config = { path: "/api/eklektoi", method: "POST", rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] } };
