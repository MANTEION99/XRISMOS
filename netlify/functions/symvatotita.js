// Αρχείο: netlify/functions/symvatotita.js
// Ανέβασέ το ακριβώς σε αυτόν τον φάκελο μέσα στο repo σου: netlify/functions/symvatotita.js
// Χρησιμοποιεί τα ΙΔΙΑ environment variables με τα υπόλοιπα (ASTROLOGY_API_KEY, ANTHROPIC_API_KEY), δεν χρειάζεται τίποτα νέο.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const {
      name1, dob1, tob1, pob1,
      name2, dob2, tob2, pob2
    } = JSON.parse(event.body);

    if (!name1 || !name2 || !dob1 || !dob2) {
      return { statusCode: 400, body: JSON.stringify({ error: "Λείπουν απαραίτητα στοιχεία." }) };
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

Γράψε μια προσωπική, συναισθηματική ανάλυση συμβατότητας (100-120 λέξεις, στα ελληνικά) ανάμεσα στους δύο, βασισμένη σε πραγματική συναστρία: όψεις ανάμεσα στους δύο Ήλιους, στις δύο Αφροδίτες/Άρη (έλξη, χημεία), και ανάμεσα στους δύο Ερμήδες (επικοινωνία, ειλικρίνεια). Λάβε επίσης υπόψη τυχόν όψεις που αγγίζουν τον 8ο οίκο (βαθιά, κρυφά συναισθήματα, όσα δεν λέγονται ανοιχτά) ή τον Ποσειδώνα (ψευδαισθήσεις, απόκρυψη) ανάμεσα στους δύο χάρτες, αν υπάρχουν πραγματικά στα δεδομένα. Απάντησε ουσιαστικά σε το κατά πόσο υπάρχει πραγματική βάση, ειλικρίνεια και προοπτική ανάμεσά τους, όχι μόνο γενική "ταιριάζετε".

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
