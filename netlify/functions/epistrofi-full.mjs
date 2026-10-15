// Ο ΠΛΗΡΩΜΕΝΟΣ χρησμός της «Επιστροφής της Χαμένης Αγάπης» (4,99€).
// Ελέγχει στο Stripe ότι η πληρωμή έγινε για ΑΥΤΟΝ τον χρησμό και γράφει τη συνέχεια με streaming.
// Η συνέχεια γράφεται ΜΙΑ φορά και αποθηκεύεται: αν η πελάτισσα ανανεώσει τη σελίδα ή ξανανοίξει
// τον σύνδεσμο, παίρνει τον ίδιο χρησμό, δεν γράφεται νέος. Έτσι μια πληρωμή δεν ξαναχρησιμοποιείται.
//
// Μορφή απάντησης (απλό κείμενο):
//   <δωρεάν άνοιγμα>
//   <<<ΣΥΝΕΧΕΙΑ>>>
//   <πληρωμένη συνέχεια, ξεκινά με [ΠΟΣΟΣΤΟ: NN] και περιέχει [ΣΥΜΒΟΥΛΗ]>

import {
  readingsStore, json, verifyStripeSession, fullPrompt, streamClaude, streamResponse
} from "../lib/epistrofi-common.mjs";

const SEP = "\n<<<ΣΥΝΕΧΕΙΑ>>>\n";

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

  const paid = await verifyStripeSession(sessionId, "epistrofi", readingId);
  if (!paid) return json(402, { error: "Δεν βρέθηκε έγκυρη πληρωμή για αυτόν τον χρησμό." });

  // Ήδη γραμμένος: τον επιστρέφουμε όπως είναι.
  if (reading.full) {
    return new Response((reading.teaser || "") + SEP + reading.full, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  // Γράφεται ήδη από άλλο παράθυρο: η σελίδα θα ξαναρωτήσει σε λίγο.
  if (reading.generatingSince && Date.now() - reading.generatingSince < 120000) {
    return json(409, { error: "generating" });
  }

  await readings.setJSON(readingId, { ...reading, generatingSince: Date.now(), paidSession: sessionId });

  return streamResponse(async (write) => {
    write((reading.teaser || "") + SEP);
    try {
      const full = await streamClaude(fullPrompt(reading.inputs, reading.charts, reading.teaser), 4000, write, 450);
      await readings.setJSON(readingId, {
        ...reading, full, paidSession: sessionId, paidAt: new Date().toISOString(), generatingSince: null
      });
    } catch (e) {
      // Αποτυχία: ελευθερώνουμε το κλείδωμα ώστε η ανανέωση της σελίδας να ξαναδοκιμάσει.
      await readings.setJSON(readingId, { ...reading, generatingSince: null });
      throw e;
    }
  });
};

export const config = {
  path: "/api/epistrofi-full",
  method: "POST"
};
