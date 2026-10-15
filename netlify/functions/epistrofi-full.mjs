// Ο ΠΛΗΡΩΜΕΝΟΣ χρησμός της «Επιστροφής της Χαμένης Αγάπης» (4,99€).
// Η σελίδα ρωτά αυτό το endpoint κάθε 1,5 δευτερόλεπτο. Την πρώτη φορά, αφού ελέγξει την πληρωμή
// στο Stripe, ξεκινά τη συγγραφή σε background function (έως 15 λεπτά, χωρίς όριο χρόνου απάντησης).
// Η background function αποθηκεύει το κείμενο όσο γράφεται, και εδώ επιστρέφεται ό,τι έχει γραφτεί.
// Ο χρησμός γράφεται ΜΙΑ φορά και μένει αποθηκευμένος: ανανέωση ή νέο άνοιγμα δεν χρεώνει ξανά.
//
// Απάντηση: { status: "generating" | "done" | "error", teaser, text }

import { readingsStore, json, verifyStripeSession } from "../lib/epistrofi-common.mjs";

// Αν η συγγραφή δεν έχει δώσει σημάδι ζωής για 90 δευτερόλεπτα, θεωρείται χαμένη και ξεκινά ξανά.
const STALE_MS = 90 * 1000;
const MAX_ATTEMPTS = 5;

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

  const lastSign = reading.heartbeat || reading.generatingSince;
  const running = reading.generatingSince && Date.now() - lastSign < STALE_MS;
  // Μετά από 5 αποτυχημένες προσπάθειες σταματά, αλλά μετά από 10 λεπτά ξαναδοκιμάζει από την αρχή.
  if (!running && (reading.genAttempts || 0) >= MAX_ATTEMPTS) {
    if (Date.now() - (reading.lastAttemptAt || 0) < 10 * 60 * 1000) {
      return json(200, { status: "error", teaser, text: reading.partial || "", detail: reading.genError || "" });
    }
    reading.genAttempts = 0;
  }
  if (!running) {
    await readings.setJSON(readingId, {
      ...reading, paidSession: sessionId, generatingSince: Date.now(), heartbeat: Date.now(), partial: "", genError: null,
      genAttempts: (reading.genAttempts || 0) + 1, lastAttemptAt: Date.now(), lastError: reading.genError || null
    });
    const origin = new URL(req.url).origin;
    const r = await fetch(`${origin}/.netlify/functions/epistrofi-full-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reading_id: readingId, session_id: sessionId })
    }).catch(e => ({ ok: false, status: 0, e }));
    console.log(`[full] background started status=${r.status}`);
    return json(200, { status: "generating", teaser, text: "" });
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
