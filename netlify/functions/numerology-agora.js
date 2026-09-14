// Αρχείο: netlify/functions/numerology-agora.js
// Η ΕΠΙ ΠΛΗΡΩΜΗ εκδοχή, ξεχωριστή από το numerology.js που μένει δωρεάν μέσα στη συνδρομή.
// Ανέβασέ το στο netlify/functions/numerology-agora.js
// Χρειάζεται: ANTHROPIC_API_KEY, STRIPE_SECRET_KEY

const GREEK_MAP = {
  "Α":1,"Β":2,"Γ":3,"Δ":4,"Ε":5,"Ζ":6,"Η":7,"Θ":8,"Ι":9,
  "Κ":1,"Λ":2,"Μ":3,"Ν":4,"Ξ":5,"Ο":6,"Π":7,"Ρ":8,"Σ":9,
  "Τ":1,"Υ":2,"Φ":3,"Χ":4,"Ψ":5,"Ω":6
};

function stripAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function reduceNumber(num) {
  while (num > 9 && num !== 11 && num !== 22 && num !== 33) {
    num = String(num).split("").reduce((sum, d) => sum + parseInt(d), 0);
  }
  return num;
}

function calcLifePathNumber(dob) {
  const digits = dob.replace(/-/g, "").split("").map(Number);
  const total = digits.reduce((sum, d) => sum + d, 0);
  return reduceNumber(total);
}

function calcNameNumber(name) {
  const upper = stripAccents(name.toUpperCase());
  let total = 0;
  for (const ch of upper) {
    if (GREEK_MAP[ch]) total += GREEK_MAP[ch];
  }
  return reduceNumber(total || 1);
}

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
    const { name1, dob1, session_id, question } = JSON.parse(event.body);

    if (!name1 || !dob1) {
      return { statusCode: 400, body: JSON.stringify({ error: "Λείπουν απαραίτητα στοιχεία." }) };
    }

    const paid = await verifyPaidSession(session_id, "numerology");
    if (!paid) {
      return { statusCode: 402, body: JSON.stringify({ error: "Δεν βρέθηκε έγκυρη πληρωμή για αυτό το εργαλείο." }) };
    }

    const lifePath = calcLifePathNumber(dob1);
    const nameNumber = calcNameNumber(name1);

    const mainInstruction = question
      ? `Ο/Η ${name1} έχει ήδη λάβει μια πρώτη ανάλυση και τώρα θέτει μια ΝΕΑ, ΣΥΓΚΕΚΡΙΜΕΝΗ ερώτηση: "${question}". Γράψε μια προσωπική, ζεστή απάντηση (100-120 λέξεις, στα ελληνικά) ΑΚΡΙΒΩΣ σε αυτή την ερώτηση, βασισμένη στους ίδιους αριθμούς παραπάνω, χωρίς να επαναλαμβάνεις όσα πιθανόν ειπώθηκαν στην πρώτη ανάλυση.`
      : `Γράψε μια προσωπική, ζεστή ανάλυση (100-120 λέξεις, στα ελληνικά) που εξηγεί τι σημαίνει ο συνδυασμός αυτών των δύο αριθμών για τον χαρακτήρα και τη μοίρα του/της ${name1}, και εντοπίζει ένα συγκεκριμένο μοτίβο συμπεριφοράς που πιθανόν επαναλαμβάνεται σε κάθε σημαντική απόφαση της ζωής του/της (π.χ. στην αγάπη, στην καριέρα, ή στις σχέσεις), με βάση τη γνωστή σημασία αυτών των αριθμών στην αριθμολογία (π.χ. ο Αριθμός Ζωής 1 δείχνει ηγετικό πνεύμα και ανάγκη ανεξαρτησίας, το 2 ευαισθησία και ανάγκη συνεργασίας, το 3 δημιουργικότητα και ανάγκη έκφρασης, το 4 πρακτικότητα και ανάγκη σταθερότητας, το 5 ανάγκη ελευθερίας και αλλαγής, το 6 ανάγκη φροντίδας των άλλων, το 7 εσωστρέφεια και ανάγκη νοήματος, το 8 ανάγκη υλικής επιτυχίας και ελέγχου, το 9 ανάγκη προσφοράς, οι master numbers 11/22/33 δείχνουν αυξημένη πνευματική ευαισθησία και ευθύνη).`;

    const prompt = `Είσαι μια έμπειρη, ζεστή Ελληνίδα αριθμολόγος που γράφει για το "Μαντείο". Το κοινό σου είναι κυρίως γυναίκες 50-65 ετών. Παρακάτω σου δίνω ΠΡΑΓΜΑΤΙΚΑ υπολογισμένους αριθμούς αριθμολογίας. Χρησιμοποίησέ τους σαν βάση, μην εφευρίσκεις άλλους αριθμούς.

Όνομα: ${name1}
Αριθμός Ζωής (από την ημερομηνία γέννησης): ${lifePath}
Αριθμός Ονόματος: ${nameNumber}

${mainInstruction}

ΓΛΩΣΣΑ: Ζεστός, προσωπικός τόνος, σαν να μιλάς κατευθείαν στο άτομο. Σύντομες προτάσεις.

Ξεκίνα την απάντησή σου ΜΟΝΟ με τη μορφή: [ΑΡΙΘΜΟΣ_ΖΩΗΣ: ${lifePath}][ΑΡΙΘΜΟΣ_ΟΝΟΜΑΤΟΣ: ${nameNumber}]
Μετά γράψε το κείμενο.

ΥΠΟΧΡΕΩΤΙΚΟ: Μετά, σε νέα γραμμή, γράψε ΑΚΡΙΒΩΣ [ΣΥΜΒΟΥΛΗ] και αμέσως μετά 2-3 προτάσεις πρακτικής συμβουλής, συγκεκριμένης πάνω στο μοτίβο που μόλις περιέγραψες, όχι γενικόλογης. Μην αναφέρεις τίποτα για συνδρομή ή πληρωμή.

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
      body: JSON.stringify({ reading: text, lifePath, nameNumber })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Κάτι πήγε στραβά.", details: error.message })
    };
  }
};
