// Ετοιμάζει τη 2η ή 3η ερώτηση πάνω στον ίδιο χρησμό (ίδιοι χάρτες, αριθμοί ή χαρτιά).
// Δημιουργεί νέο έγγραφο ερώτησης που μετά πληρώνεται (2,99€ ή 1,99€) και γράφεται όπως ο χρησμός.
// Αν μια ερώτηση πήρε «ανακατεύθυνση» (υγεία, νομικά, ακατανόητη), η ίδια πληρωμή δέχεται νέα ερώτηση.
//
// Είσοδος: { parent_id, question }  ή  { reading_id, question } για νέα ερώτηση μετά από ανακατεύθυνση.
// Έξοδος: { reading_id, stage }

import { json } from "../lib/epistrofi-common.mjs";
import { oracleStore } from "../lib/oracle-store.mjs";

const clip = (v, n) => String(v || "").trim().slice(0, n);

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });
  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }
  const question = clip(b.question, 400);
  if (question.length < 3) return json(400, { error: "Γράψε την ερώτησή σου." });
  const readings = oracleStore();

  // Νέα ερώτηση στην ίδια πληρωμή, μετά από ανακατεύθυνση.
  if (b.reading_id) {
    const id = String(b.reading_id);
    if (!/^[0-9a-f-]{36}$/.test(id)) return json(400, { error: "Λάθος αίτημα." });
    const r = await readings.get(id, { type: "json" });
    if (!r || r.kind !== "question") return json(404, { error: "Δεν βρέθηκε η ερώτηση." });
    if (r.full) return json(409, { error: "Η ερώτηση έχει ήδη απαντηθεί." });
    if (!r.redirect) return json(409, { error: "Η ερώτηση γράφεται ήδη." });
    await readings.setJSON(id, {
      ...r, question, redirect: null, partial: "", genAttempts: 0, generatingSince: null, genId: null, genError: null,
      askedAt: new Date().toISOString()
    });
    return json(200, { reading_id: id, stage: r.stage });
  }

  const parentId = String(b.parent_id || "");
  if (!/^[0-9a-f-]{36}$/.test(parentId)) return json(400, { error: "Λάθος αίτημα." });
  const parent = await readings.get(parentId, { type: "json" });
  if (!parent || !parent.full) return json(404, { error: "Ο αρχικός χρησμός δεν βρέθηκε." });

  const stage = parent.kind === "question" ? (parent.stage === "q2" ? "q3" : null) : "q2";
  if (!stage) return json(409, { error: "Έχεις ήδη κάνει και τις τρεις ερωτήσεις." });

  const id = crypto.randomUUID();
  const previous = [...(parent.previous || []), parent.kind === "question" ? `Ερώτηση: ${parent.question}\nΑπάντηση: ${parent.full}` : parent.full];
  await readings.setJSON(id, {
    id, tool: parent.tool, kind: "question", stage, parentId, rootId: parent.rootId || parent.id,
    inputs: parent.inputs, data: parent.data, email: parent.email,
    previous, question, teaser: "", createdAt: new Date().toISOString()
  });
  return json(200, { reading_id: id, stage });
};

export const config = {
  path: "/api/oracle-question",
  method: "POST",
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] }
};
