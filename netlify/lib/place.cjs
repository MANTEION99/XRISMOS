// Τόπος γέννησης: από το κείμενο που γράφει η πελάτισσα («Θεσσαλονίκη», «Χανιά Κρήτης», «Λονδίνο»)
// βρίσκουμε πραγματικές συντεταγμένες και ζώνη ώρας.
// 1. Πρώτα στη δική μας λίστα (data/places.json, από το GeoNames): όλες οι πόλεις και κωμοπόλεις
//    της Ελλάδας και της Κύπρου με τα ελληνικά τους ονόματα, και οι πόλεις του εξωτερικού.
//    Δεν χρειάζεται καμία εξωτερική υπηρεσία.
// 2. Αν δεν βρεθεί εκεί, μέσω του geo_details του AstrologyAPI (αν υπάρχει ενεργό κλειδί).
// Αν δεν βρεθεί πουθενά, επιστρέφουμε null και ο χάρτης υπολογίζεται με Αθήνα.
// Ο χρησμός δεν σταματά ποτέ εξαιτίας του τόπου.

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

/* ---------- Η δική μας λίστα πόλεων ---------- */

let INDEX = null, DATA = null;
const fold = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ς/g, "σ").replace(/\s+/g, " ").trim();
function loadIndex() {
  if (INDEX) return INDEX;
  DATA = require("./data/places.json");
  INDEX = new Map();
  DATA.rows.forEach((r, i) => {
    for (const n of String(r[6]).split("|")) {
      if (!n) continue;
      const list = INDEX.get(n);
      if (list) list.push(i); else INDEX.set(n, [i]);
    }
  });
  return INDEX;
}

// Χώρες που γράφει ο κόσμος μαζί με την πόλη («Μελβούρνη Αυστραλίας», «Stuttgart Germany»).
const COUNTRY = {
  "ελλαδα": "GR", "ελλαδοσ": "GR", "κυπροσ": "CY", "κυπρου": "CY", "γερμανια": "DE", "γερμανιασ": "DE", "αυστραλια": "AU", "αυστραλιασ": "AU",
  "αμερικη": "US", "αμερικησ": "US", "ηπα": "US", "καναδασ": "CA", "καναδα": "CA", "αγγλια": "GB", "αγγλιασ": "GB", "βελγιο": "BE", "βελγιου": "BE",
  "σουηδια": "SE", "σουηδιασ": "SE", "ελβετια": "CH", "ελβετιασ": "CH", "γαλλια": "FR", "γαλλιασ": "FR", "ιταλια": "IT", "ιταλιασ": "IT",
  "αλβανια": "AL", "αλβανιασ": "AL", "τουρκια": "TR", "τουρκιασ": "TR", "αιγυπτοσ": "EG", "αιγυπτου": "EG", "ρωσια": "RU", "ρωσιασ": "RU",
  "γεωργια": "GE", "γεωργιασ": "GE", "ουκρανια": "UA", "ουκρανιασ": "UA", "ολλανδια": "NL", "ολλανδιασ": "NL", "αυστρια": "AT", "αυστριασ": "AT",
  "βουλγαρια": "BG", "βουλγαριασ": "BG", "ρουμανια": "RO", "ρουμανιασ": "RO", "νοτια αφρικη": "ZA",
  "greece": "GR", "cyprus": "CY", "germany": "DE", "deutschland": "DE", "australia": "AU", "usa": "US", "america": "US", "canada": "CA",
  "england": "GB", "uk": "GB", "belgium": "BE", "sweden": "SE", "switzerland": "CH", "france": "FR", "italy": "IT", "albania": "AL", "turkey": "TR"
};

function countryHint(text) {
  const f = fold(text);
  for (const [k, v] of Object.entries(COUNTRY)) {
    if (new RegExp(`(^|[\\s,/])${k}($|[\\s,/])`).test(f)) return v;
  }
  return null;
}

// Νησιά που ο κόσμος γράφει με το όνομα του νησιού: αντιστοιχίζονται στην πρωτεύουσά τους.
const ISLANDS = {
  "συροσ": "Ερμούπολη", "σαντορινη": "Θήρα", "λεσβοσ": "Μυτιλήνη", "λημνοσ": "Μύρινα", "κεφαλονια": "Αργοστόλι", "κεφαλληνια": "Αργοστόλι",
  "ιθακη": "Ιθάκη", "καλυμνοσ": "Κάλυμνος", "παροσ": "Παροικιά", "ανδροσ": "Άνδρος", "τηνοσ": "Τήνος", "κυθηρα": "Κύθηρα",
  "αιγινα": "Αίγινα", "υδρα": "Ύδρα", "σκιαθοσ": "Σκιάθος", "σκοπελοσ": "Σκόπελος", "θασοσ": "Θάσος", "σαμοθρακη": "Σαμοθράκη",
  "ικαρια": "Άγιος Κήρυκος", "καρπαθοσ": "Κάρπαθος", "κρητη": "Ηράκλειο", "ευβοια": "Χαλκίδα", "λευκαδα": "Λευκάδα", "κωσ": "Κως",
  "μηλοσ": "Μήλος", "κεα": "Ιουλίδα", "αμοργοσ": "Αμοργός", "πατμοσ": "Πάτμος", "συμη": "Σύμη",
 "σαλαμινα": "Σαλαμίνα", "σπετσεσ": "Σπέτσες", "ποροσ": "Πόρος", "σκυροσ": "Σκύρος",
  "παξοι": "Γάιος", "αστυπαλαια": "Αστυπάλαια", "φολεγανδροσ": "Φολέγανδρος",
  "σεριφοσ": "Σέριφος", "κυθνοσ": "Κύθνος"
};

// Μικρά νησιά που λείπουν από τη λίστα (κάτω από 1.000 κατοίκους στην πρωτεύουσα): συντεταγμένες της πρωτεύουσάς τους.
const SMALL_ISLANDS = {
  "σιφνοσ": ["Apollonia, Sifnos", 36.973, 24.722], "λεροσ": ["Platanos, Leros", 37.149, 26.851], "κασοσ": ["Fry, Kasos", 35.416, 26.925],
  "αλοννησοσ": ["Patitiri, Alonnisos", 39.142, 23.865], "τηλοσ": ["Livadia, Tilos", 36.418, 27.383], "νισυροσ": ["Mandraki, Nisyros", 36.611, 27.134],
  "χαλκη δωδεκανησου": ["Emporeio, Chalki", 36.223, 27.613]
};

function offlineLookup(text, tries) {
  for (const t of tries) {
    const sm = SMALL_ISLANDS[fold(t)];
    if (sm) return { name: sm[0], country: "GR", lat: sm[1], lon: sm[2], tzName: "Europe/Athens", source: "local" };
  }
  const idx = loadIndex();
  const hint = countryHint(text);
  const seen = new Set();
  const withIslands = [];
  for (const t of tries) { withIslands.push(t); const isl = ISLANDS[fold(t)]; if (isl) withIslands.push(isl); }
  for (const t of withIslands) {
    const key = fold(t);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    let ids = idx.get(key);
    if (!ids) continue;
    let rows = ids.map(i => DATA.rows[i]);
    if (hint) { const h = rows.filter(r => r[1] === hint); if (h.length) rows = h; }
    // Χωρίς χώρα: προτιμάμε Ελλάδα και Κύπρο, μετά τη μεγαλύτερη πόλη.
    rows.sort((a, b) => ((b[1] === "GR" || b[1] === "CY") - (a[1] === "GR" || a[1] === "CY")) || (b[5] - a[5]));
    const r = rows[0];
    return { name: r[0], country: r[1], lat: r[2], lon: r[3], tzName: DATA.tz[r[4]], source: "local" };
  }
  return null;
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

function toPlace(g) {
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

// Κατάταξη: πρώτα το ακριβές όνομα (London και όχι Londonderry), μετά όνομα που ξεκινά με αυτό
// σαν ξεχωριστή λέξη (Stuttgart Feuerbach), και ανάμεσα σε ισοβαθμίες προτιμάμε την Ελλάδα.
function score(g, query) {
  const a = ascii(g.place_name), q = ascii(query);
  let s = 0;
  if (a === q) s += 100;
  else if (a.startsWith(q + " ") || q.startsWith(a + " ")) s += 50;
  else if (a.startsWith(q)) s += 20;
  if (String(g.country_code || "").toUpperCase() === "GR") s += 30;
  return s;
}

async function lookup(query) {
  const list = (await geo(query)).filter(g => looksLike(g, query));
  if (!list.length) return null;
  list.sort((x, y) => score(y, query) - score(x, query));
  return toPlace(list[0]);
}

// Η ξένη βάση γράφει τα ελληνικά ονόματα με διάφορους τρόπους (Anogeia ή Anogia, Kifisia ή Kifissia).
// Αν δεν βρεθεί με την πρώτη μεταγραφή, δοκιμάζουμε και την απλή φωνητική.
function simpler(latin) {
  return latin
    .replace(/eia\b/g, "ia").replace(/ei/g, "i").replace(/oi/g, "i")
    .replace(/ai/g, "e").replace(/y/g, "i").replace(/ou/g, "u")
    .replace(/([bcdfgklmnprstvxz])\1/g, "$1");
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
  for (const t of [...tries]) { const v = simpler(t); if (v !== t) tries.push(v); }
  const uniq = [...new Set(tries.map(t => t.trim()))].filter(t => t.length >= 2 && /^[a-z .'-]+$/i.test(t));

  // Πρώτα η δική μας λίστα, με τα ελληνικά ονόματα όπως τα γράφει η πελάτισσα και μετά με λατινικά.
  const regionless = first.replace(/\s+(νομού|νομου|κρήτης|κρητης|κέρκυρας|ρόδου|ροδου|αττικής|αττικης|μακεδονίας|θράκης|ηπείρου|πελοποννήσου|αιτωλοακαρνανίας)$/i, "");
  const localTries = [text, first, regionless, ...parts.slice(1), (words.length > 1 && !PREFIX.has(words[0].toLowerCase())) ? words[0] : "", ...uniq];
  let found = offlineLookup(text, localTries.filter(Boolean));
  if (found) {
    if (cache.size > 500) cache.clear();
    cache.set(key, found);
    return found;
  }
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
