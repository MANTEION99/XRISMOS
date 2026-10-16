const { callClaude } = require("../lib/claude.cjs");
const astro = require("../lib/astro.cjs");
// Αρχείο: netlify/functions/epistrofi-agora.js
// Η ΕΠΙ ΠΛΗΡΩΜΗ (14,99€) εκδοχή, ξεχωριστή από το epistrofi.js που μένει δωρεάν μέσα στη συνδρομή.
// Ανέβασέ το στο netlify/functions/epistrofi-agora.js
// Χρειάζεται τα ίδια environment variables (ASTROLOGY_API_KEY, ANTHROPIC_API_KEY) + το νέο STRIPE_SECRET_KEY
// Χρησιμοποιείται πλέον για τη 2η και 3η ερώτηση (και για παλιές πληρωμές πριν τον δωρεάν χρησμό).
// Κάθε πληρωμή δίνει ΜΙΑ απάντηση: αν ξαναχρησιμοποιηθεί ο ίδιος σύνδεσμος, επιστρέφεται η ίδια απάντηση.

const { getStore, connectLambda } = require("@netlify/blobs");

async function verifyPaidSession(sessionId, expectedTool) {
  if (!sessionId) return false;
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    const session = await res.json();
    if (session.payment_status !== "paid" || !session.metadata || !session.metadata.tool) return false;
    // Οι πληρωμές του νέου πλήρους χρησμού εξυπηρετούνται μόνο από το epistrofi-full.
    if (session.metadata.reading_id) return false;
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
    const {
      name1, dob1, tob1, pob1, lat1, lon1, tzone1,
      name2, dob2, tob2, pob2, lat2, lon2, tzone2,
      session_id, question
    } = JSON.parse(event.body);

    if (!name1 || !name2 || !dob1) {
      return { statusCode: 400, body: JSON.stringify({ error: "Λείπουν απαραίτητα στοιχεία." }) };
    }

    const paid = await verifyPaidSession(session_id, "epistrofi");
    if (!paid) {
      return { statusCode: 402, body: JSON.stringify({ error: "Δεν βρέθηκε έγκυρη πληρωμή για αυτό το εργαλείο." }) };
    }

    connectLambda(event);
    const usedSessions = getStore({ name: "used-sessions" });
    const previous = await usedSessions.get(session_id, { type: "json" });
    if (previous && previous.reading) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reading: previous.reading })
      };
    }

    // --- Βήμα 1: πραγματικά αστρολογικά δεδομένα, παράλληλα για ταχύτητα ---
    const [d1, m1, y1] = dob1.split("-").reverse();
    const [hour1, min1] = (tob1 || "12:00").split(":");

    const chart1Body = {
      day: parseInt(d1 || dob1.split("-")[2]),
      month: parseInt(m1 || dob1.split("-")[1]),
      year: parseInt(y1 || dob1.split("-")[0]),
      hour: parseInt(hour1),
      min: parseInt(min1),
      lat: lat1 || 37.9838,
      lon: lon1 || 23.7275,
      tzone: tzone1 || astro.tz(dob1, tob1),
      house_type: "placidus"
    };

    const fetchChart = (body) => fetch("https://json.astrologyapi.com/v1/western_horoscope", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": "en",
        "x-astrologyapi-key": process.env.ASTROLOGY_API_KEY
      },
      body: JSON.stringify(body)
    }).then(r => r.json());

    let chart2Body = null;
    if (dob2) {
      const [d2, m2, y2] = dob2.split("-").reverse(); // dob2 έρχεται σαν YYYY-MM-DD
      const [hour2, min2] = (tob2 || "12:00").split(":");
      chart2Body = {
        day: parseInt(d2 || dob2.split("-")[2]),
        month: parseInt(m2 || dob2.split("-")[1]),
        year: parseInt(y2 || dob2.split("-")[0]),
        hour: parseInt(hour2),
        min: parseInt(min2),
        lat: lat2 || 37.9838,
        lon: lon2 || 23.7275,
        tzone: tzone2 || astro.tz(dob2, tob2),
        house_type: "placidus"
      };
    }

    const [astroData1, astroData2] = await Promise.all([
      fetchChart(chart1Body),
      chart2Body ? fetchChart(chart2Body) : Promise.resolve(null)
    ]);

    // --- Βήμα 2: δίνουμε τα πραγματικά δεδομένα στο Claude για να γράψει το κείμενο ---
    const mainInstruction = question
      ? `Ο/Η ${name1} έχει ήδη λάβει μια πρώτη ανάλυση για τη σχέση με τον/την ${name2} και τώρα θέτει μια ΝΕΑ ερώτηση: "${question}".

Πρώτα κατάταξε σιωπηλά την ερώτηση σε μία από τρεις κατηγορίες και ακολούθησε ΜΟΝΟ τον αντίστοιχο κανόνα:

Α) Αφορά τη σχέση, τον/την ${name2}, τα συναισθήματά του/της, άλλο πρόσωπο στη ζωή του/της ή την καρδιά της/του γενικά: γράψε μια προσωπική, συναισθηματική απάντηση (100-120 λέξεις) ΑΚΡΙΒΩΣ σε αυτή την ερώτηση, από τους δύο χάρτες, χωρίς να επαναλαμβάνεις την πρώτη ανάλυση. Το ΠΟΣΟΣΤΟ είναι η πιθανότητα να γίνει αυτό που ρωτάει.

Β) Αφορά άλλο κομμάτι της δικής της/του ζωής (δουλειά, χρήματα, σπίτι, μετακόμιση, οικογένεια, φίλοι, ταξίδι): απάντησε από τον ΔΙΚΟ ΤΗΣ/ΤΟΥ χάρτη μόνο και από τις κινήσεις των άστρων των επόμενων μηνών, ΧΩΡΙΣ να μπλέξεις τον/την ${name2} στην πρόβλεψη. 100-120 λέξεις, ίδιος ζεστός τόνος, πραγματική απάντηση στο ερώτημα. Στην τελευταία πρόταση του κειμένου δέσε διακριτικά με την καρδιά της/του, χωρίς να υπόσχεσαι τίποτα για τη σχέση. Το ΠΟΣΟΣΤΟ είναι η πιθανότητα να γίνει αυτό που ρωτάει.

Γ) Αφορά υγεία ή ασθένεια (δική της/του ή άλλου), εγκυμοσύνη, θάνατο, ατύχημα, δικαστήριο ή νομικά, ή η ερώτηση δεν βγάζει νόημα: ΜΗΝ κάνεις καμία πρόβλεψη. Γράψε ΑΚΡΙΒΩΣ στην πρώτη γραμμή [ΑΝΑΚΑΤΕΥΘΥΝΣΗ] και από κάτω 2-3 ζεστές προτάσεις: ότι για ένα τόσο σημαντικό θέμα τα άστρα δεν παίρνουν τη θέση γιατρού ή δικηγόρου (ή ότι η ερώτηση δεν έγινε κατανοητή), ότι η ερώτηση δεν χρησιμοποιήθηκε και ότι μπορεί να ρωτήσει κάτι άλλο για την καρδιά της/του. Σε αυτή την περίπτωση ΔΕΝ γράφεις ΠΟΣΟΣΤΟ ούτε ΣΥΜΒΟΥΛΗ και αγνοείς όλες τις υπόλοιπες οδηγίες μορφής.`
      : `Γράψε μια προσωπική, συναισθηματική ανάλυση (100-120 λέξεις, στα ελληνικά) για το αν και πότε μπορεί να επανέλθει ο/η ${name2} στη ζωή του/της, βασισμένη σε καρμικές όψεις ανάμεσα στους δύο χάρτες (Δεσμοί Σελήνης, 5ος/7ος/8ος οίκος) και διελεύσεις (αναδρομικός Ερμής/Αφροδίτη πάνω στον 7ο οίκο ή τον κυβερνήτη του).`;

    const prompt = `Είσαι ένας έμπειρος, ζεστός Έλληνας αστρολόγος που γράφει για το "Μαντείο". Το κοινό σου είναι κυρίως γυναίκες 50-65 ετών. Παρακάτω σου δίνω ΠΡΑΓΜΑΤΙΚΑ υπολογισμένα αστρολογικά δεδομένα (θέσεις πλανητών, οίκους, όψεις). Χρησιμοποίησέ τα σαν βάση, μην εφευρίσκεις νέα δεδομένα εκτός αυτών.

Στοιχεία Ατόμου 1 (${name1}):
${astro.forPrompt(astroData1, tob1, name1, dob1)}

Στοιχεία Ατόμου 2 (${name2}):
${astroData2 ? astro.forPrompt(astroData2, tob2, name2, dob2) : "Δεν δόθηκαν, μίλα πιο γενικά γι' αυτό το πρόσωπο."}

${mainInstruction}

ΓΛΩΣΣΑ: Χρησιμοποίησε τους αστρολογικούς όρους σαν άρωμα, όχι σαν κύριο περιεχόμενο. Κάθε φορά που αναφέρεις έναν τεχνικό όρο, εξήγησέ τον αμέσως σε απλή, καθημερινή γλώσσα μέσα στην ίδια πρόταση. Σύντομες προτάσεις, ζεστός τόνος.

Ξεκίνα την απάντησή σου ΜΟΝΟ με έναν αριθμό ποσοστού σε αυτή τη μορφή: [ΠΟΣΟΣΤΟ: 67]
Μετά γράψε το κείμενο, μιλώντας απευθείας στο άτομο 1, με ζεστασιά και μυστήριο. Κλείσε υπενθυμίζοντας ότι η τελική έκβαση εξαρτάται από την ελεύθερη βούληση.

ΥΠΟΧΡΕΩΤΙΚΟ: Μετά, σε νέα γραμμή, γράψε ΑΚΡΙΒΩΣ [ΣΥΜΒΟΥΛΗ] και αμέσως μετά 2-3 προτάσεις πρακτικής συμβουλής. Η συμβουλή ΔΕΝ επιτρέπεται να είναι γενική ή κοινότοπη φράση όπως "μίλα ανοιχτά", "δώσε χρόνο", "μείνε ανοιχτή" χωρίς περαιτέρω εξειδίκευση. Πρέπει να αναφέρεται σε κάτι συγκεκριμένο που προκύπτει από την ίδια την αστρολογική ανάλυση που μόλις έγραψες. Κλείσε με μία σύντομη πρόταση ότι τα άστρα αλλάζουν κάθε μήνα και η εικόνα μπορεί να είναι διαφορετική, πιο θετική, τον επόμενο μήνα. Μην αναφέρεις τίποτα για συνδρομή ή πληρωμή.

ΠΟΛΥ ΣΗΜΑΝΤΙΚΟ: Πρέπει να ολοκληρώσεις πάντα κάθε πρόταση και ολόκληρο το κείμενο κανονικά, ποτέ να μην κοπεί στη μέση λέξης ή πρότασης. Αν πλησιάζεις στο όριο μήκους, συντόμευσε νωρίτερα (λιγότερες λεπτομέρειες, πιο σύντομη συμβουλή) αλλά πάντα κλείσε το κείμενο ολοκληρωμένο, με τελεία στο τέλος.`;

    const text = await callClaude(prompt + astro.RULES + astro.sky({ name1, name2, tob1, dob1 }, astroData1, astroData2), 3000);

    // Ερώτηση που δεν απαντιέται (υγεία, νομικά, ακατανόητη): η πληρωμή ΔΕΝ καταναλώνεται.
    if (question && /\[\s*ΑΝΑΚΑΤΕΥΘΥΝΣΗ\s*\]/.test(text)) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirect: true, message: text.replace(/\[\s*ΑΝΑΚΑΤΕΥΘΥΝΣΗ\s*\]/, "").trim() })
      };
    }

    await usedSessions.setJSON(session_id, { reading: text, tool: "epistrofi", at: new Date().toISOString() });

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
