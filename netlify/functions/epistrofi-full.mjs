// Ο ΠΛΗΡΩΜΕΝΟΣ χρησμός της «Επιστροφής της Χαμένης Αγάπης» (4,99€).
// Η σελίδα ρωτά αυτό το endpoint κάθε 1,5 δευτερόλεπτο. Την πρώτη φορά, αφού ελέγξει την πληρωμή
// στο Stripe, ξεκινά τη συγγραφή σε background function (έως 15 λεπτά, χωρίς όριο χρόνου απάντησης).
// Η background function αποθηκεύει το κείμενο όσο γράφεται, και εδώ επιστρέφεται ό,τι έχει γραφτεί.
// Ο χρησμός γράφεται ΜΙΑ φορά και μένει αποθηκευμένος: ανανέωση ή νέο άνοιγμα δεν χρεώνει ξανά.
//
// Απάντηση: { status: "generating" | "done" | "error", teaser, text }

import { readingsStore, json, verifyStripeSession } from "../lib/epistrofi-common.mjs";

// Αν η συγγραφή δεν έχει δώσει σημάδι ζωής για 45 δευτερόλεπτα, θεωρείται χαμένη και ξεκινά ξανά.
const STALE_MS = 45 * 1000;
const MAX_ATTEMPTS = 6;

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }
  const readingId = String(b.reading_id || "");
  const sessionId = String(b.session_id || "");
  if (!/^[0-9a-f-]{36}$/.test(readingId)) return json(400, { error: "Λάθος αίτημα." });

  const readings = readingsStore();
  const reading = await readings.get(readingId, { type: "json" });
  if (!reading) return json(404, { error: "Δεν βρέθηκε ο χρησμός." });

  // Η πληρωμή ελέγχεται στο Stripe μόνο μία φορά, μετά κρατιέται μαζί με τον χρησμό.
  if (reading.paidSession !== sessionId) {
    const paid = await verifyStripeSession(sessionId, "epistrofi", readingId);
    if (!paid) return json(402, { error: "Δεν βρέθηκε έγκυρη πληρωμή για αυτόν τον χρησμό." });
  }

  const teaser = reading.teaser || "";
  if (reading.full) return json(200, { status: "done", teaser, text: reading.full });

  // Τρέχει κανονικά αν δίνει σημάδι ζωής ΚΑΙ προχωρά: αν η ροή κόλλησε (ζωντανή αλλά χωρίς
  // νέο κείμενο για 2,5 λεπτά), θεωρείται κολλημένη και ξεκινά νέα προσπάθεια από εκεί που έμεινε.
  const lastSign = reading.heartbeat || reading.generatingSince;
  const lastProgress = reading.progressAt || reading.generatingSince;
  const running = reading.generatingSince && Date.now() - lastSign < STALE_MS && Date.now() - lastProgress < 150 * 1000;
  // Μετά από 5 αποτυχημένες προσπάθειες σταματά, αλλά μετά από 10 λεπτά ξαναδοκιμάζει από την αρχή.
  if (!running && (reading.genAttempts || 0) >= MAX_ATTEMPTS) {
    // Όταν η πελάτισσα ανανεώνει η ίδια τη σελίδα (retry), ξαναδοκιμάζουμε αμέσως.
    if (!b.retry && Date.now() - (reading.lastAttemptAt || 0) < 10 * 60 * 1000) {
      return json(200, { status: "error", teaser, text: reading.partial || "", detail: reading.genError || "" });
    }
    reading.genAttempts = 0;
  }
  if (!running) {
    // Το κείμενο που είχε ήδη γραφτεί ΚΡΑΤΙΕΤΑΙ: η νέα προσπάθεια συνεχίζει από εκεί.
    // Προσπάθεια που πρόσθεσε κείμενο δεν μετρά ως αποτυχία.
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
    // Δεν περιμένουμε τη background function: απαντά αμέσως 202, και αν αργήσει την αφήνουμε.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(`${origin}/.netlify/functions/epistrofi-full-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reading_id: readingId, session_id: sessionId, gen_id: genId }),
      signal: ctl.signal
    }).catch(e => ({ status: "aborted/" + e.name }));
    clearTimeout(timer);
    console.log(`[full] background started status=${r.status} from=${partial.length}`);
    return json(200, { status: "generating", teaser, text: partial });
  }

  return json(200, {
    status: "generating",
    teaser,
    text: reading.partial || "",
    detail: reading.lastError || ""
  });
};

export const config = {
  path: "/api/epistrofi-full",
  method: "POST"
};
