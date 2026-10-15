// Background function: γράφει τον πληρωμένο χρησμό της «Επιστροφής» χωρίς όριο χρόνου απάντησης
// (έως 15 λεπτά) και αποθηκεύει το κείμενο όσο γράφεται, ώστε η σελίδα να το δείχνει ζωντανά.
// Ξαναελέγχει την πληρωμή, γιατί η διεύθυνση είναι δημόσια.

import {
  readingsStore, verifyStripeSession, fullPrompt, skyBlock, streamClaude
} from "../lib/epistrofi-common.mjs";

export default async (req) => {
  let b;
  try { b = await req.json(); } catch { return; }
  const readingId = String(b.reading_id || "");
  const sessionId = String(b.session_id || "");
  if (!/^[0-9a-f-]{36}$/.test(readingId)) return;

  const readings = readingsStore();
  const reading = await readings.get(readingId, { type: "json" });
  if (!reading || reading.full) return;
  if (!(await verifyStripeSession(sessionId, "epistrofi", readingId))) return;

  let text = "";
  let lastSave = 0;
  let saving = Promise.resolve();
  const savePartial = (force) => {
    if (!force && Date.now() - lastSave < 1200) return;
    lastSave = Date.now();
    const snapshot = text;
    saving = saving.then(() => readings.setJSON(readingId, {
      ...reading, paidSession: sessionId, generatingSince: reading.generatingSince || Date.now(), heartbeat: Date.now(), partial: snapshot
    })).catch(e => console.error("[full-bg] save", e));
  };

  // Σημάδι ζωής κάθε 20 δευτερόλεπτα, ακόμα κι όσο το Claude δεν έχει γράψει τίποτα.
  const beat = setInterval(() => savePartial(true), 20000);
  savePartial(true);
  try {
    const hasTime1 = /^\d{2}:\d{2}$/.test(reading.inputs.tob1 || "");
    const sky = skyBlock(reading.inputs, reading.charts, hasTime1);
    const full = await streamClaude(
      fullPrompt(reading.inputs, reading.charts, reading.teaser, sky), 4000,
      (t) => { text += t; savePartial(false); }, 450
    );
    clearInterval(beat);
    await saving;
    await readings.setJSON(readingId, {
      ...reading, full, partial: null, paidSession: sessionId,
      paidAt: new Date().toISOString(), generatingSince: null, genError: null
    });
    console.log(`[full-bg] done words=${full.split(/\s+/).length}`);
  } catch (e) {
    console.error("[full-bg] failed", e);
    clearInterval(beat);
    await saving;
    await readings.setJSON(readingId, {
      ...reading, partial: text, paidSession: sessionId, generatingSince: null, genError: String(e.message || e)
    });
  }
};

export const config = { background: true };
