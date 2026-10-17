const { callClaude } = require("../lib/claude.cjs");
// Αρχείο: netlify/functions/numerology.js
// Ανέβασέ το ακριβώς σε αυτόν τον φάκελο μέσα στο repo σου: netlify/functions/numerology.js
// Χρειάζεται μόνο: ANTHROPIC_API_KEY (δεν χρειάζεται ASTROLOGY_API_KEY, εδώ ο υπολογισμός γίνεται τοπικά)

// Αντιστοίχιση ελληνικών γραμμάτων σε αριθμούς 1-9 (κυκλική, απλοποιημένη αριθμολογική μέθοδος)
const GREEK_MAP = {
  "Α":1,"Β":2,"Γ":3,"Δ":4,"Ε":5,"Ζ":6,"Η":7,"Θ":8,"Ι":9,
  "Κ":1,"Λ":2,"Μ":3,"Ν":4,"Ξ":5,"Ο":6,"Π":7,"Ρ":8,"Σ":9,
  "Τ":1,"Υ":2,"Φ":3,"Χ":4,"Ψ":5,"Ω":6
};

// Αν το όνομα είναι γραμμένο με λατινικά (π.χ. «Maria»), η κλασική πυθαγόρεια αντιστοίχιση,
// ώστε ο αριθμός να μη βγαίνει λάθος.
const LATIN_MAP = {
  A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,I:9,J:1,K:2,L:3,M:4,N:5,O:6,P:7,Q:8,R:9,
  S:1,T:2,U:3,V:4,W:5,X:6,Y:7,Z:8
};

function stripAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function reduceNumber(num) {
  // Κρατάει τους master numbers 11, 22, 33
  while (num > 9 && num !== 11 && num !== 22 && num !== 33) {
    num = String(num).split("").reduce((sum, d) => sum + parseInt(d), 0);
  }
  return num;
}

function calcLifePathNumber(dob) {
  // dob έρχεται σε μορφή YYYY-MM-DD
  const digits = dob.replace(/-/g, "").split("").map(Number);
  const total = digits.reduce((sum, d) => sum + d, 0);
  return reduceNumber(total);
}

function calcNameNumber(name) {
  const upper = stripAccents(name.toUpperCase());
  let total = 0;
  for (const ch of upper) {
    if (GREEK_MAP[ch]) total += GREEK_MAP[ch];
    else if (LATIN_MAP[ch]) total += LATIN_MAP[ch];
  }
  return reduceNumber(total || 1);
}

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
    const { name1, dob1 } = JSON.parse(event.body);

    if (!name1 || !dob1) {
      return { statusCode: 400, body: JSON.stringify({ error: "Λείπουν απαραίτητα στοιχεία." }) };
    }

    const lifePath = calcLifePathNumber(dob1);
    const nameNumber = calcNameNumber(name1);

    const prompt = `Είσαι μια έμπειρη, ζεστή Ελληνίδα αριθμολόγος που γράφει για το "Μαντείο". Το κοινό σου είναι κυρίως γυναίκες 50-65 ετών. Παρακάτω σου δίνω ΠΡΑΓΜΑΤΙΚΑ υπολογισμένους αριθμούς αριθμολογίας. Χρησιμοποίησέ τους σαν βάση, μην εφευρίσκεις άλλους αριθμούς.

Όνομα: ${name1}
Αριθμός Ζωής (από την ημερομηνία γέννησης): ${lifePath}
Αριθμός Ονόματος: ${nameNumber}

Γράψε μια προσωπική, ζεστή ανάλυση (100-120 λέξεις, στα ελληνικά) που εξηγεί τι σημαίνει ο συνδυασμός αυτών των δύο αριθμών για τον χαρακτήρα και τη μοίρα του/της ${name1}, και εντοπίζει ένα συγκεκριμένο μοτίβο συμπεριφοράς που πιθανόν επαναλαμβάνεται σε κάθε σημαντική απόφαση της ζωής του/της (π.χ. στην αγάπη, στην καριέρα, ή στις σχέσεις), με βάση τη γνωστή σημασία αυτών των αριθμών στην αριθμολογία (π.χ. ο Αριθμός Ζωής 1 δείχνει ηγετικό πνεύμα και ανάγκη ανεξαρτησίας, το 2 ευαισθησία και ανάγκη συνεργασίας, το 3 δημιουργικότητα και ανάγκη έκφρασης, το 4 πρακτικότητα και ανάγκη σταθερότητας, το 5 ανάγκη ελευθερίας και αλλαγής, το 6 ανάγκη φροντίδας των άλλων, το 7 εσωστρέφεια και ανάγκη νοήματος, το 8 ανάγκη υλικής επιτυχίας και ελέγχου, το 9 ανάγκη προσφοράς, οι master numbers 11/22/33 δείχνουν αυξημένη πνευματική ευαισθησία και ευθύνη).

ΓΛΩΣΣΑ: Ζεστός, προσωπικός τόνος, σαν να μιλάς κατευθείαν στο άτομο. Σύντομες προτάσεις.

Ξεκίνα την απάντησή σου ΜΟΝΟ με τη μορφή: [ΑΡΙΘΜΟΣ_ΖΩΗΣ: ${lifePath}][ΑΡΙΘΜΟΣ_ΟΝΟΜΑΤΟΣ: ${nameNumber}]
Μετά γράψε το κείμενο.

ΥΠΟΧΡΕΩΤΙΚΟ: Μετά, σε νέα γραμμή, γράψε ΑΚΡΙΒΩΣ [ΣΥΜΒΟΥΛΗ] και αμέσως μετά 2-3 προτάσεις πρακτικής συμβουλής, συγκεκριμένης πάνω στο μοτίβο που μόλις περιέγραψες, όχι γενικόλογης. Μην αναφέρεις τίποτα για συνδρομή ή πληρωμή.

ΠΟΛΥ ΣΗΜΑΝΤΙΚΟ: Πρέπει να ολοκληρώσεις πάντα κάθε πρόταση και ολόκληρο το κείμενο κανονικά, ποτέ να μην κοπεί στη μέση λέξης ή πρότασης. Αν πλησιάζεις στο όριο μήκους, συντόμευσε νωρίτερα αλλά πάντα κλείσε το κείμενο ολοκληρωμένο, με τελεία στο τέλος.`;

    const text = await callClaude(prompt, 3000);

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
