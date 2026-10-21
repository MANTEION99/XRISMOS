const { callClaude } = require("../lib/claude.cjs");
const { fixText, audit } = require("../lib/text-check.cjs");
const { REDIRECT_RULES } = require("../lib/safety.cjs");
const astro = require("../lib/astro.cjs");
// Αρχείο: netlify/functions/epistrofi-agora.js
// Η ΕΠΙ ΠΛΗΡΩΜΗ (14,99€) εκδοχή, ξεχωριστή από το epistrofi.js που μένει δωρεάν μέσα στη συνδρομή.
// Ανέβασέ το στο netlify/functions/epistrofi-agora.js
// Χρειάζεται τα ίδια environment variables (ASTROLOGY_API_KEY, ANTHROPIC_API_KEY) + το νέο STRIPE_SECRET_KEY
// Χρησιμοποιείται πλέον για τη 2η και 3η ερώτηση (και για παλιές πληρωμές πριν τον δωρεάν χρησμό).
// Κάθε πληρωμή δίνει ΜΙΑ απάντηση: αν ξαναχρησιμοποιηθεί ο ίδιος σύνδεσμος, επιστρέφεται η ίδια απάντηση.

const { getStore, connectLambda } = require("@netlify/blobs");

async function getSession(sessionId) {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`, {
    headers: { "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  return res.json();
}

// Δεκτή είναι πληρωμή που έχει χρεωθεί ή που έχει μόνο δεσμευτεί (χρέωση μόνο όταν δοθεί απάντηση).
async function verifyPaidSession(sessionId, expectedTool) {
  if (!sessionId) return null;
  try {
    const session = await getSession(sessionId);
    const pi = session.payment_intent;
    const piStatus = pi && typeof pi === "object" ? pi.status : null;
    const ok = session.payment_status === "paid" || piStatus === "requires_capture" || piStatus === "succeeded";
    if (!ok || !session.metadata || !session.metadata.tool) return null;
    // Οι πληρωμές του νέου πλήρους χρησμού εξυπηρετούνται μόνο από το epistrofi-full.
    if (session.metadata.reading_id) return null;
    const paidTool = session.metadata.tool;
    return (paidTool === expectedTool || paidTool.startsWith(expectedTool + "_q")) ? session : null;
  } catch (e) {
    return null;
  }
}

// Meta Conversions API (ίδια λογική με το netlify/lib/epistrofi-common.mjs): μόνο με συγκατάθεση cookies.
async function sendCapiPurchase(session) {
  try {
    const token = process.env.META_CAPI_TOKEN;
    const pixel = process.env.META_PIXEL_ID || "1662226415478227";
    const md = (session && session.metadata) || {};
    if (!token || !session || md.mc !== "1") return;
    const email = String((session.customer_details && session.customer_details.email) || session.customer_email || "").trim().toLowerCase();
    const user_data = {};
    if (email) user_data.em = [require("crypto").createHash("sha256").update(email).digest("hex")];
    if (md.fbp) user_data.fbp = md.fbp;
    if (md.fbc) user_data.fbc = md.fbc;
    const res = await fetch(`https://graph.facebook.com/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [{
        event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), event_id: "purchase_" + session.id,
        action_source: "website", event_source_url: "https://manteio.live/epistrofi", user_data,
        custom_data: { currency: "EUR", value: (session.amount_total || 0) / 100, content_name: md.tool || "" }
      }] })
    });
    if (!res.ok) console.error("[capi]", res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    console.error("[capi]", e && e.message);
  }
}

// Οριστική χρέωση της δέσμευσης, μόνο αφού δοθεί απάντηση.
async function capturePayment(session) {
  const pi = session && session.payment_intent;
  if (!pi || typeof pi !== "object" || pi.status !== "requires_capture") return;
  try {
    const capRes = await fetch(`https://api.stripe.com/v1/payment_intents/${pi.id}/capture`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    if (capRes.ok) await sendCapiPurchase(session);
  } catch (e) {
    console.error("[capture]", e.message);
  }
}

async function generate({ name1, dob1, tob1, pob1, name2, dob2, tob2, pob2, question, stage }) {
  // Μήκος απάντησης στις ερωτήσεις: η 2η (2,99€) λίγο μεγαλύτερη από την 3η (1,99€).
  const qWords = stage === "q3" ? "160 έως 200 λέξεις" : "200 έως 250 λέξεις";
  // Πραγματικός τόπος γέννησης (συντεταγμένες και ζώνη ώρας). Αν δεν βρεθεί: Αθήνα.
  const [pl1, pl2] = await Promise.all([astro.place(pob1, dob1, tob1), astro.place(pob2, dob2, tob2)]);

  // --- Βήμα 1: πραγματικά αστρολογικά δεδομένα, παράλληλα για ταχύτητα ---
  const [d1, m1, y1] = dob1.split("-").reverse();
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
  const mainInstruction = question
    ? `Ο/Η ${name1} έχει ήδη λάβει μια πρώτη ανάλυση για τη σχέση με τον/την ${name2} και τώρα θέτει μια ΝΕΑ ερώτηση: "${question}".

Πρώτα κατάταξε σιωπηλά την ερώτηση σε μία από τρεις κατηγορίες και ακολούθησε ΜΟΝΟ τον αντίστοιχο κανόνα:

Α) Αφορά τη σχέση, τον/την ${name2}, τα συναισθήματά του/της, άλλο πρόσωπο στη ζωή του/της ή την καρδιά της/του γενικά: γράψε μια προσωπική, συναισθηματική απάντηση (${qWords}) ΑΚΡΙΒΩΣ σε αυτή την ερώτηση, από τους δύο χάρτες, χωρίς να επαναλαμβάνεις την πρώτη ανάλυση. Το επιπλέον μήκος το χρησιμοποιείς για να εξηγήσεις τι σημαίνει αυτό για τη ζωή της/του και τι να κάνει, όχι για να προσθέσεις κι άλλους πλανήτες.

Β) Αφορά άλλο κομμάτι της δικής της/του ζωής (δουλειά, χρήματα, σπίτι, μετακόμιση, οικογένεια, φίλοι, ταξίδι): απάντησε από τον ΔΙΚΟ ΤΗΣ/ΤΟΥ χάρτη μόνο και από τις κινήσεις των άστρων των επόμενων μηνών, ΧΩΡΙΣ να μπλέξεις τον/την ${name2} στην πρόβλεψη. ${qWords}, ίδιος ζεστός τόνος, πραγματική απάντηση στο ερώτημα. Στην τελευταία πρόταση του κειμένου δέσε διακριτικά με την καρδιά της/του, χωρίς να υπόσχεσαι τίποτα για τη σχέση.

Γ) Ανήκει σε μία από τις περιπτώσεις του ΚΑΝΟΝΑ ΑΣΦΑΛΕΙΑΣ: ακολουθείς ΜΟΝΟ αυτόν τον κανόνα και αγνοείς όλες τις υπόλοιπες οδηγίες μορφής.

${REDIRECT_RULES}`
    : `Γράψε μια προσωπική, συναισθηματική ανάλυση (100-120 λέξεις, στα ελληνικά) για το αν και πότε μπορεί να επανέλθει ο/η ${name2} στη ζωή του/της, βασισμένη σε καρμικές όψεις ανάμεσα στους δύο χάρτες (Δεσμοί Σελήνης, 5ος/7ος/8ος οίκος) και διελεύσεις (αναδρομικός Ερμής/Αφροδίτη πάνω στον 7ο οίκο ή τον κυβερνήτη του).`;

  const prompt = `Είσαι ένας έμπειρος, ζεστός Έλληνας αστρολόγος που γράφει για το "Μαντείο". Το κοινό σου είναι κυρίως γυναίκες 50-65 ετών. Παρακάτω σου δίνω ΠΡΑΓΜΑΤΙΚΑ υπολογισμένα αστρολογικά δεδομένα (θέσεις πλανητών, οίκους, όψεις). Χρησιμοποίησέ τα σαν βάση, μην εφευρίσκεις νέα δεδομένα εκτός αυτών.

Στοιχεία Ατόμου 1 (${name1}):
${astro.forPrompt(astroData1, tob1, name1, dob1, pl1.tzName)}

Στοιχεία Ατόμου 2 (${name2}):
${astroData2 ? astro.forPrompt(astroData2, tob2, name2, dob2, pl2.tzName) : "Δεν δόθηκαν, μίλα πιο γενικά γι' αυτό το πρόσωπο."}

${mainInstruction}

ΓΛΩΣΣΑ: Χρησιμοποίησε τους αστρολογικούς όρους σαν άρωμα, όχι σαν κύριο περιεχόμενο. Κάθε φορά που αναφέρεις έναν τεχνικό όρο, εξήγησέ τον αμέσως σε απλή, καθημερινή γλώσσα μέσα στην ίδια πρόταση. Σύντομες προτάσεις, ζεστός τόνος.

${question ? "ΔΕΝ γράφεις ποσοστό: η πιθανότητα επανένωσης δόθηκε στον πρώτο χρησμό. Ξεκίνα κατευθείαν με την απάντηση.\nΓράψε το κείμενο" : "Ξεκίνα την απάντησή σου ΜΟΝΟ με έναν αριθμό ποσοστού σε αυτή τη μορφή: [ΠΟΣΟΣΤΟ: 67]\nΜετά γράψε το κείμενο"}, μιλώντας απευθείας στο άτομο 1, με ζεστασιά και μυστήριο. Κλείσε υπενθυμίζοντας ότι η τελική έκβαση εξαρτάται από την ελεύθερη βούληση.

ΥΠΟΧΡΕΩΤΙΚΟ: Μετά, σε νέα γραμμή, γράψε ΑΚΡΙΒΩΣ [ΣΥΜΒΟΥΛΗ] και αμέσως μετά 2-3 προτάσεις πρακτικής συμβουλής. Η συμβουλή ΔΕΝ επιτρέπεται να είναι γενική ή κοινότοπη φράση όπως "μίλα ανοιχτά", "δώσε χρόνο", "μείνε ανοιχτή" χωρίς περαιτέρω εξειδίκευση. Πρέπει να αναφέρεται σε κάτι συγκεκριμένο που προκύπτει από την ίδια την αστρολογική ανάλυση που μόλις έγραψες. Κλείσε με μία σύντομη πρόταση ότι τα άστρα αλλάζουν κάθε μήνα και η εικόνα τον επόμενο μήνα θα είναι διαφορετική. Μην αναφέρεις τίποτα για συνδρομή ή πληρωμή.

ΠΟΛΥ ΣΗΜΑΝΤΙΚΟ: Πρέπει να ολοκληρώσεις πάντα κάθε πρόταση και ολόκληρο το κείμενο κανονικά, ποτέ να μην κοπεί στη μέση λέξης ή πρότασης. Αν πλησιάζεις στο όριο μήκους, συντόμευσε νωρίτερα (λιγότερες λεπτομέρειες, πιο σύντομη συμβουλή) αλλά πάντα κλείσε το κείμενο ολοκληρωμένο, με τελεία στο τέλος.`;

  const fullPromptText = prompt + astro.RULES + astro.sky({ name1, name2, tob1, dob1 }, astroData1, astroData2);
  const raw = await callClaude(fullPromptText, 3000);
  const { text, fixes } = fixText(raw);
  const checks = audit(text, fullPromptText);
  if (fixes.length || checks.length) console.warn(`[epistrofi-agora] έλεγχος κειμένου: διορθώσεις=${JSON.stringify(fixes)} θέματα=${JSON.stringify(checks)}`);
  return text;
}
exports.generate = generate;

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const {
      name1, dob1, tob1, pob1, lat1, lon1, tzone1,
      name2, dob2, tob2, pob2, lat2, lon2, tzone2,
      session_id, question, stage
    } = JSON.parse(event.body);

    const adult = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || "")); if (!m) return true; const t = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Athens" })); let a = t.getFullYear() - +m[1]; if (t.getMonth() + 1 < +m[2] || (t.getMonth() + 1 === +m[2] && t.getDate() < +m[3])) a--; return a >= 18; };
    if (!adult(dob1) || (dob2 && !adult(dob2))) {
      return { statusCode: 403, body: JSON.stringify({ error: "Το Μαντείο απευθύνεται μόνο σε ενήλικες (18+)." }) };
    }
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
      await capturePayment(paid);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reading: previous.reading })
      };
    }

    const text = await generate({ name1, dob1, tob1, pob1, name2, dob2, tob2, pob2, question, stage });

    // Ερώτηση που δεν απαντιέται (υγεία, νομικά, ακατανόητη): η πληρωμή ΔΕΝ καταναλώνεται.
    if (question && /\[\s*ΑΝΑΚΑΤΕΥΘΥΝΣΗ\s*\]/.test(text)) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirect: true, message: text.replace(/\[\s*ΑΝΑΚΑΤΕΥΘΥΝΣΗ\s*\]/, "").trim() })
      };
    }

    await usedSessions.setJSON(session_id, { reading: text, tool: "epistrofi", at: new Date().toISOString() });
    await capturePayment(paid);

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
