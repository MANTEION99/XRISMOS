// Background function: γράφει το επόμενο μήνυμα του Μαντείου στη μηνιαία συνομιλία
// και το αποθηκεύει όσο γράφεται, ώστε η σελίδα να το δείχνει σταδιακά.
// Μια ερώτηση που πήρε ανακατεύθυνση (υγεία, νομικά, απόγνωση κ.λπ.) δεν μετρά στις 5.

import { streamClaude } from "../lib/epistrofi-common.mjs";
import { chatStore, chatPrompt, cleanCode, isRedirect, stripRedirect, MAX_QUESTIONS } from "../lib/synomilia.mjs";
import textCheck from "../lib/text-check.cjs";
const { fixText } = textCheck;

export default async (req) => {
  let b;
  try { b = await req.json(); } catch { return; }
  const code = cleanCode(b.code);
  const genId = String(b.gen_id || "");
  if (code.length < 4 || !genId) return;

  const store = chatStore();
  const key = `session/${code}`;
  const s = await store.get(key, { type: "json" });
  if (!s || !s.pending || s.pending.genId !== genId) return;

  const intro = s.messages.length === 0;
  const prompt = chatPrompt(s);
  let text = "", lastSave = 0, saving = Promise.resolve(), superseded = false;

  const save = (force) => {
    if (superseded || (!force && Date.now() - lastSave < 900)) return;
    lastSave = Date.now();
    const partial = stripRedirect(text);
    saving = saving.then(async () => {
      const cur = await store.get(key, { type: "json" });
      if (!cur || !cur.pending || cur.pending.genId !== genId) { superseded = true; return; }
      cur.pending.partial = isRedirect(text) ? "" : partial;
      cur.pending.heartbeat = Date.now();
      await store.setJSON(key, cur);
    }).catch(e => console.error("[synomilia] save", e));
  };
  const beat = setInterval(() => save(true), 15000);

  try {
    text = await streamClaude(prompt, intro ? 900 : 1400, (t) => { text += t; save(false); }, 0);
  } catch (e) {
    clearInterval(beat);
    await saving;
    console.error("[synomilia] γραφή", e);
    const cur = await store.get(key, { type: "json" });
    if (cur && cur.pending && cur.pending.genId === genId) {
      cur.pending = null;
      cur.lastError = "Η απάντηση δεν ολοκληρώθηκε. Πάτησε «Ξαναδοκίμασε».";
      await store.setJSON(key, cur);
    }
    return;
  }
  clearInterval(beat);
  await saving;

  const cur = await store.get(key, { type: "json" });
  if (!cur || !cur.pending || cur.pending.genId !== genId) return;
  const redirect = !intro && isRedirect(text);
  let out = stripRedirect(text);
  try { out = fixText(out).text || out; } catch {}
  cur.messages.push({ role: "oracle", text: out, redirect, at: new Date().toISOString() });
  if (!intro && !redirect) cur.used = (cur.used || 0) + 1;
  if ((cur.used || 0) >= MAX_QUESTIONS) cur.done = true;
  cur.pending = null;
  cur.lastError = null;
  await store.setJSON(key, cur);
  console.log(`[synomilia] ${code} ok used=${cur.used} redirect=${redirect}`);
};
