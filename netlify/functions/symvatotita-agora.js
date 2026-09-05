// Αρχείο: netlify/functions/symvatotita-agora.js
// Η ΕΠΙ ΠΛΗΡΩΜΗ (14,99€) εκδοχή, ξεχωριστή από το symvatotita.js που μένει δωρεάν μέσα στη συνδρομή.
// Ανέβασέ το στο netlify/functions/symvatotita-agora.js
// Χρειάζεται τα ίδια environment variables (ASTROLOGY_API_KEY, ANTHROPIC_API_KEY) + το νέο STRIPE_SECRET_KEY

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
    const {
      name1, dob1, tob1, pob1,
      name2, dob2, tob2, pob2,
      session_id, question
    } = JSON.parse(event.body);

    if (!name1 || !name2 || !dob1 || !dob2) {
      return { statusCode: 400, body: JSON.stringify({ error: "Λείπουν απαραίτητα στοιχεία." }) };
    }

    const paid = await verifyPaidSession(session_id, "symvatotita");
    if (!paid) {
      return { statusCode: 402, body: JSON.stringify({ error: "Δεν βρέθηκε έγκυρη πληρωμή για αυτό το εργαλείο." }) };
    }

    // --- Βήμα 1: πραγματικά αστρολογικά δεδομένα, παράλληλα για ταχύτητα ---
    const buildChartBody = (dob, tob) => {
      const [d, m, y] = dob.split("-");
      const [hour, min] = (tob || "12:00").split(":");
      return {
        day: parseInt(d || dob.split("-")[2]),
        month: parseInt(m || dob.split("-")[1]),
        year: parseInt(y || dob.split("-")[0]),
        hour: parseInt(hour),
        min: parseInt(min),
        lat: 37.9838,
        lon: 23.7275,
        tzone: 2,
        house_type: "placidus"
      };
    };

    const fetchChart = (body) => fetch("https://json.astrologyapi.com/v1/western_horoscope", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-astrologyapi-key": process.env.ASTROLOGY_API_KEY
      },
      body: JSON.stringify(body)
    }).then(r => r.json());

    const [astroData1, astroData2] = await Promise.all([
      fetchChart(buildChartBody(dob1, tob1)),
      fetchChart(buildChartBody(dob2, tob2))
    ]);

    // --- Βήμα 2: δίνουμε τα πραγματικά δεδομένα στο Claude για να γράψει το κείμενο ---
    const prompt = `Είσαι ένας έμπειρος, ζεστός Έλληνας αστρολόγος που γράφει για το "Μαντείο". Το κοινό σου είναι κυρίως γυναίκες 50-65 ετών. Παρακάτω σου δίνω ΠΡΑΓΜΑΤΙΚΑ υπολογισμένα αστρολογικά δεδομένα (θέσεις πλανητών, οίκους, όψεις) για δύο άτομα. Χρησιμοποίησέ τα σαν βάση, μην εφευρίσκεις νέα δεδομένα εκτός αυτών.

Στοιχεία Ατόμου 1 (${name1}):
${JSON.stringify(astroData1)}

Στοιχεία Ατόμου 2 (${name2}):
${JSON.stringify(astroData2)}

ΠΟΛΥ ΣΗΜΑΝΤΙΚΟ: Τα παραπάνω στοιχεία είναι πλήρη και επαρκή για ανάλυση. ΜΗΝ αναφέρεις πουθενά ότι λείπουν στοιχεία, ότι τα δεδομένα είναι ελλιπή, ή οτιδήποτε παρόμοιο. Γράψε την ανάλυση με σιγουριά, σαν να έχεις όλα όσα χρειάζεσαι, γιατί πράγματι τα έχεις.

${question
  ? `Ο/Η ${name1} έχει ήδη λάβει μια πρώτη ανάλυση συμβατότητας και τώρα θέτει μια ΝΕΑ, ΣΥΓΚΕΚΡΙΜΕΝΗ ερώτηση: "${question}". Γράψε μια προσωπική, συναισθηματική απάντηση (100-120 λέξεις, στα ελληνικά) ΑΚΡΙΒΩΣ σε αυτή την ερώτηση, βασισμένη στα ίδια δεδομένα συναστρίας παραπάνω, χωρίς να επαναλαμβάνεις όσα πιθανόν ειπώθηκαν στην πρώτη ανάλυση.`
  : `Γράψε μια προσωπική, συναισθηματική ανάλυση συμβατότητας (100-120 λέξεις, στα ελληνικά) ανάμεσα στους δύο, βασισμένη σε πραγματική συναστρία: όψεις ανάμεσα στους δύο Ήλιους, στις δύο Αφροδίτες/Άρη (έλξη, χημεία), και ανάμεσα στους δύο Ερμήδες (επικοινωνία, ειλικρίνεια). Απάντησε ουσιαστικά σε το κατά πόσο υπάρχει πραγματική βάση, ειλικρίνεια και προοπτική ανάμεσά τους, όχι μόνο γενική "ταιριάζετε".`
}

ΓΛΩΣΣΑ: Χρησιμοποίησε τους αστρολογικούς όρους σαν άρωμα, όχι σαν κύριο περιεχόμενο. Κάθε φορά που αναφέρεις έναν τεχνικό όρο, εξήγησέ τον αμέσως σε απλή, καθημερινή γλώσσα μέσα στην ίδια πρόταση. Σύντομες προτάσεις, ζεστός τόνος.

Ξεκίνα την απάντησή σου ΜΟΝΟ με έναν αριθμό ποσοστού σε αυτή τη μορφή: [ΠΟΣΟΣΤΟ: 67]
Μετά γράψε το κείμενο, μιλώντας απευθείας στο άτομο 1, με ζεστασιά και μυστήριο. Κλείσε υπενθυμίζοντας ότι η τελική έκβαση εξαρτάται από τις επιλογές και των δύο, όχι μόνο τον ουρανό.

ΥΠΟΧΡΕΩΤΙΚΟ: Μετά, σε νέα γραμμή, γράψε ΑΚΡΙΒΩΣ [ΣΥΜΒΟΥΛΗ] και αμέσως μετά 2-3 προτάσεις πρακτικής συμβουλής. Η συμβουλή ΔΕΝ επιτρέπεται να είναι γενική ή κοινότοπη φράση όπως "μίλα ανοιχτά", "δώσε χρόνο", "να είστε ειλικρινείς" χωρίς περαιτέρω εξειδίκευση. Πρέπει να αναφέρεται σε κάτι συγκεκριμένο που προκύπτει από την ίδια την αστρολογική ανάλυση που μόλις έγραψες (π.χ. ένα μικρό, χειροπιαστό βήμα σχετικό με τη συγκεκριμένη δυναμική/ένταση που εντόπισες, όχι γενική αρχή επικοινωνίας). Κλείσε με μία σύντομη πρόταση ότι ο ουρανός αλλάζει κάθε μήνα και η εικόνα μπορεί να είναι διαφορετική, πιο θετική, τον επόμενο μήνα. Μην αναφέρεις τίποτα για συνδρομή ή πληρωμή.

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
        max_tokens: 1400,
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
