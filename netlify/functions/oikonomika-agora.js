// Αρχείο: netlify/functions/oikonomika.js
// Ανέβασέ το ακριβώς σε αυτόν τον φάκελο μέσα στο repo σου: netlify/functions/oikonomika.js
// Χρησιμοποιεί τα ΙΔΙΑ environment variables με το epistrofi.js (ASTROLOGY_API_KEY, ANTHROPIC_API_KEY)
// + το ΝΕΟ STRIPE_SECRET_KEY (το ίδιο που πρόσθεσες για το create-checkout.js)

async function verifyPaidSession(sessionId, expectedTool) {
  if (!sessionId) return false;
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    const session = await res.json();
    if (session.payment_status !== "paid" || !session.metadata || !session.metadata.tool) return false;
    const paidTool = session.metadata.tool;
    return paidTool === expectedTool || paidTool.startsWith(expectedTool + "_q");
  } catch (e) {
    return false;
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { name1, dob1, tob1, pob1, question, session_id } = JSON.parse(event.body);

    if (!name1 || !dob1 || !question) {
      return { statusCode: 400, body: JSON.stringify({ error: "Λείπουν απαραίτητα στοιχεία." }) };
    }

    const paid = await verifyPaidSession(session_id, "oikonomika");
    if (!paid) {
      return { statusCode: 402, body: JSON.stringify({ error: "Δεν βρέθηκε έγκυρη πληρωμή για αυτό το εργαλείο." }) };
    }

    // --- Βήμα 1: πραγματικά αστρολογικά δεδομένα ---
    const [d1, m1, y1] = dob1.split("-");
    const [hour1, min1] = (tob1 || "12:00").split(":");

    const chart1Body = {
      day: parseInt(d1 || dob1.split("-")[2]),
      month: parseInt(m1 || dob1.split("-")[1]),
      year: parseInt(y1 || dob1.split("-")[0]),
      hour: parseInt(hour1),
      min: parseInt(min1),
      lat: 37.9838,
      lon: 23.7275,
      tzone: 2,
      house_type: "placidus"
    };

    const astroRes1 = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-astrologyapi-key": process.env.ASTROLOGY_API_KEY
      },
      body: JSON.stringify(chart1Body)
    });
    const astroData1 = await astroRes1.json();

    // --- Βήμα 2: δίνουμε τα πραγματικά δεδομένα στο Claude για να γράψει το κείμενο ---
    const prompt = `Είσαι ένας έμπειρος, ζεστός Έλληνας αστρολόγος που γράφει για το "Μαντείο". Το κοινό σου είναι κυρίως γυναίκες 50-65 ετών. Παρακάτω σου δίνω ΠΡΑΓΜΑΤΙΚΑ υπολογισμένα αστρολογικά δεδομένα (θέσεις πλανητών, οίκους, όψεις) για το άτομο. Χρησιμοποίησέ τα σαν βάση, μην εφευρίσκεις νέα δεδομένα εκτός αυτών.

Στοιχεία (${name1}):
${JSON.stringify(astroData1)}

Η ερώτηση που έθεσε το άτομο: "${question}"

Γράψε μια προσωπική, συναισθηματική ανάλυση (130-160 λέξεις, στα ελληνικά) που απαντά ΣΥΓΚΕΚΡΙΜΕΝΑ στην ερώτηση που έθεσε, βασισμένη σε στοιχεία του 2ου οίκου (προσωπικά χρήματα, περιουσία) και του 10ου οίκου (καριέρα, δημόσια εικόνα, μεγάλες υποχρεώσεις), καθώς και διελεύσεις Δία (ευκαιρία) ή Κρόνου (σταθεροποίηση) πάνω σε αυτούς τους οίκους ή τους κυβερνήτες τους.

ΓΛΩΣΣΑ: Χρησιμοποίησε τους αστρολογικούς όρους σαν άρωμα, όχι σαν κύριο περιεχόμενο. Κάθε φορά που αναφέρεις έναν τεχνικό όρο, εξήγησέ τον αμέσως σε απλή, καθημερινή γλώσσα μέσα στην ίδια πρόταση. Σύντομες προτάσεις, ζεστός τόνος.

Ξεκίνα την απάντησή σου ΜΟΝΟ με έναν αριθμό ποσοστού σε αυτή τη μορφή: [ΠΟΣΟΣΤΟ: 67]
Μετά γράψε το κείμενο, μιλώντας απευθείας στο άτομο, με ζεστασιά και μυστήριο, απαντώντας ΣΤΗ ΣΥΓΚΕΚΡΙΜΕΝΗ ερώτηση που έθεσε, όχι γενικά για οικονομικά. Κλείσε υπενθυμίζοντας ότι η τελική έκβαση εξαρτάται και από τις δικές του/της ενέργειες, όχι μόνο τον ουρανό.

ΥΠΟΧΡΕΩΤΙΚΟ: Μετά, σε νέα γραμμή, γράψε ΑΚΡΙΒΩΣ [ΣΥΜΒΟΥΛΗ] και αμέσως μετά 1-2 προτάσεις πρακτικής συμβουλής σχετικής με την ερώτηση, κλείνοντας με μία σύντομη πρόταση ότι ο ουρανός αλλάζει κάθε μήνα και η εικόνα μπορεί να είναι διαφορετική, πιο θετική, τον επόμενο μήνα. Μην αναφέρεις τίποτα για συνδρομή ή πληρωμή.

ΠΟΛΥ ΣΗΜΑΝΤΙΚΟ: Πρέπει να ολοκληρώσεις πάντα κάθε πρόταση και ολόκληρο το κείμενο κανονικά, ποτέ να μην κοπεί στη μέση λέξης ή πρότασης. Αν πλησιάζεις στο όριο μήκους, συντόμευσε νωρίτερα αλλά πάντα κλείσε το κείμενο ολοκληρωμένο, με τελεία στο τέλος.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1100,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const claudeData = await claudeRes.json();
    const text = claudeData.content.map(b => b.text || "").join("").trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reading: text })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Κάτι πήγε στραβά.", details: error.message })
    };
  }
};
