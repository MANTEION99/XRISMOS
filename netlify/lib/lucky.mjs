// Το δώρο του πληρωμένου χρησμού: η πιο τυχερή μέρα της εβδομάδας που έρχεται.
// Υπολογίζεται μία φορά, από τη μέρα της πληρωμής, και μένει αποθηκευμένη στον χρησμό.
import { natalPoints, luckyWeek } from "./imerologio.mjs";

const LUCKY_TOOLS = new Set(["erotima", "epistrofi", "symvatotita", "agapi", "alitheia", "oikonomika", "numerology"]);

export async function luckyFor(reading, store, key) {
  if (!reading || reading.lucky !== undefined) return reading ? reading.lucky : null;
  if (!LUCKY_TOOLS.has(reading.tool) || (reading.stage && reading.stage !== "q1")) return null;
  const p = reading.inputs || {};
  let lucky = null;
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.dob1 || "")) {
      const N = (await natalPoints({ dob: p.dob1, tob: p.tob1, pob: p.pob1 })).pts;
      lucky = luckyWeek(N, new Date(reading.firstPaidAt || Date.now()));
    }
  } catch (e) { console.log("[lucky] " + e.message); return null; }
  try { await store.setJSON(key, { ...reading, lucky }); } catch (e) {}
  return lucky;
}
