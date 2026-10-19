// Background function: γράφει τον πληρωμένο χρησμό ή την απάντηση στη 2η/3η ερώτηση χωρίς όριο
// χρόνου απάντησης (έως 15 λεπτά) και αποθηκεύει το κείμενο όσο γράφεται.
// Ξαναελέγχει την πληρωμή, γιατί η διεύθυνση είναι δημόσια. Χρεώνει οριστικά μόνο στο τέλος.

import { verifyStripeSession, capturePayment, streamClaude } from "../lib/epistrofi-common.mjs";
import { fullPromptFor, questionPromptFor } from "../lib/oracle-tools.mjs";
import { oracleStore } from "../lib/oracle-store.mjs";
import textCheck from "../lib/text-check.cjs";
const { fixText, audit } = textCheck;

const REDIRECT = /\[\s*ΑΝΑΚΑΤΕΥΘΥΝΣΗ\s*\]/;
const paidToolFor = (r) => r.kind === "question" ? `${r.tool}_${r.stage}` : r.tool;

export default async (req) => {
  let b;
  try { b = await req.json(); } catch { return; }
  const readingId = String(b.reading_id || "");
  const sessionId = String(b.session_id || "");
  const genId = String(b.gen_id || "");
  if (!/^[0-9a-f-]{36}$/.test(readingId)) return;

  const readings = oracleStore();
  const reading = await readings.get(readingId, { type: "json" });
  if (!reading || reading.full || reading.redirect) return;
  if (genId && reading.genId && reading.genId !== genId) return;
  const session = await verifyStripeSession(sessionId, paidToolFor(reading), readingId);
  if (!session) return;
  const piId = session.payment_intent && (session.payment_intent.id || session.payment_intent);

  const isQuestion = reading.kind === "question";
  const prompt = isQuestion
    ? questionPromptFor(reading.tool, reading.inputs, reading.data, reading.previous || [], reading.question, reading.stage)
    : fullPromptFor(reading.tool, reading.inputs, reading.data, reading.teaser || "");
  const maxTokens = isQuestion ? 1500 : 4000;
  // Οι απαντήσεις σε ερωτήσεις είναι σύντομες (και η ανακατεύθυνση ακόμα πιο σύντομη), οπότε εκεί δεν ζητάμε ελάχιστο μήκος.
  const minWords = isQuestion ? 0 : 380;

  const rawPrefix = reading.partial || "";
  const cut = Math.max(rawPrefix.lastIndexOf("."), rawPrefix.lastIndexOf("!"), rawPrefix.lastIndexOf(";"), rawPrefix.lastIndexOf("]"));
  const prefix = cut > 0 ? rawPrefix.slice(0, cut + 1) : "";
  let text = prefix;
  let lastSave = 0, lastLen = -1, progressAt = Date.now(), superseded = false;
  let saving = Promise.resolve();
  const stillMine = async () => {
    if (!genId) return true;
    const cur = await readings.get(readingId, { type: "json" });
    if (!cur || cur.full || cur.redirect || (cur.genId && cur.genId !== genId)) { superseded = true; return false; }
    return true;
  };
  const savePartial = (force) => {
    if (superseded) return;
    if (!force && Date.now() - lastSave < 1200) return;
    lastSave = Date.now();
    // Η σελίδα δεν πρέπει να δείξει ποτέ την ένδειξη της ανακατεύθυνσης ως κείμενο χρησμού.
    // Διορθώνεται και όσο γράφεται, ώστε η πελάτισσα να μη δει ποτέ λάθος μέρα της εβδομάδας.
    const snapshot = REDIRECT.test(text) ? "" : fixText(text).text;
    if (snapshot.length !== lastLen) { lastLen = snapshot.length; progressAt = Date.now(); }
    const pAt = progressAt;
    saving = saving.then(async () => {
      if (!(await stillMine())) return;
      await readings.setJSON(readingId, {
        ...reading, genId: genId || reading.genId, paidSession: sessionId,
        generatingSince: reading.generatingSince || Date.now(), heartbeat: Date.now(), progressAt: pAt, partial: snapshot
      });
    }).catch(e => console.error("[oracle-bg] save", e));
  };

  const beat = setInterval(() => savePartial(true), 15000);
  savePartial(true);
  try {
    const raw = await streamClaude(prompt, maxTokens, (t) => { text += t; savePartial(false); },
      minWords, prefix, (rewound) => { text = rewound; savePartial(true); }).catch(e => {
        // Μια ανακατεύθυνση είναι σύντομη από τη φύση της· δεν είναι αποτυχία.
        if (isQuestion && REDIRECT.test(text)) return text;
        throw e;
      });
    clearInterval(beat);
    await saving;
    if (!(await stillMine())) return;

    const { text: full, fixes } = fixText(raw);
    const checks = audit(full, prompt);
    if (fixes.length || checks.length) {
      console.warn(`[oracle-bg] ${reading.tool}/${reading.stage} έλεγχος κειμένου: διορθώσεις=${JSON.stringify(fixes)} θέματα=${JSON.stringify(checks)}`);
    }

    if (isQuestion && REDIRECT.test(full)) {
      const message = full.replace(REDIRECT, "").trim();
      await readings.setJSON(readingId, {
        ...reading, redirect: message || "Γι' αυτό το θέμα δεν παίρνουμε τη θέση ειδικού.",
        partial: null, generatingSince: null, genError: null, paidSession: sessionId, paymentIntent: piId
      });
      console.log(`[oracle-bg] ${reading.tool}/${reading.stage} redirect, χωρίς χρέωση`);
      return;
    }

    await readings.setJSON(readingId, {
      ...reading, full, partial: null, paidSession: sessionId, textFixes: fixes, textChecks: checks,
      paidAt: new Date().toISOString(), generatingSince: null, genError: null
    });
    console.log(`[oracle-bg] ${reading.tool}/${reading.stage} done words=${full.split(/\s+/).length}`);
    const cap = await capturePayment(session);
    await readings.setJSON(readingId, {
      ...(await readings.get(readingId, { type: "json" })), paymentIntent: piId, captured: !!cap.ok, capturedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error("[oracle-bg] failed", e);
    clearInterval(beat);
    await saving;
    if (!(await stillMine())) return;
    await readings.setJSON(readingId, {
      ...reading, genId: genId || reading.genId, partial: REDIRECT.test(text) ? "" : text, paidSession: sessionId, generatingSince: null, genError: String(e.message || e)
    });
  }
};

export const config = { background: true };
