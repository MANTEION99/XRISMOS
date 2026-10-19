// Ο ΠΛΗΡΩΜΕΝΟΣ χρησμός (ή η απάντηση στη 2η/3η ερώτηση) για τα εργαλεία του κοινού μηχανισμού.
// Η σελίδα ρωτά εδώ κάθε 1,5 δευτερόλεπτο. Την πρώτη φορά, αφού ελέγξει την πληρωμή στο Stripe,
// ξεκινά τη συγγραφή σε background function. Ο χρησμός γράφεται ΜΙΑ φορά και μένει αποθηκευμένος.
// Η χρέωση γίνεται οριστική μόνο όταν ο χρησμός ολοκληρωθεί· αν δεν γραφτεί σε 30 λεπτά, η δέσμευση ακυρώνεται.
//
// Απάντηση: { status: "generating" | "done" | "error" | "released" | "redirect", teaser, text, question, data }

import { json, verifyStripeSession, releasePayment } from "../lib/epistrofi-common.mjs";
import { publicData } from "../lib/oracle-tools.mjs";
import { oracleStore } from "../lib/oracle-store.mjs";

const STALE_MS = 45 * 1000;
const MAX_ATTEMPTS = 6;

const paidToolFor = (r) => r.kind === "question" ? `${r.tool}_${r.stage}` : r.tool;

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }
  const readingId = String(b.reading_id || "");
  const sessionId = String(b.session_id || "");
  if (!/^[0-9a-f-]{36}$/.test(readingId)) return json(400, { error: "Λάθος αίτημα." });

  const readings = oracleStore();
  const reading = await readings.get(readingId, { type: "json" });
  if (!reading) return json(404, { error: "Δεν βρέθηκε ο χρησμός." });

  const base = {
    teaser: reading.teaser || "", question: reading.question || "",
    data: publicData(reading.tool, reading.data), tool: reading.tool, stage: reading.stage || "q1",
    rootId: reading.rootId || reading.id
  };

  if (reading.released) return json(200, { ...base, status: "released", text: "" });

  if (reading.paidSession !== sessionId) {
    const paid = await verifyStripeSession(sessionId, paidToolFor(reading), readingId);
    if (!paid) return json(402, { error: "Δεν βρέθηκε έγκυρη πληρωμή για αυτόν τον χρησμό." });
    const pi = paid.payment_intent;
    reading.paymentIntent = pi && (pi.id || pi);
    reading.firstPaidAt = reading.firstPaidAt || Date.now();
    // Η πληρωμή κρατιέται αμέσως, ώστε και η «ανακατεύθυνση» να γνωρίζει την πληρωμή.
    reading.paidSession = sessionId;
    await readings.setJSON(readingId, reading);
  }

  if (reading.full) return json(200, { ...base, status: "done", text: reading.full });
  // Ερώτηση εκτός ορίων: δεν απαντήθηκε και δεν χρεώθηκε. Η σελίδα ζητά νέα ερώτηση.
  if (reading.redirect) return json(200, { ...base, status: "redirect", text: "", message: reading.redirect });

  const lastSign = reading.heartbeat || reading.generatingSince;
  const lastProgress = reading.progressAt || reading.generatingSince;
  const running = reading.generatingSince && Date.now() - lastSign < STALE_MS && Date.now() - lastProgress < 150 * 1000;
  if (!running && (reading.genAttempts || 0) >= MAX_ATTEMPTS) {
    if (Date.now() - (reading.firstPaidAt || Date.now()) > 30 * 60 * 1000 && reading.paymentIntent) {
      const rel = await releasePayment(reading.paymentIntent);
      await readings.setJSON(readingId, { ...reading, released: true, releasedOk: !!rel.ok, releasedAt: new Date().toISOString() });
      return json(200, { ...base, status: "released", text: "" });
    }
    if (!b.retry && Date.now() - (reading.lastAttemptAt || 0) < 10 * 60 * 1000) {
      return json(200, { ...base, status: "error", text: reading.partial || "", detail: reading.genError || "" });
    }
    reading.genAttempts = 0;
  }
  if (!running) {
    const partial = reading.partial || "";
    const genId = crypto.randomUUID();
    const progressed = partial.length > (reading.lastPartialLen || 0);
    await readings.setJSON(readingId, {
      ...reading, paidSession: sessionId, generatingSince: Date.now(), heartbeat: Date.now(), progressAt: Date.now(),
      genId, partial, genError: null,
      genAttempts: progressed ? 1 : (reading.genAttempts || 0) + 1, lastPartialLen: partial.length,
      lastAttemptAt: Date.now(), lastError: reading.genError || null
    });
    const origin = new URL(req.url).origin;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(`${origin}/.netlify/functions/oracle-full-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reading_id: readingId, session_id: sessionId, gen_id: genId }),
      signal: ctl.signal
    }).catch(e => ({ status: "aborted/" + e.name }));
    clearTimeout(timer);
    console.log(`[oracle-full] ${reading.tool}/${reading.stage} background started status=${r.status} from=${partial.length}`);
    return json(200, { ...base, status: "generating", text: partial });
  }

  return json(200, { ...base, status: "generating", text: reading.partial || "", detail: reading.lastError || "" });
};

export const config = {
  path: "/api/oracle-full",
  method: "POST"
};
