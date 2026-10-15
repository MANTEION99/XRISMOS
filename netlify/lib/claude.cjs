// Κοινή κλήση στο Claude για τα εργαλεία (μη streaming).
// Ξαναδοκιμάζει μία φορά αν το Claude απαντήσει με σφάλμα ή άδειο κείμενο, και αν το κείμενο
// κοπεί στο όριο μήκους, το κόβει στην τελευταία ολόκληρη πρόταση, ώστε να μη φαίνεται ποτέ μισή φράση.
const MODEL = "claude-sonnet-5";

function trimToSentence(text) {
  const i = Math.max(text.lastIndexOf("."), text.lastIndexOf("!"), text.lastIndexOf(";"), text.lastIndexOf("»"));
  return i > text.length * 0.5 ? text.slice(0, i + 1) : text;
}

async function callClaude(prompt, maxTokens = 3000) {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.content)) {
        lastError = `Claude ${res.status}: ${JSON.stringify(data.error || data).slice(0, 200)}`;
        console.error("[claude]", lastError);
        continue;
      }
      let text = data.content.filter(b => !b.type || b.type === "text").map(b => b.text || "").join("").trim();
      console.log(`[claude] stop=${data.stop_reason} chars=${text.length}`);
      if (!text) { lastError = "κενή απάντηση"; continue; }
      if (data.stop_reason === "max_tokens") text = trimToSentence(text);
      return text;
    } catch (e) {
      lastError = e.message;
      console.error("[claude]", e);
    }
  }
  throw new Error(lastError || "Το Claude δεν απάντησε");
}

module.exports = { callClaude, MODEL };
