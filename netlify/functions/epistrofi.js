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

    // --- Βήμα 1: πραγματικά αστρολογικά δεδομένα για το Άτομο 1 ---
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

    const astroRes1 = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-astrologyapi-key": process.env.ASTROLOGY_API_KEY
      },
      body: JSON.stringify(chart1Body)
    });
    const astroData1 = await astroRes1.json();

    // --- Βήμα 2: αν υπάρχουν στοιχεία, ίδιο για το Άτομο 2 ---
    let astroData2 = null;
    if (dob2) {
      const [d2, m2, y2] = dob2.split("-");
      const [hour2, min2] = (tob2 || "12:00").split(":");
      const chart2Body = {
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
      const astroRes2 = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-astrologyapi-key": process.env.ASTROLOGY_API_KEY
        },
        body: JSON.stringify(chart2Body)
      });
      astroData2 = await astroRes2.json();
    }

    // --- Βήμα 3: δίνουμε τα πραγματικά δεδομένα στο Claude για να γράψει το κείμενο ---
    const prompt = `Είσαι ένας έμπειρος, ζεστός Έλληνας αστρολόγος που γράφει για το "Μαντείο". Το κοινό σου είναι κυρίως γυναίκες 50-65 ετών. Παρακάτω σου δίνω ΠΡΑΓΜΑΤΙΚΑ υπολογισμένα αστρολογικά δεδομένα (θέσεις πλανητών, οίκους, όψεις) για δύο άτομα. Χρησιμοποίησέ τα σαν βάση, μην εφευρίσκεις νέα δεδομένα εκτός αυτών.

Στοιχεία Ατόμου 1 (${name1}):
${JSON.stringify(astroData1)}

Στοιχεία Ατόμου 2 (${name2}):
${astroData2 ? JSON.stringify(astroData2) : "Δεν δόθηκαν, χρησιμοποίησε μόνο τα στοιχεία του Ατόμου 1 και μίλα πιο γενικά για το δεύτερο πρόσωπο."}

Γράψε μια προσωπική, συναισθηματική ανάλυση (180-230 λέξεις, στα ελληνικά) για το αν και πότε μπορεί να επανέλθει στη ζωή του/της ένα πρόσωπο από το παρελθόν, βασισμένη σε καρμικές όψεις (Δεσμοί Σελήνης, 5ος/7ος/8ος οίκος), διελεύσεις (αναδρομικός Ερμής/Αφροδίτη πάνω στον 7ο οίκο ή τον κυβερνήτη του), και προοδευμένη Σελήνη.

ΓΛΩΣΣΑ: Χρησιμοποίησε τους αστρολογικούς όρους σαν άρωμα, όχι σαν κύριο περιεχόμενο. Κάθε φορά που αναφέρεις έναν τεχνικό όρο (π.χ. "αναδρομικός Ερμής", "7ος οίκος"), εξήγησέ τον αμέσως σε απλή, καθημερινή γλώσσα μέσα στην ίδια πρόταση, σαν να μιλάς σε κάποιον που δεν έχει σπουδάσει αστρολογία. Προτίμησε σύντομες προτάσεις, ζεστό και προσωπικό τόνο, όχι διάλεξη.

Ξεκίνα την απάντησή σου ΜΟΝΟ με έναν αριθμό ποσοστού σε αυτή τη μορφή: [ΠΟΣΟΣΤΟ: 67]
Μετά γράψε το κείμενο, μιλώντας απευθείας στο άτομο 1, με ζεστασιά και μυστήριο. Κλείσε υπενθυμίζοντας ότι η τελική έκβαση εξαρτάται από την ελεύθερη βούληση.

ΥΠΟΧΡΕΩΤΙΚΟ: Μετά το τέλος αυτού του κειμένου, σε ΔΙΚΗ ΤΟΥ νέα γραμμή, γράψε ΑΚΡΙΒΩΣ την ετικέτα [ΣΥΜΒΟΥΛΗ] (με τις αγκύλες, χωρίς καμία παραλλαγή ή μετάφραση), και αμέσως μετά 2-3 προτάσεις πρακτικής, ανθρώπινης συμβουλής. Αυτό το κομμάτι είναι υποχρεωτικό σε κάθε απάντηση, ποτέ μην το παραλείπεις.

Στο τέλος της συμβουλής, πρόσθεσε ΥΠΟΧΡΕΩΤΙΚΑ 1-2 τελευταίες προτάσεις που να κάνουν ξεκάθαρο, με απλά λόγια, ότι αυτό που μόλις διάβασε ισχύει για αυτή τη συγκεκριμένη περίοδο (αυτή την εβδομάδα/αυτόν τον μήνα), ότι ο ουρανός αλλάζει συνέχεια, και ότι τον επόμενο μήνα η εικόνα μπορεί να είναι διαφορετική, ακόμα και πιο ευνοϊκή. Το κλείσιμο πρέπει να αφήνει θετική, ελπιδοφόρα αίσθηση, όχι άγχος ότι κάτι λήγει. Μην αναφέρεις καθόλου συνδρομή ή πληρωμή, μόνο την ιδέα ότι ο ουρανός γράφει κάτι νέο κάθε φορά.
Μην αναφέρεις τίποτα για συνδρομή ή πληρωμή.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1500,
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
