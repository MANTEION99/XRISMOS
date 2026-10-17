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

// Πόλεις που στα ελληνικά λέγονται αλλιώς από ό,τι στα αγγλικά.
const EXONYMS = {
  "αθήνα": "Athens", "αθηνα": "Athens", "πειραιάς": "Piraeus", "πειραιας": "Piraeus",
  "ηράκλειο": "Heraklion", "ηρακλειο": "Heraklion", "κέρκυρα": "Corfu", "κερκυρα": "Corfu",
  "ζάκυνθος": "Zakynthos", "λευκωσία": "Nicosia", "λευκωσια": "Nicosia", "λεμεσός": "Limassol", "λεμεσος": "Limassol",
  "λάρνακα": "Larnaca", "λαρνακα": "Larnaca", "πάφος": "Paphos", "παφος": "Paphos", "αμμόχωστος": "Famagusta",
  "κωνσταντινούπολη": "Istanbul", "κωνσταντινουπολη": "Istanbul", "πόλη": "Istanbul", "σμύρνη": "Izmir", "σμυρνη": "Izmir",
  "λονδίνο": "London", "λονδινο": "London", "παρίσι": "Paris", "παρισι": "Paris", "βρυξέλλες": "Brussels",
  "βερολίνο": "Berlin", "βερολινο": "Berlin", "μόναχο": "Munich", "μοναχο": "Munich", "φρανκφούρτη": "Frankfurt",
  "στουτγκάρδη": "Stuttgart", "στουτγκαρδη": "Stuttgart", "κολωνία": "Cologne", "κολωνια": "Cologne",
  "αμβούργο": "Hamburg", "αμβουργο": "Hamburg", "ντίσελντορφ": "Dusseldorf", "ντισελντορφ": "Dusseldorf",
  "νυρεμβέργη": "Nuremberg", "ανόβερο": "Hanover", "βιέννη": "Vienna", "βιεννη": "Vienna", "ζυρίχη": "Zurich",
  "γενεύη": "Geneva", "ρώμη": "Rome", "ρωμη": "Rome", "μιλάνο": "Milan", "μιλανο": "Milan", "νάπολη": "Naples",
  "μαδρίτη": "Madrid", "λισαβόνα": "Lisbon", "άμστερνταμ": "Amsterdam", "στοκχόλμη": "Stockholm",
  "κοπεγχάγη": "Copenhagen", "όσλο": "Oslo", "μόσχα": "Moscow", "μοσχα": "Moscow", "οδησσός": "Odesa",
  "κίεβο": "Kyiv", "τιφλίδα": "Tbilisi", "σόφια": "Sofia", "σοφια": "Sofia", "βουκουρέστι": "Bucharest",
  "βελιγράδι": "Belgrade", "τίρανα": "Tirana", "κορυτσά": "Korce", "αργυρόκαστρο": "Gjirokaster",
  "σκόπια": "Skopje", "κάιρο": "Cairo", "καιρο": "Cairo", "νέα υόρκη": "New York", "νεα υορκη": "New York",
  "σικάγο": "Chicago", "σικαγο": "Chicago", "βοστώνη": "Boston", "λος άντζελες": "Los Angeles",
  "σαν φρανσίσκο": "San Francisco", "ουάσιγκτον": "Washington", "τορόντο": "Toronto", "τοροντο": "Toronto",
  "μόντρεαλ": "Montreal", "μοντρεαλ": "Montreal", "μελβούρνη": "Melbourne", "μελβουρνη": "Melbourne",
  "σίδνεϊ": "Sydney", "σιδνεϊ": "Sydney", "σιδνει": "Sydney", "αδελαΐδα": "Adelaide", "αδελαιδα": "Adelaide",
  "μπρίσμπεϊν": "Brisbane", "πέρθ": "Perth", "γιοχάνεσμπουργκ": "Johannesburg", "τασκένδη": "Tashkent"
};

function translit(text) {
  return String(text).toLowerCase()
    .replace(/ου|ού/g, "ou")
    .replace(/αυ|αύ/g, "av").replace(/ευ|εύ/g, "ev")
    .replace(/γγ/g, "ng").replace(/γχ/g, "nch")
    .replace(/^μπ|(\s)μπ/g, "$1b").replace(/^ντ|(\s)ντ/g, "$1d").replace(/^γκ|(\s)γκ/g, "$1g")
    .replace(/μπ/g, "mp").replace(/ντ/g, "nt").replace(/γκ/g, "gk")
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

const ascii = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, "").trim();

// Το AstrologyAPI δεν καταλαβαίνει ελληνικούς χαρακτήρες και γυρίζει τυχαία μέρη.
// Γι' αυτό στέλνουμε ΜΟΝΟ λατινικά, και κρατάμε αποτέλεσμα μόνο αν το όνομά του μοιάζει με αυτό που ζητήσαμε.
function looksLike(result, query) {
  const a = ascii(result.place_name), q = ascii(query);
  if (!a || !q) return false;
  const a1 = a.split(" ")[0], q1 = q.split(" ")[0];
  return a.includes(q1) || q.includes(a1) || a1.slice(0, 4) === q1.slice(0, 4);
}

async function lookup(query) {
  const list = (await geo(query)).filter(g => looksLike(g, query));
  return pick(list);
}

async function resolvePlace(pob) {
  const text = clean(pob);
  if (!text || text.length < 2) return null;
  const key = text.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  // Δοκιμές με τη σειρά: γνωστά ονόματα πόλεων στα αγγλικά, μετά λατινικοί χαρακτήρες
  // για όλο το κείμενο και για το πρώτο κομμάτι («Χανιά Κρήτης» -> «chania»).
  const parts = text.split(/[,/]/).map(x => x.trim()).filter(Boolean);
  const first = parts[0];
  const words = first.split(" ");
  const tries = [];
  const exo = EXONYMS[text.toLowerCase()] || EXONYMS[first.toLowerCase()];
  if (exo) tries.push(exo);
  tries.push(translit(first));
  // Μόνο η πρώτη λέξη («Χανιά Κρήτης» -> «Χανιά»), εκτός αν είναι λέξη σαν «Νέα» ή «Άγιος»,
  // που μόνη της θα έβρισκε λάθος μέρος.
  const PREFIX = new Set(["νέα", "νεα", "νέο", "νεο", "νέος", "νεος", "άγιος", "αγιος", "αγία", "αγια", "άγιοι", "άνω", "ανω", "κάτω", "κατω", "παλαιά", "παλαια", "μεγάλη", "μικρή", "πάνω", "new", "san", "los", "st", "saint"]);
  if (words.length > 1 && words[0].length >= 4 && !PREFIX.has(words[0].toLowerCase())) tries.push(translit(words[0]));
  tries.push(translit(text));
  const uniq = [...new Set(tries.map(t => t.trim()))].filter(t => t.length >= 2 && /^[a-z .'-]+$/i.test(t));

  let found = null;
  for (const t of uniq) {
    found = await lookup(t);
    if (found) break;
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, found);
  if (!found) console.error("[geo] δεν βρέθηκε: " + text + " | δοκιμές: " + uniq.join(", "));
  return found;
}

module.exports = { resolvePlace, translit };
