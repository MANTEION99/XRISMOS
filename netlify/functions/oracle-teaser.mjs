// Ο ΔΩΡΕΑΝ πρώτος χρησμός για τα εργαλεία του κοινού μηχανισμού (Αγάπη, Αλήθεια, Συμβατότητα,
// Οικονομικά, Αριθμολογία, Ταρώ). Υπολογίζει τα δεδομένα, γράφει το άνοιγμα με streaming και
// αποθηκεύει τα πάντα, ώστε μετά την πληρωμή η συνέχεια να γραφτεί πάνω σε αυτό.
// Ένα δωρεάν άνοιγμα ανά email και ανά εργαλείο.

import { json, normalizeEmail, isValidEmail, streamClaude, streamResponse } from "../lib/epistrofi-common.mjs";
import { TOOLS, isTool, computeData, publicData, teaserPromptFor } from "../lib/oracle-tools.mjs";

import { oracleStore, emailsStore } from "../lib/oracle-store.mjs";

const clip = (v, n) => String(v || "").trim().slice(0, n);
const nameCase = (v) => clip(v, 60).replace(/(^|\s)(\S)/g, (m, sp, c) => sp + c.toLocaleUpperCase("el"));
const dateOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }
  const tool = String(b.tool || "");
  if (!isTool(tool)) return json(400, { error: "Άγνωστο εργαλείο." });
  const t = TOOLS[tool];

  const p = {
    name1: nameCase(b.name1), dob1: clip(b.dob1, 10), tob1: clip(b.tob1, 5), pob1: clip(b.pob1, 60),
    name2: nameCase(b.name2), dob2: clip(b.dob2, 10), tob2: clip(b.tob2, 5), pob2: clip(b.pob2, 60),
    question: clip(b.question, 400)
  };
  const email = normalizeEmail(b.email);
  const marketingConsent = b.consent === true;

  // Έλεγχος στοιχείων ανά εργαλείο.
  if (!p.name1) return json(400, { error: "Γράψε το όνομά σου." });
  if (t.kind !== "taro" && !dateOk(p.dob1)) return json(400, { error: "Γράψε την ημερομηνία γέννησής σου." });
  if (t.kind === "astro2" && !p.name2) return json(400, { error: "Γράψε και το όνομα του άλλου προσώπου." });
  if (t.needDob2 && !dateOk(p.dob2)) return json(400, { error: "Χρειάζεται και η ημερομηνία γέννησης του άλλου προσώπου." });
  if (p.dob2 && !dateOk(p.dob2)) p.dob2 = "";
  if (t.needQuestion && p.question.length < 3) return json(400, { error: "Γράψε την ερώτησή σου." });
  if (!isValidEmail(email)) return json(400, { error: "Γράψε ένα σωστό email." });

  const readings = oracleStore();
  const emails = emailsStore();
  const readingId = crypto.randomUUID();
  const base = {
    id: readingId, tool, kind: "main", stage: "q1", inputs: p, email, marketingConsent,
    createdAt: new Date().toISOString()
  };

  const emailKey = `${tool}:${email}`;
  const alreadyUsed = await emails.get(emailKey);
  let data;
  try {
    data = await computeData(tool, p);
  } catch (e) {
    console.error(e);
    return json(502, { error: "Τα άστρα δεν απάντησαν αυτή τη φορά. Δοκίμασε ξανά σε λίγο." });
  }
  const pub = publicData(tool, data);
  const pubHeader = Buffer.from(JSON.stringify(pub)).toString("base64");

  if (alreadyUsed) {
    // Έχει ήδη πάρει δωρεάν άνοιγμα σε αυτό το εργαλείο: ετοιμάζεται μόνο ο πληρωμένος χρησμός.
    await readings.setJSON(readingId, { ...base, data, teaser: "" });
    return json(409, { reading_id: readingId, error: "free_used", data: pub });
  }

  await emails.set(emailKey, readingId);
  await readings.setJSON(readingId, { ...base, data, teaser: "" });

  return streamResponse(async (write) => {
    const teaser = await streamClaude(teaserPromptFor(tool, p, data), 1200, write, 110);
    await readings.setJSON(readingId, { ...base, data, teaser });
  }, { "X-Reading-Id": readingId, "X-Oracle-Data": pubHeader });
};

export const config = {
  path: "/api/oracle-teaser",
  method: "POST",
  rateLimit: { windowLimit: 4, windowSize: 60, aggregateBy: ["ip", "domain"] }
};
