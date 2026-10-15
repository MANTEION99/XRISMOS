// Ο ΔΩΡΕΑΝ πρώτος χρησμός της «Επιστροφής της Χαμένης Αγάπης».
// Υπολογίζει τους χάρτες, γράφει το άνοιγμα με streaming και αποθηκεύει τα πάντα,
// ώστε μετά την πληρωμή η συνέχεια να γραφτεί πάνω σε αυτό.
// Ένα δωρεάν δείγμα ανά email. Αν το email το έχει ήδη χρησιμοποιήσει, ετοιμάζεται
// μόνο ο πληρωμένος χρησμός, χωρίς δωρεάν άνοιγμα.

import {
  readingsStore, emailsStore, json, normalizeEmail, isValidEmail,
  computeCharts, teaserPrompt, streamClaude, streamResponse
} from "../lib/epistrofi-common.mjs";

const clip = (v, n) => String(v || "").trim().slice(0, n);
// Κεφαλαίο το πρώτο γράμμα κάθε λέξης του ονόματος (maria → Maria, μαρία → Μαρία).
const nameCase = (v) => clip(v, 40).replace(/(^|\s)(\S)/g, (m, sp, c) => sp + c.toLocaleUpperCase("el"));

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }

  const p = {
    name1: nameCase(b.name1), dob1: clip(b.dob1, 10), tob1: clip(b.tob1, 5), pob1: clip(b.pob1, 60),
    lat1: b.lat1, lon1: b.lon1, tzone1: b.tzone1,
    name2: nameCase(b.name2), dob2: clip(b.dob2, 10), tob2: clip(b.tob2, 5), pob2: clip(b.pob2, 60),
    lat2: b.lat2, lon2: b.lon2, tzone2: b.tzone2
  };
  const email = normalizeEmail(b.email);
  const marketingConsent = b.consent === true;

  const dateOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!p.name1 || !p.name2 || !dateOk(p.dob1) || (p.dob2 && !dateOk(p.dob2))) {
    return json(400, { error: "Συμπλήρωσε τα δύο ονόματα και τη δική σου ημερομηνία γέννησης." });
  }
  if (!isValidEmail(email)) {
    return json(400, { error: "Γράψε ένα σωστό email." });
  }

  const readings = readingsStore();
  const emails = emailsStore();
  const readingId = crypto.randomUUID();
  const base = {
    id: readingId, tool: "epistrofi", inputs: p, email, marketingConsent,
    createdAt: new Date().toISOString()
  };

  const alreadyUsed = await emails.get(email);
  let charts;
  try {
    charts = await computeCharts(p);
  } catch (e) {
    console.error(e);
    return json(502, { error: "Ο ουρανός δεν απάντησε αυτή τη φορά. Δοκίμασε ξανά σε λίγο." });
  }

  if (alreadyUsed) {
    // Έχει ήδη πάρει δωρεάν δείγμα: δεν γράφουμε νέο, ετοιμάζουμε μόνο τον πληρωμένο.
    await readings.setJSON(readingId, { ...base, charts, teaser: "" });
    return json(409, { reading_id: readingId, error: "free_used" });
  }

  await emails.set(email, readingId);
  // Αποθηκεύεται αμέσως, ώστε ακόμα κι αν διακοπεί η σύνδεση, ο πληρωμένος χρησμός να μπορεί να γραφτεί.
  await readings.setJSON(readingId, { ...base, charts, teaser: "" });

  return streamResponse(async (write) => {
    const teaser = await streamClaude(teaserPrompt(p, charts), 1200, write, 110);
    await readings.setJSON(readingId, { ...base, charts, teaser });
  }, { "X-Reading-Id": readingId });
};

export const config = {
  path: "/api/epistrofi-teaser",
  method: "POST",
  rateLimit: { windowLimit: 4, windowSize: 60, aggregateBy: ["ip", "domain"] }
};
