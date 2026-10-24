// Αρχείο: netlify/functions/create-checkout.js
// Ανέβασέ το στο netlify/functions/create-checkout.js
// Νέο environment variable που χρειάζεται: STRIPE_SECRET_KEY (secret key από το Stripe dashboard, sk_live_... ή sk_test_... όσο δοκιμάζεις)

const PRODUCTS = {
  epistrofi: { name: "Η Επιστροφή της Χαμένης Αγάπης", price: 499 },
  epistrofi_q2: { name: "Επιστροφή της Χαμένης Αγάπης — 2η ερώτηση", price: 299 },
  epistrofi_q3: { name: "Επιστροφή της Χαμένης Αγάπης — 3η ερώτηση", price: 199 },
  oikonomika: { name: "Μια Φωτισμένη Οικονομική Αρχή", price: 499 },
  oikonomika_q2: { name: "Μια Φωτισμένη Οικονομική Αρχή — 2η ερώτηση", price: 299 },
  oikonomika_q3: { name: "Μια Φωτισμένη Οικονομική Αρχή — 3η ερώτηση", price: 199 },
  symvatotita: { name: "Ταιριάζετε; Η Πλήρης Συμβατότητά σας", price: 499 },
  symvatotita_q2: { name: "Ταιριάζετε; — 2η ερώτηση", price: 299 },
  symvatotita_q3: { name: "Ταιριάζετε; — 3η ερώτηση", price: 199 },
  erotima: { name: "Ρώτα το Μαντείο", price: 499 },
  erotima_q2: { name: "Ρώτα το Μαντείο, 2η ερώτηση", price: 299 },
  erotima_q3: { name: "Ρώτα το Μαντείο, 3η ερώτηση", price: 199 },
  agapi: { name: "Ο Χρησμός της Αγάπης", price: 499 },
  agapi_q2: { name: "Ο Χρησμός της Αγάπης, 2η ερώτηση", price: 299 },
  agapi_q3: { name: "Ο Χρησμός της Αγάπης, 3η ερώτηση", price: 199 },
  alitheia: { name: "Ο Χρησμός της Αλήθειας", price: 499 },
  alitheia_q2: { name: "Ο Χρησμός της Αλήθειας, 2η ερώτηση", price: 299 },
  alitheia_q3: { name: "Ο Χρησμός της Αλήθειας, 3η ερώτηση", price: 199 },
  numerology: { name: "Ο Χρησμός της Αριθμολογίας", price: 499 },
  numerology_q2: { name: "Ο Χρησμός της Αριθμολογίας, 2η ερώτηση", price: 299 },
  numerology_q3: { name: "Ο Χρησμός της Αριθμολογίας, 3η ερώτηση", price: 199 },
  taro: { name: "Το Τρίφυλλο Ταρώ", price: 499 },
  taro_q2: { name: "Το Τρίφυλλο Ταρώ — 2η ερώτηση", price: 299 },
  taro_q3: { name: "Το Τρίφυλλο Ταρώ — 3η ερώτηση", price: 199 },
  xartis: { name: "Ο Γενέθλιος Χάρτης σου, πλήρης ανάλυση", price: 3900 },
  xartis_plus: { name: "Ο Γενέθλιος Χάρτης σου, πλήρης ανάλυση και πρόβλεψη 12 μηνών", price: 5900 }
};

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
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { tool, returnUrl, reading_id, src } = JSON.parse(event.body);
    const product = PRODUCTS[tool];

    if (!product || !returnUrl) {
      return { statusCode: 400, body: JSON.stringify({ error: "Άγνωστο εργαλείο ή λείπει το returnUrl." }) };
    }

    // Το Stripe θα αντικαταστήσει το {CHECKOUT_SESSION_ID} με το πραγματικό id όταν στείλει πίσω τον χρήστη
    const separator = returnUrl.includes("?") ? "&" : "?";
    const successUrl = `${returnUrl}${separator}session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = returnUrl;

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

    // ΜΟΝΟ για δοκιμή στην προεπισκόπηση (deploy-preview): ο Γενέθλιος Χάρτης χρεώνεται 0,50€, για να
    // δοκιμαστεί ολόκληρη η ανάλυση με πραγματική πληρωμή. Στο manteio.live η τιμή μένει κανονική.
    // ΑΦΑΙΡΕΙΤΑΙ πριν ανέβει live.
    const host = String((event.headers && (event.headers.host || event.headers.Host)) || "");
    const previewTest = /^deploy-preview-\d+--/.test(host) && /^xartis/.test(tool);
    const unitAmount = previewTest ? 50 : product.price;

    const body = toFormBody({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: unitAmount,
            product_data: { name: product.name }
          }
        }
      ],
      metadata,
      // Για τον πλήρη χρησμό: τα χρήματα μόνο ΔΕΣΜΕΥΟΝΤΑΙ στην κάρτα. Χρεώνονται οριστικά μόνο όταν ο
      // χρησμός γραφτεί ολόκληρος. Αν δεν γραφτεί, η δέσμευση ακυρώνεται και η πελάτισσα δεν χρεώνεται.
      // Το ίδιο και για την 2η/3η ερώτηση της Επιστροφής: χρέωση μόνο όταν δοθεί απάντηση.
      ...((reading_id || tool === "epistrofi_q2" || tool === "epistrofi_q3") ? { payment_intent_data: { capture_method: "manual", metadata } } : {})
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
