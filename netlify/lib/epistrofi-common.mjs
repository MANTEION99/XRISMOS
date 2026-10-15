// Κοινός κώδικας για τον δωρεάν και τον πληρωμένο χρησμό της «Επιστροφής της Χαμένης Αγάπης».
// Δεν είναι function από μόνο του: το εισάγουν τα epistrofi-teaser.mjs και epistrofi-full.mjs.

import { getStore } from "@netlify/blobs";

export const MODEL = "claude-sonnet-5";

// Ένα «ντουλάπι» για τους χρησμούς και ένα για τα email που πήραν ήδη δωρεάν δείγμα.
export const readingsStore = () => getStore({ name: "epistrofi-readings", consistency: "strong" });
export const emailsStore = () => getStore({ name: "free-teaser-emails", consistency: "strong" });

export function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// Το input type="date" στέλνει πάντα YYYY-MM-DD.
function chartBody(dob, tob, lat, lon, tzone) {
  const [year, month, day] = String(dob).split("-").map(n => parseInt(n, 10));
  const [hour, min] = String(tob || "12:00").split(":").map(n => parseInt(n, 10));
  return {
    day, month, year,
    hour: Number.isFinite(hour) ? hour : 12,
    min: Number.isFinite(min) ? min : 0,
    lat: lat || 37.9838,   // αν δεν δόθηκαν συντεταγμένες, Αθήνα
    lon: lon || 23.7275,
    tzone: tzone || 2,
    house_type: "placidus"
  };
}

async function fetchChart(body) {
  const res = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": "en",
        "x-astrologyapi-key": process.env.ASTROLOGY_API_KEY
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  // Ένας σωστός χάρτης έχει πάντα λίστα πλανητών. Αλλιώς το AstrologyAPI απάντησε με σφάλμα
  // (κλειδί, όριο, λάθος στοιχεία) και ΔΕΝ αφήνουμε το Claude να γράψει χρησμό χωρίς χάρτη.
  if (!res.ok || !data || !Array.isArray(data.planets) || data.planets.length === 0) {
    console.error(`[astrologyapi] status=${res.status} key=${process.env.ASTROLOGY_API_KEY ? "set" : "MISSING"} body=${text.slice(0, 300)}`);
    throw new Error("Ο χάρτης δεν υπολογίστηκε");
  }
  return data;
}

// Υπολογίζει τους δύο χάρτες μία φορά. Το αποτέλεσμα αποθηκεύεται μαζί με τον χρησμό,
// ώστε η πληρωμένη συνέχεια να μη χρειάζεται νέα κλήση στο AstrologyAPI.
export async function computeCharts(p) {
  const [chart1, chart2] = await Promise.all([
    fetchChart(chartBody(p.dob1, p.tob1, p.lat1, p.lon1, p.tzone1)),
    p.dob2 ? fetchChart(chartBody(p.dob2, p.tob2, p.lat2, p.lon2, p.tzone2)) : Promise.resolve(null)
  ]);
  return { chart1, chart2 };
}

// Χωρίς ώρα γέννησης οι οίκοι και ο Ωροσκόπος βγαίνουν λάθος (υπολογίζονται για τις 12:00),
// οπότε τους αφαιρούμε εντελώς για να μην τους χρησιμοποιήσει ο χρησμός.
function chartForPrompt(chart, hasTime) {
  if (!chart || hasTime) return chart;
  const { houses, ascendant, midheaven, vertex, ...rest } = chart;
  return {
    ...rest,
    planets: (chart.planets || [])
      .filter(pl => !/ascendant|midheaven/i.test(pl.name || ""))
      .map(({ house, ...pl }) => pl)
  };
}

const timeNote = (name, hasTime) => hasTime
  ? ""
  : `\n(Για ${name} δεν δόθηκε ώρα γέννησης: ΜΗΝ αναφέρεις οίκους ούτε Ωροσκόπο. Μίλα μόνο για πλανήτες σε ζώδια και τις όψεις τους.)`;

export function chartsBlock(p, charts) {
  const t1 = /^\d{2}:\d{2}$/.test(p.tob1 || "");
  const t2 = /^\d{2}:\d{2}$/.test(p.tob2 || "");
  return `Στοιχεία ${p.name1}:${timeNote(p.name1, t1)}
${JSON.stringify(chartForPrompt(charts.chart1, t1))}

Στοιχεία ${p.name2}:${charts.chart2 ? timeNote(p.name2, t2) : ""}
${charts.chart2 ? JSON.stringify(chartForPrompt(charts.chart2, t2)) : "Δεν δόθηκε ημερομηνία γέννησης. Μίλα για αυτό το πρόσωπο μέσα από τον χάρτη του/της " + p.name1 + " (Αφροδίτη, Άρης, Σελήνη, Δεσμοί της Σελήνης" + (t1 ? ", 5ος, 7ος, 8ος οίκος" : "") + ")."}`;
}

const VOICE = `Είσαι ο Ιάκωβος, ο αστρολόγος του «Μαντείου». Έμπειρος, ζεστός, σοβαρός, με βαθιά γνώση. Το κοινό σου είναι κυρίως γυναίκες 50 έως 65 ετών στην Ελλάδα. Γράφεις στα ελληνικά, σε απλή και τρυφερή γλώσσα, με σύντομες προτάσεις.
Χρησιμοποιείς ΜΟΝΟ τα πραγματικά αστρολογικά δεδομένα που σου δίνονται. Δεν εφευρίσκεις θέσεις πλανητών.
Κάθε φορά που αναφέρεις αστρολογικό όρο, τον εξηγείς αμέσως σε καθημερινή γλώσσα μέσα στην ίδια πρόταση.
ΑΠΑΓΟΡΕΥΟΝΤΑΙ: οι λέξεις «ίσως» και «μπορεί», οι γενικόλογες φράσεις που ταιριάζουν σε όλους, οι ιατρικές οδηγίες, οι παύλες και τα σύμβολα όπως βελάκια. Γράφεις σε καθαρό, ανθρώπινο λόγο.
Δεν αναφέρεις ποτέ πληρωμή, τιμή, συνδρομή ή «ξεκλείδωμα».
Ο Ουρανός, ο Ποσειδώνας και ο Πλούτωνας μένουν χρόνια στο ίδιο ζώδιο και είναι ίδιοι για όλη μια γενιά: ΠΟΤΕ μην τους παρουσιάζεις ως κάτι προσωπικό ή μοναδικό, ούτε το ότι είναι στο ίδιο ζώδιο στους δύο χάρτες ως ξεχωριστό δεσμό. Τον χαρακτήρα και το δέσιμο τα στηρίζεις στον Ήλιο, τη Σελήνη, την Αφροδίτη, τον Άρη, τον Ερμή, τον Ωροσκόπο και τους Δεσμούς της Σελήνης.
Μένεις στο θέμα της αγάπης και της σχέσης. Δεν μιλάς για καριέρα ή επαγγελματικό δρόμο.
Δεν επαναλαμβάνεις την ίδια φράση ή ιδέα δύο φορές.`;

export function teaserPrompt(p, charts) {
  return `${VOICE}

${chartsBlock(p, charts)}

Η ${p.name1} ρωτά αν και πότε θα επιστρέψει στη ζωή της ο/η ${p.name2}.

Γράψε ΜΟΝΟ το άνοιγμα του χρησμού, 140 έως 170 λέξεις και ΠΟΤΕ πάνω από 180. Κάθε πρόταση να κερδίζει τη θέση της, χωρίς φλυαρία. Ο σκοπός του είναι να την πλησιάσει, να την αγγίξει και να νιώσει ότι κάποιος επιτέλους την καταλαβαίνει.
1. Ξεκίνα με προσωπικό χαιρετισμό με το όνομά της, π.χ. «Γεια σου ${p.name1} μου, εύχομαι η σημερινή μέρα να σε βρίσκει καλά», και συνέχισε αμέσως με το κυρίως κείμενο. Ο χαιρετισμός μόνος του ΔΕΝ είναι απάντηση.
2. Πες της δύο συγκεκριμένα χαρακτηριστικά του χαρακτήρα της, το καθένα δεμένο με μια πραγματική θέση από τον χάρτη της (πλανήτης, ζώδιο, οίκος). Να είναι τόσο ακριβή ώστε να σκεφτεί «με ξέρει».
3. Δείξε ότι βλέπεις τον πόνο της για αυτόν τον άνθρωπο, με μια πρόταση για το δέσιμο που φαίνεται ανάμεσα στους δύο χάρτες.
4. Κλείσε με μια πρόταση που ανοίγει την επόμενη σελίδα χωρίς να τη λέει: ότι ο χάρτης δείχνει καθαρά μια συγκεκριμένη περίοδο και μια κίνηση που θα κρίνει την επιστροφή του/της, και ότι αυτά ακολουθούν αμέσως παρακάτω. Μην πεις ποια είναι η περίοδος, μην πεις το αποτέλεσμα, μην δώσεις ποσοστό.
Ο τόνος να δείχνει απόλυτη επαγγελματική σοβαρότητα και βαθιά γνώση. Ολοκλήρωσε πάντα την τελευταία πρόταση με τελεία.`;
}

export function fullPrompt(p, charts, teaser) {
  const opening = teaser
    ? `Η ${p.name1} έχει ήδη διαβάσει το άνοιγμα του χρησμού της, που είναι αυτό:
"""
${teaser}
"""
Γράψε τη ΣΥΝΕΧΕΙΑ του. Μην ξαναχαιρετήσεις, μην επαναλάβεις όσα ειπώθηκαν και μην πεις τίποτα που να έρχεται σε αντίθεση με αυτά. Συνέχισε σαν να γυρίζει απλά η σελίδα.`
    : `Γράψε ολόκληρο τον χρησμό. Ξεκίνα με προσωπικό χαιρετισμό με το όνομά της, π.χ. «Γεια σου ${p.name1} μου, εύχομαι η σημερινή μέρα να σε βρίσκει καλά».`;

  return `${VOICE}

${chartsBlock(p, charts)}

Η ${p.name1} ρωτά αν και πότε θα επιστρέψει στη ζωή της ο/η ${p.name2}.

${opening}

Μήκος: 600 έως 800 λέξεις. Δομή, σε ρέοντα λόγο χωρίς τίτλους:
1. Οι συνδέσεις ανάμεσα στους δύο χάρτες: καρμικοί δεσμοί (Δεσμοί της Σελήνης), 5ος, 7ος και 8ος οίκος, Αφροδίτη και Άρης του καθενός, και τι λένε για το δέσιμό τους.
2. Παρατηρήσεις συμπεριφοράς: γιατί αυτός ο άνθρωπος φέρθηκε όπως φέρθηκε και τι νιώθει, όπως φαίνεται από τον χάρτη του/της.
3. Η απάντηση με κατεύθυνση: αν υπάρχει δρόμος επιστροφής και ΠΟΤΕ, με συγκεκριμένη χρονική περίοδο που βγαίνει από τις διελεύσεις (π.χ. ανάδρομη Αφροδίτη ή Ερμής πάνω στον 7ο οίκο ή στον κυβερνήτη του). Αυτή είναι η καρδιά του χρησμού και πρέπει να είναι σαφής.
4. Κλείσε θυμίζοντας με τρυφερότητα ότι η τελική έκβαση εξαρτάται και από την ελεύθερη βούληση.

Μορφή απάντησης, ΑΥΣΤΗΡΑ:
Η πρώτη γραμμή είναι ΜΟΝΟ: [ΠΟΣΟΣΤΟ: NN] όπου NN η πιθανότητα επανένωσης από 1 έως 99, συνεπής με όσα γράφεις.
Μετά το κείμενο του χρησμού.
Μετά, σε νέα γραμμή, ακριβώς [ΣΥΜΒΟΥΛΗ] και 2 έως 3 προτάσεις πρακτικής συμβουλής που βγαίνουν από τη συγκεκριμένη ανάλυση, όχι γενικότητες όπως «μίλα ανοιχτά» ή «δώσε χρόνο». Τελείωσε τη συμβουλή με μία πρόταση ότι ο ουρανός αλλάζει κάθε μήνα και η εικόνα τον επόμενο μήνα θα είναι διαφορετική.
Ολοκλήρωσε πάντα κάθε πρόταση. Αν πλησιάζεις το όριο, συντόμευσε νωρίτερα, ποτέ μην κόψεις στη μέση.`;
}

const wordCount = (t) => (t.trim().match(/\S+/g) || []).length;

// Καλεί το Claude με streaming. Κάθε κομμάτι κειμένου πηγαίνει στο onText,
// και στο τέλος επιστρέφεται ολόκληρο το κείμενο.
// Αν η απάντηση σταματήσει πρόωρα (κομμένη ροή, όριο, ή λιγότερες από minWords λέξεις),
// ζητά αυτόματα τη συνέχεια από το σημείο που σταμάτησε, έως δύο φορές, ώστε η πελάτισσα
// να μη δει ποτέ μισό χρησμό.
export async function streamClaude(prompt, maxTokens, onText, minWords = 0) {
  let full = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const p = attempt === 0 ? prompt : `${prompt}

Έχεις ήδη γράψει την αρχή, που είναι αυτή:
"""
${full}
"""
Συνέχισε ΑΚΡΙΒΩΣ από το σημείο που σταματά, με την επόμενη λέξη. Μην επαναλάβεις τίποτα από όσα γράφτηκαν, μην ξαναχαιρετήσεις, μη γράψεις εισαγωγή. Ολοκλήρωσε το κείμενο σύμφωνα με τις οδηγίες.`;
    let chunkStart = true;
    let r;
    try {
      r = await streamClaudeOnce(p, maxTokens, (t) => {
        if (chunkStart && full && !/\s$/.test(full) && !/^[\s.,;:!·»)]/.test(t)) t = " " + t;
        chunkStart = false;
        full += t;
        onText(t);
      });
    } catch (e) {
      if (!full) throw e;
      console.error("[claude] retry failed", e);
      break;
    }
    const words = wordCount(full);
    console.log(`[claude] attempt=${attempt} stop=${r.stopReason} ended=${r.ended} words=${words}`);
    if (r.ended && r.stopReason === "end_turn" && words >= minWords) return full;
    if (r.stopReason === "refusal") break;
  }
  if (wordCount(full) < Math.max(20, minWords / 2)) throw new Error("Η απάντηση βγήκε ελλιπής");
  return full;
}

async function streamClaudeOnce(prompt, maxTokens, onText) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      stream: true,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok || !res.body) {
    throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let stopReason = null;
  let ended = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        let evt;
        try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (evt.type === "content_block_delta" && evt.delta && evt.delta.type === "text_delta") {
          onText(evt.delta.text);
        } else if (evt.type === "message_delta" && evt.delta && evt.delta.stop_reason) {
          stopReason = evt.delta.stop_reason;
        } else if (evt.type === "message_stop") {
          ended = true;
        } else if (evt.type === "error") {
          console.error("[claude] stream error", JSON.stringify(evt.error));
          return { stopReason: "error", ended: false };
        }
      }
    }
  } catch (e) {
    // Η ροή κόπηκε στη μέση: ό,τι γράφτηκε μένει και ζητάμε τη συνέχεια.
    console.error("[claude] stream cut", e);
  }
  return { stopReason, ended };
}

// Επαληθεύει στο Stripe ότι η πληρωμή έγινε, ότι αφορά αυτό το εργαλείο
// και, όταν δίνεται, ότι αφορά ΑΥΤΟΝ τον συγκεκριμένο χρησμό.
export async function verifyStripeSession(sessionId, tool, readingId) {
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    const s = await res.json();
    if (s.payment_status !== "paid" || !s.metadata) return null;
    if (s.metadata.tool !== tool) return null;
    if (readingId && s.metadata.reading_id !== readingId) return null;
    return s;
  } catch {
    return null;
  }
}

export function streamResponse(producer, headers = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const write = (t) => controller.enqueue(encoder.encode(t));
      try {
        await producer(write);
      } catch (e) {
        console.error(e);
        write("\n<<<ΣΦΑΛΜΑ>>>");
      }
      controller.close();
    }
  });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}
