// «Οι καλές σου μέρες του 2027»: ο ΔΩΡΕΑΝ Ιανουάριος.
// Υπολογίζει όλη τη χρονιά από τον χάρτη της, την αποθηκεύει και στέλνει πίσω μόνο τον Ιανουάριο.
// Οι υπόλοιποι 11 μήνες δίνονται από το imerologio-full, μόνο μετά την πληρωμή.

import { json, normalizeEmail, isValidEmail, isAdult, ADULTS_ONLY } from "../lib/epistrofi-common.mjs";
import { oracleStore } from "../lib/oracle-store.mjs";
import { natalPoints, computeYear, priceNow, YEAR, TOOL } from "../lib/imerologio.mjs";

const clip = (v, n) => String(v || "").trim().slice(0, n);
const nameCase = (v) => clip(v, 60).replace(/(^|\s)(\S)/g, (m, sp, c) => sp + c.toLocaleUpperCase("el"));

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });
  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }

  const p = { name: nameCase(b.name), dob: clip(b.dob, 10), tob: clip(b.tob, 5), pob: clip(b.pob, 60) };
  const email = normalizeEmail(b.email);
  if (!p.name) return json(400, { error: "Γράψε το όνομα." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dob)) return json(400, { error: "Γράψε την ημερομηνία γέννησης." });
  if (p.tob && !/^\d{2}:\d{2}$/.test(p.tob)) p.tob = "";
  if (!isValidEmail(email)) return json(400, { error: "Γράψε ένα σωστό email." });
  if (!isAdult(p.dob)) return json(403, { error: ADULTS_ONLY });

  let natal, months;
  try {
    natal = await natalPoints(p);
    months = computeYear(natal.pts, YEAR);
  } catch (e) {
    console.error("[imerologio]", e);
    return json(500, { error: "Κάτι πήγε στραβά στον υπολογισμό. Δοκίμασε ξανά σε λίγο." });
  }

  const id = crypto.randomUUID();
  await oracleStore().setJSON(id, {
    id, tool: TOOL, kind: "main", stage: "q1", inputs: { name1: p.name, dob1: p.dob, tob1: p.tob, pob1: p.pob },
    email, marketingConsent: b.consent === true,
    src: String(b.src || "").replace(/[^\w\/.-]/g, "").slice(0, 80),
    createdAt: new Date().toISOString(),
    data: { year: YEAR, hasTime: natal.hasTime, placeFound: natal.placeFound, months }
  });

  return json(200, {
    reading_id: id, name: p.name, year: YEAR, hasTime: natal.hasTime, placeFound: !!natal.placeFound || !p.pob,
    months: months.slice(0, 1), price: priceNow()
  });
};

export const config = {
  path: "/api/imerologio-teaser",
  method: "POST",
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] }
};
