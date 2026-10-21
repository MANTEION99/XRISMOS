const { chartWithFallback } = require("../lib/local-chart.cjs");
const { callClaude } = require("../lib/claude.cjs");
const astro = require("../lib/astro.cjs");
// Αρχείο: netlify/functions/epistrofi.js
// Ανέβασέ το ακριβώς σε αυτόν τον φάκελο μέσα στο repo σου: netlify/functions/epistrofi.js
// Στο Netlify dashboard, στο Environment variables, πρόσθεσε:
//   ASTROLOGY_API_KEY       -> το (νέο, regenerated) API key σου από astrologyapi.com
//   ANTHROPIC_API_KEY       -> το key σου από console.anthropic.com

exports.handler = async function (event) {
  // Η δωρεάν εκδοχή είναι για τη συνδρομή, που δεν έχει ξεκινήσει. Μέχρι τότε μένει κλειστή,
  // αλλιώς ο καθένας θα έπαιρνε δωρεάν ολόκληρο χρησμό από εδώ χωρίς να πληρώσει.
  if (process.env.FREE_TOOLS_ENABLED !== "1") {
    return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
  }
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

    // Πραγματικός τόπος γέννησης (συντεταγμένες και ζώνη ώρας). Αν δεν βρεθεί: Αθήνα.
    const [pl1, pl2] = await Promise.all([astro.place(pob1, dob1, tob1), astro.place(pob2, dob2, tob2)]);


    // --- Βήμα 1: πραγματικά αστρολογικά δεδομένα, παράλληλα για ταχύτητα ---
    const [d1, m1, y1] = dob1.split("-").reverse(); // αν dob1 έρχεται σαν YYYY-MM-DD
    const [hour1, min1] = (tob1 || "12:00").split(":");

    const chart1Body = {
      day: parseInt(d1 || dob1.split("-")[2]),
      month: parseInt(m1 || dob1.split("-")[1]),
      year: parseInt(y1 || dob1.split("-")[0]),
      hour: parseInt(hour1),
      min: parseInt(min1),
      lat: pl1.lat,
      lon: pl1.lon,
      tzone: pl1.tzone,
      house_type: "placidus"
    };

    const fetchChart = (body) => chartWithFallback(body);

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
        lat: pl2.lat,
        lon: pl2.lon,
        tzone: pl2.tzone,
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
${astro.forPrompt(astroData1, tob1, name1, dob1, pl1.tzName)}

Στοιχεία Ατόμου 2 (${name2}):
${astroData2 ? astro.forPrompt(astroData2, tob2, name2, dob2, pl2.tzName) : "Δεν δόθηκαν, μίλα πιο γενικά γι' αυτό το πρόσωπο."}

Γράψε μια προσωπική, συναισθηματική ανάλυση (100-120 λέξεις, στα ελληνικά) για το αν και πότε μπορεί να επανέλθει ο/η ${name2} στη ζωή του/της, βασισμένη σε καρμικές όψεις ανάμεσα στους δύο χάρτες (Δεσμοί Σελήνης, 5ος/7ος/8ος οίκος) και διελεύσεις (αναδρομικός Ερμής/Αφροδίτη πάνω στον 7ο οίκο ή τον κυβερνήτη του).

ΓΛΩΣΣΑ: Χρησιμοποίησε τους αστρολογικούς όρους σαν άρωμα, όχι σαν κύριο περιεχόμενο. Κάθε φορά που αναφέρεις έναν τεχνικό όρο, εξήγησέ τον αμέσως σε απλή, καθημερινή γλώσσα μέσα στην ίδια πρόταση. Σύντομες προτάσεις, ζεστός τόνος.

Ξεκίνα την απάντησή σου ΜΟΝΟ με έναν αριθμό ποσοστού σε αυτή τη μορφή: [ΠΟΣΟΣΤΟ: 67]
Μετά γράψε το κείμενο, μιλώντας απευθείας στο άτομο 1, με ζεστασιά και μυστήριο. Κλείσε υπενθυμίζοντας ότι η τελική έκβαση εξαρτάται από την ελεύθερη βούληση.

ΥΠΟΧΡΕΩΤΙΚΟ: Μετά, σε νέα γραμμή, γράψε ΑΚΡΙΒΩΣ [ΣΥΜΒΟΥΛΗ] και αμέσως μετά 2-3 προτάσεις πρακτικής συμβουλής. Η συμβουλή ΔΕΝ επιτρέπεται να είναι γενική ή κοινότοπη φράση όπως "μίλα ανοιχτά", "δώσε χρόνο", "μείνε ανοιχτή" χωρίς περαιτέρω εξειδίκευση. Πρέπει να αναφέρεται σε κάτι συγκεκριμένο που προκύπτει από την ίδια την αστρολογική ανάλυση που μόλις έγραψες. Κλείσε με μία σύντομη πρόταση ότι τα άστρα αλλάζουν κάθε μήνα και η εικόνα μπορεί να είναι διαφορετική, πιο θετική, τον επόμενο μήνα. Μην αναφέρεις τίποτα για συνδρομή ή πληρωμή.

ΠΟΛΥ ΣΗΜΑΝΤΙΚΟ: Πρέπει να ολοκληρώσεις πάντα κάθε πρόταση και ολόκληρο το κείμενο κανονικά, ποτέ να μην κοπεί στη μέση λέξης ή πρότασης. Αν πλησιάζεις στο όριο μήκους, συντόμευσε νωρίτερα (λιγότερες λεπτομέρειες, πιο σύντομη συμβουλή) αλλά πάντα κλείσε το κείμενο ολοκληρωμένο, με τελεία στο τέλος.`;

    const text = await callClaude(prompt + astro.RULES, 3000);

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
