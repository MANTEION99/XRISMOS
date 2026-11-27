// Αρχείο: netlify/functions/create-checkout.js
// Ανέβασέ το στο netlify/functions/create-checkout.js
// Νέο environment variable που χρειάζεται: STRIPE_SECRET_KEY (secret key από το Stripe dashboard, sk_live_... ή sk_test_... όσο δοκιμάζεις)

const PRODUCTS = {
  epistrofi: { name: "Η Επιστροφή της Χαμένης Αγάπης", price: 2000 },
  epistrofi_q2: { name: "Επιστροφή της Χαμένης Αγάπης — 2η ερώτηση", price: 1200 },
  epistrofi_q3: { name: "Επιστροφή της Χαμένης Αγάπης — 3η ερώτηση", price: 800 },
  oikonomika: { name: "Μια Φωτισμένη Οικονομική Αρχή", price: 2000 },
  oikonomika_q2: { name: "Μια Φωτισμένη Οικονομική Αρχή — 2η ερώτηση", price: 1200 },
  oikonomika_q3: { name: "Μια Φωτισμένη Οικονομική Αρχή — 3η ερώτηση", price: 800 },
  symvatotita: { name: "Ταιριάζετε; Η Συναστρία σας", price: 2000 },
  symvatotita_q2: { name: "Ταιριάζετε; — 2η ερώτηση", price: 1200 },
  symvatotita_q3: { name: "Ταιριάζετε; — 3η ερώτηση", price: 800 },
  erotima: { name: "Ρώτα το Μαντείο", price: 2000 },
  erotima_q2: { name: "Ρώτα το Μαντείο, 2η ερώτηση", price: 1200 },
  erotima_q3: { name: "Ρώτα το Μαντείο, 3η ερώτηση", price: 800 },
  agapi: { name: "Ο Χρησμός της Αγάπης", price: 2000 },
  agapi_q2: { name: "Ο Χρησμός της Αγάπης, 2η ερώτηση", price: 1200 },
  agapi_q3: { name: "Ο Χρησμός της Αγάπης, 3η ερώτηση", price: 800 },
  alitheia: { name: "Ο Χρησμός της Αλήθειας", price: 2000 },
  alitheia_q2: { name: "Ο Χρησμός της Αλήθειας, 2η ερώτηση", price: 1200 },
  alitheia_q3: { name: "Ο Χρησμός της Αλήθειας, 3η ερώτηση", price: 800 },
  numerology: { name: "Ο Χρησμός της Αριθμολογίας", price: 2000 },
  numerology_q2: { name: "Ο Χρησμός της Αριθμολογίας, 2η ερώτηση", price: 1200 },
  numerology_q3: { name: "Ο Χρησμός της Αριθμολογίας, 3η ερώτηση", price: 800 },
  taro: { name: "Το Τρίφυλλο Ταρώ", price: 2000 },
  taro_q2: { name: "Το Τρίφυλλο Ταρώ — 2η ερώτηση", price: 1200 },
  taro_q3: { name: "Το Τρίφυλλο Ταρώ — 3η ερώτηση", price: 800 },
  synomilia: { name: "Η προσωπική συνομιλία με Το Μαντείο, 5 ερωτήσεις", price: 5900 },
  xartis: { name: "Ο Γενέθλιος Χάρτης σου, πλήρης ανάλυση", price: 6900 },
  xartis_plus: { name: "Ο Γενέθλιος Χάρτης σου, πλήρης ανάλυση και πρόβλεψη 12 μηνών", price: 9900 },
  // Η τιμή του ημερολογίου ορίζεται τη στιγμή της πληρωμής: 29,99€, ή 14,99€ στη Black Friday (27 έως 30/11/2026).
  imerologio: { name: "Οι καλές σου μέρες του 2027, προσωπικό ημερολόγιο", price: 4900 },
  paidi: { name: "Ο χάρτης του παιδιού ή του εγγονιού", price: 4900 },
  // Η τιμή ορίζεται τη στιγμή της πληρωμής: 2,99€ ως και τις 2/12/2026, μετά 4,99€.
  tyxeres: { name: "Οι τυχερές μέρες της εβδομάδας", price: 2000 }
};

// Ίδιος κανόνας με το netlify/lib/imerologio.mjs (priceNow).
function imerologioPrice(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return day >= "2026-11-27" && day <= "2026-11-30" ? 1499 : 4900;
}

// Ίδιος κανόνας με το netlify/lib/tyxeres.mjs (priceNow).
function tyxeresPrice(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return 2000;
}

// Το Stripe REST API περιμένουν form-urlencoded body με bracket notation για nested δεδομένα
// (π.χ. line_items[0][price_data][unit_amount]). Αυτή η συνάρτηση το χτίζει αυτόματα.
function toFormBody(params, prefix = "") {
  const parts = [];
  for (const key in params) {
    const value = params[key];
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      parts.push(toFormBody(value, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item && typeof item === "object") {
          parts.push(toFormBody(item, `${fullKey}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(item)}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(value)}`);
    }
  }
  return parts.join("&");
}

exports.handler = async function (event) {
  // Ζέσταμα από τη σελίδα (μόλις φανεί το κουμπί πληρωμής): ξυπνάει ο server και φέρνει από πριν το κλειδί της Viva.
  // Δεν δημιουργεί καμία παραγγελία ή πληρωμή.
  if (event.httpMethod === "GET" && event.queryStringParameters && event.queryStringParameters.warm) {
    try { const { vivaWarm } = await import("../lib/viva.mjs"); await vivaWarm(); } catch (e) {}
    return { statusCode: 204, headers: { "Cache-Control": "no-store" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { tool, returnUrl, reading_id, src, provider } = JSON.parse(event.body);
    const product = PRODUCTS[tool] && { ...PRODUCTS[tool] };
    if (product && tool === "imerologio") product.price = imerologioPrice();
    if (product && tool === "tyxeres") product.price = tyxeresPrice();

    if (!product || !returnUrl) {
      return { statusCode: 400, body: JSON.stringify({ error: "Άγνωστο εργαλείο ή λείπει το returnUrl." }) };
    }

    // Το Stripe θα αντικαταστήσει το {CHECKOUT_SESSION_ID} με το πραγματικό id όταν στείλει πίσω τον χρήστη
    const separator = returnUrl.includes("?") ? "&" : "?";
    const successUrl = `${returnUrl}${separator}session_id={CHECKOUT_SESSION_ID}`;
    // Αν ακυρώσει στο Stripe, γυρίζει με pay=back και του βγαίνει μήνυμα για νέα προσπάθεια.
    const cancelUrl = returnUrl + (returnUrl.includes("?") ? "&" : "?") + "pay=back";

    // Για τον δωρεάν χρησμό που συνεχίζεται μετά την πληρωμή: η πληρωμή δένεται με τον συγκεκριμένο χρησμό.
    const metadata = { tool };
    // Από ποιο post ήρθε (σύντομο link), για να φαίνεται και στο Stripe.
    const cleanSrc = String(src || "").replace(/[^\w\/.-]/g, "").slice(0, 80);
    if (cleanSrc) metadata.src = cleanSrc;
    if (reading_id) {
      if (!/^[0-9a-f-]{36}$/.test(String(reading_id))) {
        return { statusCode: 400, body: JSON.stringify({ error: "Λάθος χρησμός." }) };
      }
      metadata.reading_id = String(reading_id);
    }

    // Οι Εκλεκτοί του Μαντείου: μηνιαία συνδρομή (μόνο κάρτα). Η ερώτηση που άνοιξε την πληρωμή περιλαμβάνεται.
    if (provider === "eklektoi") {
      const Q1 = ["epistrofi", "agapi", "alitheia", "symvatotita", "oikonomika", "erotima", "numerology", "taro"];
      if (!Q1.includes(tool)) return { statusCode: 400, body: JSON.stringify({ error: "Η συνδρομή δεν ισχύει για αυτή την υπηρεσία." }) };
      const origin = new URL(returnUrl).origin;
      const subBody = toFormBody({
        mode: "subscription",
        success_url: `${origin}/eklektoi?sid={CHECKOUT_SESSION_ID}&ret=${encodeURIComponent(returnUrl)}`,
        cancel_url: cancelUrl,
        line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: 1290, recurring: { interval: "month" }, product_data: { name: "Οι Εκλεκτοί του Μαντείου" } } }],
        metadata: { ...metadata, kind: "eklektoi" },
        subscription_data: { metadata: { ...metadata, kind: "eklektoi" } }
      }).replace(encodeURIComponent("{CHECKOUT_SESSION_ID}"), "{CHECKOUT_SESSION_ID}");
      const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        body: subBody
      });
      const ss = await r.json();
      if (!ss.url) return { statusCode: 500, body: JSON.stringify({ error: "Το Stripe δεν επέστρεψε session.", details: ss }) };
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: ss.url }) };
    }

    // IRIS και άλλοι τρόποι μέσω Viva, όταν η πελάτισσα το διαλέξει.
    if (provider === "viva") {
      require("@netlify/blobs").connectLambda(event);
      const { vivaReady, vivaCreateOrder } = await import("../lib/viva.mjs");
      if (!vivaReady()) return { statusCode: 400, body: JSON.stringify({ error: "Η πληρωμή με IRIS δεν είναι ακόμα διαθέσιμη." }) };
      const url = await vivaCreateOrder({ tool, name: product.name, priceCents: product.price, readingId: metadata.reading_id, returnUrl, src: metadata.src });
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) };
    }

    const body = toFormBody({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: product.price,
            product_data: { name: product.name }
          }
        }
      ],
      metadata,
      // Για τον πλήρη χρησμό: τα χρήματα μόνο ΔΕΣΜΕΥΟΝΤΑΙ στην κάρτα. Χρεώνονται οριστικά μόνο όταν ο
      // χρησμός γραφτεί ολόκληρος. Αν δεν γραφτεί, η δέσμευση ακυρώνεται και η πελάτισσα δεν χρεώνεται.
      // Το ίδιο και για την 2η/3η ερώτηση της Επιστροφής: χρέωση μόνο όταν δοθεί απάντηση.
      // Το ημερολόγιο και οι τυχερές μέρες είναι έτοιμα από πριν, οπότε χρεώνονται κανονικά, χωρίς δέσμευση.
      ...(((reading_id && tool !== "imerologio" && tool !== "tyxeres") || tool === "epistrofi_q2" || tool === "epistrofi_q3") ? { payment_intent_data: { capture_method: "manual", metadata } } : {})
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}`
      },
      body
    });

    const session = await stripeRes.json();

    if (!session.url) {
      return { statusCode: 500, body: JSON.stringify({ error: "Το Stripe δεν επέστρεψε session.", details: session }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Κάτι πήγε στραβά στη δημιουργία πληρωμής.", details: error.message })
    };
  }
};
