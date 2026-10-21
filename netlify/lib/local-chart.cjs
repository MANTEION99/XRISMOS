// Εφεδρικός υπολογισμός γενέθλιου χάρτη, χωρίς εξωτερική υπηρεσία (astronomy-engine).
// Χρησιμοποιείται ΜΟΝΟ όταν το AstrologyAPI δεν απαντά (π.χ. όριο κλήσεων), ώστε η πελάτισσα
// να παίρνει πάντα χρησμό. Επιστρέφει δεδομένα στην ίδια μορφή με το AstrologyAPI (western_horoscope).
// Τροπικός ζωδιακός. Οίκοι κατά Porphyry (κοντά στον Placidus για γεωγραφικά πλάτη της Ελλάδας).

const Astronomy = require("./vendor/astronomy.cjs");

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
const ASPECTS = [["Conjunction", 0, 8], ["Opposition", 180, 8], ["Trine", 120, 8], ["Square", 90, 7], ["Sextile", 60, 5]];
const RAD = Math.PI / 180;

const norm = (x) => ((x % 360) + 360) % 360;
const signOf = (lon) => SIGNS[Math.floor(norm(lon) / 30)];

function elon(body, date) {
  return norm(Astronomy.Ecliptic(Astronomy.GeoVector(body, date, true)).elon);
}

// Μέσος βόρειος δεσμός της Σελήνης (Meeus).
function meanNode(date) {
  const T = Astronomy.MakeTime(date).tt / 36525;
  return norm(125.04452 - 1934.136261 * T + 0.0020708 * T * T);
}

function houseOf(lon, cusps) {
  for (let i = 0; i < 12; i++) {
    const a = cusps[i], b = cusps[(i + 1) % 12];
    const span = norm(b - a), d = norm(lon - a);
    if (d < span) return i + 1;
  }
  return 1;
}

function localChart(body) {
  const { year, month, day, hour, min, lat, lon, tzone } = body;
  const date = new Date(Date.UTC(year, month - 1, day, hour, min) - tzone * 3600000);
  const time = Astronomy.MakeTime(date);
  const T = time.tt / 36525;
  const eps = (23.4392911 - 0.0130042 * T) * RAD;

  // Ωροσκόπος και Μεσουράνημα από τον τοπικό αστρικό χρόνο.
  const ramc = norm(Astronomy.SiderealTime(date) * 15 + lon) * RAD;
  const phi = Math.max(-66, Math.min(66, lat)) * RAD;
  const mc = norm(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) / RAD);
  const asc = norm(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) / RAD);

  // Porphyry: κάθε τεταρτημόριο χωρίζεται σε τρία ίσα μέρη.
  const ic = norm(mc + 180), dsc = norm(asc + 180);
  const q = (a, b) => norm(b - a) / 3;
  const c = [];
  c[0] = asc; c[1] = norm(asc + q(asc, ic)); c[2] = norm(asc + 2 * q(asc, ic));
  c[3] = ic; c[4] = norm(ic + q(ic, dsc)); c[5] = norm(ic + 2 * q(ic, dsc));
  c[6] = dsc; c[7] = norm(dsc + q(dsc, mc)); c[8] = norm(dsc + 2 * q(dsc, mc));
  c[9] = mc; c[10] = norm(mc + q(mc, asc)); c[11] = norm(mc + 2 * q(mc, asc));

  const before = new Date(date.getTime() - 12 * 3600000), after = new Date(date.getTime() + 12 * 3600000);
  const planets = BODIES.map((name) => {
    const L = elon(name, date);
    let speed = norm(elon(name, after) - elon(name, before) + 180) - 180; // μοίρες ανά ημέρα
    return {
      name, full_degree: +L.toFixed(4), norm_degree: +(L % 30).toFixed(4), speed: +speed.toFixed(4),
      is_retro: String(speed < 0 && name !== "Sun" && name !== "Moon"), sign_id: Math.floor(L / 30) + 1,
      sign: signOf(L), house: houseOf(L, c)
    };
  });
  const node = meanNode(date);
  planets.push({ name: "Node", full_degree: +node.toFixed(4), norm_degree: +(node % 30).toFixed(4), speed: -0.053, is_retro: "true", sign_id: Math.floor(node / 30) + 1, sign: signOf(node), house: houseOf(node, c) });
  planets.push({ name: "Ascendant", full_degree: +asc.toFixed(4), norm_degree: +(asc % 30).toFixed(4), speed: 0, is_retro: "false", sign_id: Math.floor(asc / 30) + 1, sign: signOf(asc), house: 1 });

  const aspects = [];
  const pts = planets.filter(p => p.name !== "Ascendant" && p.name !== "Node");
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const diff = Math.abs(norm(pts[i].full_degree - pts[j].full_degree + 180) - 180);
      for (const [type, angle, orb] of ASPECTS) {
        if (Math.abs(diff - angle) <= orb) {
          aspects.push({ aspecting_planet: pts[i].name, aspected_planet: pts[j].name, type, orb: +Math.abs(diff - angle).toFixed(2), diff: +diff.toFixed(2) });
          break;
        }
      }
    }
  }

  return {
    planets,
    houses: c.map((deg, i) => ({ house: i + 1, sign: signOf(deg), degree: +deg.toFixed(4) })),
    ascendant: +asc.toFixed(4),
    midheaven: +mc.toFixed(4),
    aspects,
    source: "local"
  };
}

// Κλήση στο AstrologyAPI με εφεδρεία: αν δεν δώσει σωστό χάρτη (όριο, κλειδί, δίκτυο),
// ο χάρτης υπολογίζεται τοπικά. Για τις παλιές (CommonJS) λειτουργίες.
async function chartWithFallback(body) {
  let status = "-", text = "";
  try {
    const res = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": "en", "x-astrologyapi-key": process.env.ASTROLOGY_API_KEY },
      body: JSON.stringify(body)
    });
    status = res.status;
    text = await res.text();
    const data = JSON.parse(text);
    if (res.ok && data && Array.isArray(data.planets) && data.planets.length) return data;
  } catch (e) {
    if (!text) text = "network: " + (e && e.message);
  }
  console.error(`[astrologyapi] status=${status} body=${String(text).slice(0, 300)}`);
  console.warn("[astrologyapi] fallback: τοπικός υπολογισμός χάρτη");
  return localChart(body);
}

module.exports = { localChart, chartWithFallback };
