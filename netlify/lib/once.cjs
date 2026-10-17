// «Μία πληρωμή, ένας χρησμός»: η πρώτη επιτυχημένη απάντηση για κάθε πληρωμή (Stripe session)
// αποθηκεύεται. Αν ο ίδιος σύνδεσμος ξαναχρησιμοποιηθεί (ανανέωση σελίδας, άλλα ονόματα, νέο τράβηγμα
// χαρτιών), επιστρέφεται η ίδια απάντηση και δεν γράφεται νέος χρησμός.
const { getStore, connectLambda } = require("@netlify/blobs");

function oncePerPayment(handler, toolName) {
  return async function (event, context) {
    let sessionId = null;
    let store = null;
    try {
      const body = JSON.parse(event.body || "{}");
      sessionId = typeof body.session_id === "string" && /^cs_[A-Za-z0-9_]{10,200}$/.test(body.session_id) ? body.session_id : null;
      if (sessionId && event.httpMethod === "POST") {
        connectLambda(event);
        store = getStore({ name: "used-sessions" });
        const previous = await store.get(sessionId, { type: "json" });
        if (previous && previous.response) return previous.response;
      }
    } catch (e) {
      console.error("[once] ανάγνωση: " + e.message);
    }

    const response = await handler(event, context);

    if (store && sessionId && response && response.statusCode === 200) {
      try {
        await store.setJSON(sessionId, { response, tool: toolName, at: new Date().toISOString() });
      } catch (e) {
        console.error("[once] αποθήκευση: " + e.message);
      }
    }
    return response;
  };
}

module.exports = { oncePerPayment };
