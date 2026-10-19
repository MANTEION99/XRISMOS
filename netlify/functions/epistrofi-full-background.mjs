// Background function: γράφει τον πληρωμένο χρησμό της «Επιστροφής» χωρίς όριο χρόνου απάντησης
// (έως 15 λεπτά) και αποθηκεύει το κείμενο όσο γράφεται, ώστε η σελίδα να το δείχνει ζωντανά.
// Ξαναελέγχει την πληρωμή, γιατί η διεύθυνση είναι δημόσια.

import {
  readingsStore, verifyStripeSession, capturePayment, fullPrompt, skyBlock, streamClaude
} from "../lib/epistrofi-common.mjs";
import textCheck from "../lib/text-check.cjs";
const { fixText, audit } = textCheck;

export default async (req) => {
  let b;
  try { b = await req.json(); } catch { return; }
  const readingId = String(b.reading_id || "");
  const sessionId = String(b.session_id || "");
  const genId = String(b.gen_id || "");
  if (!/^[0-9a-f-]{36}$/.test(readingId)) return;

  const readings = readingsStore();
  const reading = await readings.get(readingId, { type: "json" });
  if (!reading || reading.full) return;
  if (genId && reading.genId && reading.genId !== genId) return;   // έχει ήδη ξεκινήσει νεότερη προσπάθεια
  const session = await verifyStripeSession(sessionId, "epistrofi", readingId);
  if (!session) return;
  const piId = session.payment_intent && (session.payment_intent.id || session.payment_intent);

  // Αν μια προηγούμενη προσπάθεια κόπηκε, συνεχίζουμε από όσα είχαν ήδη γραφτεί.
  // Κόβεται στην τελευταία ολόκληρη πρόταση, ώστε η συνέχεια να μη «κολλήσει» σε μισή λέξη.
  const rawPrefix = reading.partial || "";
  const cut = Math.max(rawPrefix.lastIndexOf("."), rawPrefix.lastIndexOf("!"), rawPrefix.lastIndexOf(";"), rawPrefix.lastIndexOf("]"));
  const prefix = cut > 0 ? rawPrefix.slice(0, cut + 1) : "";
  let text = prefix;
  let lastSave = 0, lastLen = -1, progressAt = Date.now(), superseded = false;
  let saving = Promise.resolve();
  // Πριν από κάθε αποθήκευση ελέγχουμε ότι αυτή είναι ακόμα η τρέχουσα προσπάθεια· αν έχει ξεκινήσει
  // νεότερη, αυτή σταματά να γράφει, ώστε δύο προσπάθειες να μην πατούν η μία την άλλη.
  const stillMine = async () => {
    if (!genId) return true;
    const cur = await readings.get(readingId, { type: "json" });
    if (!cur || cur.full || (cur.genId && cur.genId !== genId)) { superseded = true; return false; }
    return true;
  };
  const savePartial = (force) => {
    if (superseded) return;
    if (!force && Date.now() - lastSave < 1200) return;
    lastSave = Date.now();
    const snapshot = fixText(text).text;
    if (snapshot.length !== lastLen) { lastLen = snapshot.length; progressAt = Date.now(); }
    const pAt = progressAt;
    saving = saving.then(async () => {
      if (!(await stillMine())) return;
      await readings.setJSON(readingId, {
        ...reading, genId: genId || reading.genId, paidSession: sessionId,
        generatingSince: reading.generatingSince || Date.now(), heartbeat: Date.now(), progressAt: pAt, partial: snapshot
      });
    }).catch(e => console.error("[full-bg] save", e));
  };

  // Σημάδι ζωής κάθε 20 δευτερόλεπτα, ακόμα κι όσο το Claude δεν έχει γράψει τίποτα.
  const beat = setInterval(() => savePartial(true), 15000);
  savePartial(true);
  try {
    const hasTime1 = /^\d{2}:\d{2}$/.test(reading.inputs.tob1 || "");
    const sky = skyBlock(reading.inputs, reading.charts, hasTime1);
    const prompt = fullPrompt(reading.inputs, reading.charts, reading.teaser, sky);
    const raw = await streamClaude(
      prompt, 4000,
      (t) => { text += t; savePartial(false); }, 450, prefix,
      (rewound) => { text = rewound; savePartial(true); }
    );
    clearInterval(beat);
    await saving;
    if (!(await stillMine())) return;
    const { text: full, fixes } = fixText(raw);
    const checks = audit(full, prompt);
    if (fixes.length || checks.length) {
      console.warn(`[full-bg] έλεγχος κειμένου: διορθώσεις=${JSON.stringify(fixes)} θέματα=${JSON.stringify(checks)}`);
    }
    await readings.setJSON(readingId, {
      ...reading, full, partial: null, paidSession: sessionId, textFixes: fixes, textChecks: checks,
      paidAt: new Date().toISOString(), generatingSince: null, genError: null
    });
    console.log(`[full-bg] done words=${full.split(/\s+/).length}`);
    // Τώρα που ο χρησμός παραδόθηκε, η δέσμευση γίνεται οριστική χρέωση.
    const cap = await capturePayment(session);
    await readings.setJSON(readingId, {
      ...(await readings.get(readingId, { type: "json" })), paymentIntent: piId, captured: !!cap.ok, capturedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error("[full-bg] failed", e);
    clearInterval(beat);
    await saving;
    if (!(await stillMine())) return;
    await readings.setJSON(readingId, {
      ...reading, genId: genId || reading.genId, partial: text, paidSession: sessionId, generatingSince: null, genError: String(e.message || e)
    });
  }
};

export const config = { background: true };
