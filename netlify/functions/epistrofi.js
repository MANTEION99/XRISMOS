// Αρχείο: netlify/functions/epistrofi.js
// Ανέβασέ το ακριβώς σε αυτόν τον φάκελο μέσα στο repo σου: netlify/functions/epistrofi.js
// Στο Netlify dashboard, στο Environment variables, πρόσθεσε:
//   ASTROLOGY_API_KEY       -> το (νέο, regenerated) API key σου από astrologyapi.com
//   ANTHROPIC_API_KEY       -> το key σου από console.anthropic.com

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const {
      name1, dob1, tob1, pob1, lat1, lon1, tzone1,
      name2, dob2, tob2, pob2, lat2, lon2, tzone2
    } = JSON.parse(event.body);

    if (!name1 || !name2 || !dob1) {
      return { statusCode: 400, body: JSON.stringify({ error: "Λείπουν απαραίτητα στοιχεία." }) };
    }

    // --- Βήμα 1: πραγματικά αστρολογικά δεδομένα, παράλληλα για ταχύτητα ---
    const [d1, m1, y1] = dob1.split("-").reverse(); // αν dob1 έρχεται σαν YYYY-MM-DD
    const [hour1, min1] = (tob1 || "12:00").split(":");

    const chart1Body = {
      day: parseInt(d1 || dob1.split("-")[2]),
      month: parseInt(m1 || dob1.split("-")[1]),
      year: parseInt(y1 || dob1.split("-")[0]),
      hour: parseInt(hour1),
      min: parseInt(min1),
      lat: lat1 || 37.9838,   // fallback: Αθήνα, αν δεν δόθηκε γεωκωδικοποιημένη πόλη
      lon: lon1 || 23.7275,
      tzone: tzone1 || 2,
      house_type: "placidus"
    };

    const fetchChart = (body) => fetch("https://json.astrologyapi.com/v1/western_horoscope", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-astrologyapi-key": process.env.ASTROLOGY_API_KEY
      },
      body: JSON.stringify(body)
    }).then(r => r.json());

    let chart2Body = null;
    if (dob2) {
      const [d2, m2, y2] = dob2.split("-");
      const [hour2, min2] = (tob2 || "12:00").split(":");
      chart2Body = {
        day: parseInt(d2 || dob2.split("-")[2]),
        month: parseInt(m2 || dob2.split("-")[1]),
        year: parseInt(y2 || dob2.split("-")[0]),
        hour: parseInt(hour2),
        min: parseInt(min2),
        lat: lat2 || 37.9838,
        lon: lon2 || 23.7275,
        tzone: tzone2 || 2,
        house_type: "placidus"
      };
    }

    const [astroData1, astroData2] = await Promise.all([
      fetchChart(chart1Body),
      chart2Body ? fetchChart(chart2Body) : Promise.resolve(null)
    ]);

    // --- Βήμα 2: δίνουμε τα πραγματικά δεδομένα στο Claude για να γράψει το κείμενο ---
    const prompt = `Είσαι ένας έμπειρος, ζεστός Έλληνας αστρολόγος που γράφει για το "Μαντείο". Το κοινό σου είναι κυρίως γυναίκες 50-65 ετών. Παρακάτω σου δίνω ΠΡΑΓΜΑΤΙΚΑ υπολογισμένα αστρολογικά δεδομένα (θέσεις πλανητών, οίκους, όψεις). Χρησιμοποίησέ τα σαν βάση, μην εφευρίσκεις νέα δεδομένα εκτός αυτών.

Στοιχεία Ατόμου 1 (${name1}):
${JSON.stringify(astroData1)}

Στοιχεία Ατόμου 2 (${name2}):
${astroData2 ? JSON.stringify(astroData2) : "Δεν δόθηκαν, μίλα πιο γενικά γι' αυτό το πρόσωπο."}

Γράψε μια προσωπική, συναισθηματική ανάλυση (130-160 λέξεις, στα ελληνικά) για το αν και πότε μπορεί να επανέλθει ο/η ${name2} στη ζωή του/της, βασισμένη σε καρμικές όψεις ανάμεσα στους δύο χάρτες (Δεσμοί Σελήνης, 5ος/7ος/8ος οίκος) και διελεύσεις (αναδρομικός Ερμής/Αφροδίτη πάνω στον 7ο οίκο ή τον κυβερνήτη του).

ΓΛΩΣΣΑ: Χρησιμοποίησε τους αστρολογικούς όρους σαν άρωμα, όχι σαν κύριο περιεχόμενο. Κάθε φορά που αναφέρεις έναν τεχνικό όρο, εξήγησέ τον αμέσως σε απλή, καθημερινή γλώσσα μέσα στην ίδια πρόταση. Σύντομες προτάσεις, ζεστός τόνος.

Ξεκίνα την απάντησή σου ΜΟΝΟ με έναν αριθμό ποσοστού σε αυτή τη μορφή: [ΠΟΣΟΣΤΟ: 67]
Μετά γράψε το κείμενο, μιλώντας απευθείας στο άτομο 1, με ζεστασιά και μυστήριο. Κλείσε υπενθυμίζοντας ότι η τελική έκβαση εξαρτάται από την ελεύθερη βούληση.

ΥΠΟΧΡΕΩΤΙΚΟ: Μετά, σε νέα γραμμή, γράψε ΑΚΡΙΒΩΣ [ΣΥΜΒΟΥΛΗ] και αμέσως μετά 1-2 προτάσεις πρακτικής συμβουλής, κλείνοντας με μία σύντομη πρόταση ότι ο ουρανός αλλάζει κάθε μήνα και η εικόνα μπορεί να είναι διαφορετική, πιο θετική, τον επόμενο μήνα. Μην αναφέρεις τίποτα για συνδρομή ή πληρωμή.

ΠΟΛΥ ΣΗΜΑΝΤΙΚΟ: Πρέπει να ολοκληρώσεις πάντα κάθε πρόταση και ολόκληρο το κείμενο κανονικά, ποτέ να μην κοπεί στη μέση λέξης ή πρότασης. Αν πλησιάζεις στο όριο μήκους, συντόμευσε νωρίτερα (λιγότερες λεπτομέρειες, πιο σύντομη συμβουλή) αλλά πάντα κλείσε το κείμενο ολοκληρωμένο, με τελεία στο τέλος.`;

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
