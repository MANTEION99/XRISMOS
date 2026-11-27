// Τρέχει μόνο του κάθε Δευτέρα πρωί (περίπου 08:00 ώρα Ελλάδας) και βρίσκει τις νέες ειδοποιήσεις των Εκλεκτών.
import { runAll } from "../lib/eklektoi-alerts.mjs";

export default async () => {
  const r = await runAll();
  console.log("[eklektoi-alerts]", JSON.stringify(r));
  return new Response("ok");
};

export const config = { schedule: "0 6 * * 1" };
