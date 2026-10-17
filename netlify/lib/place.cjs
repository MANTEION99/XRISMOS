// Τόπος γέννησης: από το κείμενο που γράφει η πελάτισσα («Θεσσαλονίκη», «Χανιά Κρήτης», «Λονδίνο»)
// βρίσκουμε πραγματικές συντεταγμένες και ζώνη ώρας μέσω του geo_details του AstrologyAPI.
// Αν κάτι δεν πάει καλά (δεν βρέθηκε, αργεί, σφάλμα), επιστρέφουμε null και ο χάρτης
// υπολογίζεται με Αθήνα, όπως πριν. Ο χρησμός δεν σταματά ποτέ εξαιτίας του τόπου.

const cache = new Map();

const GR = {
  "α": "a", "ά": "a", "β": "v", "γ": "g", "δ": "d", "ε": "e", "έ": "e", "ζ": "z", "η": "i", "ή": "i",
  "θ": "th", "ι": "i", "ί": "i", "ϊ": "i", "ΐ": "i", "κ": "k", "λ": "l", "μ": "m", "ν": "n", "ξ": "x",
  "ο": "o", "ό": "o", "π": "p", "ρ": "r", "σ": "s", "ς": "s", "τ": "t", "υ": "y", "ύ": "y", "ϋ": "y",
  "ΰ": "y", "φ": "f", "χ": "ch", "ψ": "ps", "ω": "o", "ώ": "o"
};

function translit(text) {
  return String(text).toLowerCase()
    .replace(/ου/g, "ou").replace(/ού/g, "ou")
    .replace(/μπ/g, "b").replace(/ντ/g, "d").replace(/γκ/g, "g")
    .split("").map(c => GR[c] !== undefined ? GR[c] : c).join("");
}

const DROP = new Set(["ελλάδα", "ελλαδα", "ελλάς", "greece", "νομός", "νομος", "ν.", "δήμος", "δημος"]);
const clean = (text) => String(text || "")
  .replace(/[«»"'()]/g, " ")
  .split(/(\s+|,)/)
  .filter(w => !DROP.has(w.trim().toLowerCase()))
  .join("")
  .replace(/\s*,\s*(,\s*)*/g, ", ")
  .replace(/\s+/g, " ")
  .replace(/^[,\s]+|[,\s]+$/g, "")
  .trim();

async function geo(place) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch("https://json.astrologyapi.com/v1/geo_details", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": "en",
        "x-astrologyapi-key": process.env.ASTROLOGY_API_KEY
      },
      body: JSON.stringify({ place, maxRows: 8 }),
      signal: ctrl.signal
    });
    const data = await res.json().catch(() => null);
    const list = data && Array.isArray(data.geonames) ? data.geonames : [];
    return list.filter(g => g && isFinite(parseFloat(g.latitude)) && isFinite(parseFloat(g.longitude)));
  } catch (e) {
    console.error("[geo] " + (e && e.message));
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Το κοινό είναι κυρίως ελληνικό: αν υπάρχει αποτέλεσμα στην Ελλάδα, το προτιμάμε.
function pick(list) {
  if (!list.length) return null;
  const g = list.find(x => String(x.country_code || "").toUpperCase() === "GR") || list[0];
  return {
    name: g.place_name || "",
    country: String(g.country_code || "").toUpperCase(),
    lat: parseFloat(g.latitude),
    lon: parseFloat(g.longitude),
    tzName: g.timezone_id || "Europe/Athens"
  };
}

async function resolvePlace(pob) {
  const text = clean(pob);
  if (!text || text.length < 2) return null;
  const key = text.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  // Δοκιμές με τη σειρά: όπως το έγραψε, μόνο το πρώτο κομμάτι («Χανιά, Κρήτη» -> «Χανιά»),
  // και τα ίδια με λατινικούς χαρακτήρες.
  const first = text.split(/[,/]/)[0].trim();
  const tries = [...new Set([text, first, translit(text), translit(first)])].filter(t => t.length >= 2);

  let found = null;
  for (const t of tries) {
    found = pick(await geo(t));
    if (found) break;
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, found);
  if (!found) console.error("[geo] δεν βρέθηκε: " + text);
  return found;
}

module.exports = { resolvePlace, translit };
