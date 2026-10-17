// ΠΡΟΣΩΡΙΝΟ: δοκιμή 2ης ερώτησης χωρίς πληρωμή. Δουλεύει ΜΟΝΟ σε deploy preview. Θα διαγραφεί.
const { generate } = require("./epistrofi-agora.js");

const QUESTIONS = [
  "Με σκέφτεται ακόμα;",
  "Υπάρχει άλλη γυναίκα στη ζωή του;",
  "Θα βρω καλύτερη δουλειά μέσα στη χρονιά;",
  "Θα πάει καλά η μετακόμισή μου στη Θεσσαλονίκη;",
  "Θα γίνει καλά η μητέρα μου από την επέμβαση;",
  "Θα κερδίσω το δικαστήριο για το σπίτι;",
  "ασδφ κκκ"
];

exports.handler = async function (event) {
  const host = (event.headers && (event.headers.host || event.headers.Host)) || "";
  if (!host.includes("deploy-preview")) return { statusCode: 404, body: "Not found" };
  const i = parseInt((event.queryStringParameters || {}).i || "0", 10);
  const question = QUESTIONS[i];
  if (!question) return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: QUESTIONS.length }) };
  const t0 = Date.now();
  try {
    const text = await generate({
      name1: "Μαρία", dob1: "1968-05-12", tob1: "",
      name2: "Γιώργος", dob2: "1965-09-03", tob2: "",
      question
    });
    return { statusCode: 200, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, seconds: Math.round((Date.now() - t0) / 1000), text }) };
  } catch (e) {
    return { statusCode: 200, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, seconds: Math.round((Date.now() - t0) / 1000), error: e.message }) };
  }
};
