// Δωρεάν υπολογισμός Ωροσκόπου (ανιόντος) για όλους. Χωρίς τεχνητή νοημοσύνη και χωρίς εξωτερική
// υπηρεσία χάρτη: ο ουρανός υπολογίζεται τοπικά (astronomy-engine), ο τόπος από τη δική μας λίστα πόλεων.
// Είσοδος: { dob: "YYYY-MM-DD", tob: "HH:MM", pob }
// Έξοδος: { place, asc: { sign, deg, min }, sun, moon, mc, near }  (near: το διπλανό ζώδιο αν η ώρα είναι οριακή)

import Astronomy from "../lib/vendor/astronomy.cjs";
import makeSky from "../lib/sky.cjs";
import placeLib from "../lib/place.cjs";
import localChartLib from "../lib/local-chart.cjs";
import { SIGN_GR } from "../lib/natal.mjs";
const { zoneOffset } = makeSky(Astronomy);
const { localChart } = localChartLib;

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const signOf = (deg) => SIGNS[Math.floor((((deg % 360) + 360) % 360) / 30)];
const COUNTRY_GR = { GR: "Ελλάδα", CY: "Κύπρος" };

function json(status, data) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function chartAt(y, mo, d, h, mi, place) {
  // Μετακίνηση της ώρας κατά λεπτά, με σωστή αλλαγή μέρας.
  const t = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const Y = t.getUTCFullYear(), M = t.getUTCMonth() + 1, D = t.getUTCDate(), H = t.getUTCHours(), Mi = t.getUTCMinutes();
  return localChart({ year: Y, month: M, day: D, hour: H, min: Mi, lat: place.lat, lon: place.lon, tzone: zoneOffset(place.tzName, Y, M, D, H, Mi) });
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });
  let b;
  try { b = await req.json(); } catch { return json(400, { error: "Λάθος αίτημα." }); }
  const dob = String(b.dob || "").trim();
  const tob = String(b.tob || "").trim();
  const pob = String(b.pob || "").trim().slice(0, 80);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return json(400, { error: "Γράψε την ημερομηνία γέννησης." });
  if (!/^\d{2}:\d{2}$/.test(tob)) return json(400, { error: "Ο Ωροσκόπος χρειάζεται την ώρα γέννησης." });
  if (pob.length < 2) return json(400, { error: "Γράψε τον τόπο γέννησης." });
  const [y, mo, d] = dob.split("-").map(Number);
  const [h, mi] = tob.split(":").map(Number);
  if (y < 1900 || y > 2100 || h > 23 || mi > 59) return json(400, { error: "Έλεγξε την ημερομηνία και την ώρα." });

  const place = await placeLib.resolvePlace(pob).catch(() => null);
  if (!place) return json(404, { error: "Δεν βρήκαμε αυτόν τον τόπο. Γράψε την πόλη ή το χωριό πιο απλά, π.χ. «Λάρισα» ή «Χανιά»." });

  try {
    const c = chartAt(y, mo, d, h, mi, place);
    const asc = +c.ascendant;
    const find = (n) => c.planets.find(p => p.name === n);
    const sun = find("Sun"), moon = find("Moon");
    // Αν η ώρα απέχει λίγα λεπτά, αλλάζει ο Ωροσκόπος; Ελέγχουμε 15 λεπτά πριν και μετά.
    const before = signOf(+chartAt(y, mo, d, h, mi - 15, place).ascendant);
    const after = signOf(+chartAt(y, mo, d, h, mi + 15, place).ascendant);
    const now = signOf(asc);
    const near = before !== now ? SIGN_GR[before] : after !== now ? SIGN_GR[after] : null;
    const inSign = ((asc % 30) + 30) % 30;
    return json(200, {
      place: `${pob} (${place.name}${COUNTRY_GR[place.country] ? ", " + COUNTRY_GR[place.country] : place.country ? ", " + place.country : ""})`,
      asc: { sign: SIGN_GR[now], key: now, deg: Math.floor(inSign), min: Math.floor((inSign % 1) * 60) },
      sun: SIGN_GR[sun.sign],
      moon: SIGN_GR[moon.sign],
      mc: SIGN_GR[signOf(+c.midheaven)],
      near
    });
  } catch (e) {
    console.error("[oroskopos]", e);
    return json(500, { error: "Κάτι πήγε στραβά στον υπολογισμό. Δοκίμασε ξανά." });
  }
};

export const config = {
  path: "/api/oroskopos",
  method: "POST",
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] }
};
