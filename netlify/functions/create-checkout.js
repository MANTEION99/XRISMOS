// Αρχείο: netlify/functions/create-checkout.js
// Ανέβασέ το στο netlify/functions/create-checkout.js
// Νέο environment variable που χρειάζεται: STRIPE_SECRET_KEY (secret key από το Stripe dashboard, sk_live_... ή sk_test_... όσο δοκιμάζεις)

const PRODUCTS = {
  epistrofi: { name: "Η Επιστροφή της Χαμένης Αγάπης", price: 1499 },
  epistrofi_q2: { name: "Επιστροφή της Χαμένης Αγάπης — 2η ερώτηση", price: 299 },
  epistrofi_q3: { name: "Επιστροφή της Χαμένης Αγάπης — 3η ερώτηση", price: 199 },
  oikonomika: { name: "Μια Φωτισμένη Οικονομική Αρχή", price: 1499 },
  oikonomika_q2: { name: "Μια Φωτισμένη Οικονομική Αρχή — 2η ερώτηση", price: 299 },
  oikonomika_q3: { name: "Μια Φωτισμένη Οικονομική Αρχή — 3η ερώτηση", price: 199 },
  symvatotita: { name: "Ταιριάζετε; Η Πλήρης Συμβατότητά σας", price: 1499 },
  symvatotita_q2: { name: "Ταιριάζετε; — 2η ερώτηση", price: 299 },
  symvatotita_q3: { name: "Ταιριάζετε; — 3η ερώτηση", price: 199 }
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
    const { tool, returnUrl } = JSON.parse(event.body);
    const product = PRODUCTS[tool];

    if (!product || !returnUrl) {
      return { statusCode: 400, body: JSON.stringify({ error: "Άγνωστο εργαλείο ή λείπει το returnUrl." }) };
    }

    // Το Stripe θα αντικαταστήσει το {CHECKOUT_SESSION_ID} με το πραγματικό id όταν στείλει πίσω τον χρήστη
    const separator = returnUrl.includes("?") ? "&" : "?";
    const successUrl = `${returnUrl}${separator}session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = returnUrl;

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
      metadata: { tool }
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
