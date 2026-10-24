// «Ο Γενέθλιος Χάρτης σου»: τα επιπλέον σημεία και οι υπολογισμοί πάνω στον χάρτη, και τα κεφάλαια
// της πλήρους ανάλυσης. Ο ίδιος ο χάρτης έρχεται από το computeCharts (AstrologyAPI ή τοπικός υπολογισμός).

import Astronomy from "./vendor/astronomy.cjs";
import localChartLib from "./local-chart.cjs";
const { localChart } = localChartLib;

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
export const SIGN_GR = {
  Aries: "Κριός", Taurus: "Ταύρος", Gemini: "Δίδυμοι", Cancer: "Καρκίνος", Leo: "Λέων", Virgo: "Παρθένος",
  Libra: "Ζυγός", Scorpio: "Σκορπιός", Sagittarius: "Τοξότης", Capricorn: "Αιγόκερως", Aquarius: "Υδροχόος", Pisces: "Ιχθύες"
};
const PLANET_GR = {
  Sun: "Ήλιος", Moon: "Σελήνη", Mercury: "Ερμής", Venus: "Αφροδίτη", Mars: "Άρης", Jupiter: "Δίας",
  Saturn: "Κρόνος", Uranus: "Ουρανός", Neptune: "Ποσειδώνας", Pluto: "Πλούτωνας", Node: "Βόρειος Δεσμός", Chiron: "Χείρωνας"
};
const ELEMENT = { Aries: "Φωτιά", Leo: "Φωτιά", Sagittarius: "Φωτιά", Taurus: "Γη", Virgo: "Γη", Capricorn: "Γη",
  Gemini: "Αέρας", Libra: "Αέρας", Aquarius: "Αέρας", Cancer: "Νερό", Scorpio: "Νερό", Pisces: "Νερό" };
const MODE = { Aries: "Καρδινάλιο (ξεκινά)", Cancer: "Καρδινάλιο (ξεκινά)", Libra: "Καρδινάλιο (ξεκινά)", Capricorn: "Καρδινάλιο (ξεκινά)",
  Taurus: "Σταθερό (κρατά)", Leo: "Σταθερό (κρατά)", Scorpio: "Σταθερό (κρατά)", Aquarius: "Σταθερό (κρατά)",
  Gemini: "Μεταβλητό (προσαρμόζεται)", Virgo: "Μεταβλητό (προσαρμόζεται)", Sagittarius: "Μεταβλητό (προσαρμόζεται)", Pisces: "Μεταβλητό (προσαρμόζεται)" };
// Παραδοσιακοί κυβερνήτες: κρατούν τον κυβερνήτη του χάρτη προσωπικό (όχι πλανήτη γενιάς).
const RULER = { Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon", Leo: "Sun", Virgo: "Mercury",
  Libra: "Venus", Scorpio: "Mars", Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter" };
const PERSONAL = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const TEN = [...PERSONAL, "Uranus", "Neptune", "Pluto"];

const norm = (x) => ((x % 360) + 360) % 360;
const signOf = (lon) => SIGNS[Math.floor(norm(lon) / 30)];
const deg = (lon) => `${Math.floor(norm(lon) % 30)}° ${SIGN_GR[signOf(lon)]}`;
const find = (chart, name) => (chart.planets || []).find(p => p.name === name);

function houseOf(lon, chart) {
  const cusps = (chart.houses || []).map(h => +h.degree);
  if (cusps.length !== 12 || cusps.some(c => !Number.isFinite(c))) return null;
  for (let i = 0; i < 12; i++) {
    const a = cusps[i], b = cusps[(i + 1) % 12];
    if (norm(lon - a) < norm(b - a)) return i + 1;
  }
  return 1;
}

// Μέση Μαύρη Σελήνη (Λίλιθ): το απόγειο της σεληνιακής τροχιάς (Meeus, μέσο περίγειο + 180°).
function meanLilith(date) {
  const T = Astronomy.MakeTime(date).tt / 36525;
  const perigee = 83.3532465 + 4069.0137287 * T - 0.0103200 * T * T - T * T * T / 80053 + T * T * T * T / 18999000;
  return norm(perigee + 180);
}

// Η στιγμή της γέννησης σε UTC, από τα στοιχεία του χάρτη (ίδια λογική με τον τοπικό υπολογισμό).
function birthUTC(p, tzone) {
  const [y, m, d] = String(p.dob1).split("-").map(Number);
  const [hh, mm] = /^\d{2}:\d{2}$/.test(p.tob1 || "") ? p.tob1.split(":").map(Number) : [12, 0];
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - tzone * 3600000);
}

// Τα επιπλέον στοιχεία της ανάλυσης, σε απλά ελληνικά, για να τα χρησιμοποιήσει το κείμενο.
export function natalExtras(p, charts, hasTime, tzone) {
  const c = charts.chart1;
  const out = {};
  const pl = Object.fromEntries(TEN.map(n => [n, find(c, n)]).filter(([, v]) => v));

  // Στοιχεία και τρόποι: οι 7 προσωπικοί πλανήτες, και ο Ωροσκόπος αν υπάρχει ώρα.
  const counted = PERSONAL.filter(n => pl[n]).map(n => pl[n].sign);
  if (hasTime && Number.isFinite(+c.ascendant)) counted.push(signOf(+c.ascendant));
  const tally = (map) => counted.reduce((a, s) => { a[map[s]] = (a[map[s]] || 0) + 1; return a; }, {});
  out.elements = tally(ELEMENT);
  out.modes = tally(MODE);

  // Ανάδρομοι κατά τη γέννηση (μόνο προσωπικοί, οι γενιάς δεν λένε κάτι προσωπικό).
  out.retro = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"].filter(n => pl[n] && String(pl[n].is_retro) === "true").map(n => PLANET_GR[n]);

  // Συγκεντρώσεις: 3 ή περισσότεροι πλανήτες στο ίδιο ζώδιο (και στον ίδιο οίκο αν υπάρχει ώρα).
  const bySign = {}, byHouse = {};
  TEN.filter(n => pl[n]).forEach(n => {
    (bySign[pl[n].sign] = bySign[pl[n].sign] || []).push(PLANET_GR[n]);
    if (hasTime && pl[n].house) (byHouse[pl[n].house] = byHouse[pl[n].house] || []).push(PLANET_GR[n]);
  });
  out.stelliums = [
    ...Object.entries(bySign).filter(([, v]) => v.length >= 3).map(([s, v]) => `${v.join(", ")} μαζί ${SIGN_GR[s] ? "στο ζώδιο " + SIGN_GR[s] : s}`),
    ...Object.entries(byHouse).filter(([, v]) => v.length >= 3).map(([h, v]) => `${v.join(", ")} μαζί στον ${h}ο οίκο`)
  ];

  // Δεσμοί της Σελήνης: ο Νότιος είναι ακριβώς απέναντι από τον Βόρειο.
  const node = find(c, "Node") || find(c, "True Node") || find(c, "Mean Node");
  if (node) {
    const n = +node.full_degree, s = norm(n + 180);
    out.northNode = deg(n) + (hasTime ? `, ${houseOf(n, c) || node.house}ος οίκος` : "");
    out.southNode = deg(s) + (hasTime && houseOf(s, c) ? `, ${houseOf(s, c)}ος οίκος` : "");
  }

  // Χείρωνας: μόνο αν τον δίνει η υπηρεσία του χάρτη (δεν τον υπολογίζουμε τοπικά με ακρίβεια).
  const chiron = find(c, "Chiron");
  if (chiron) out.chiron = deg(+chiron.full_degree) + (hasTime && chiron.house ? `, ${chiron.house}ος οίκος` : "");

  // Μαύρη Σελήνη (Λίλιθ).
  const lil = meanLilith(birthUTC(p, tzone));
  out.lilith = deg(lil) + (hasTime && houseOf(lil, c) ? `, ${houseOf(lil, c)}ος οίκος` : "");

  if (hasTime && Number.isFinite(+c.ascendant)) {
    const ascSign = signOf(+c.ascendant);
    const ruler = RULER[ascSign];
    const rp = pl[ruler];
    out.chartRuler = `${PLANET_GR[ruler]} (κυβερνά τον Ωροσκόπο σε ${SIGN_GR[ascSign]})` + (rp ? `, βρίσκεται σε ${SIGN_GR[rp.sign]}${rp.house ? ", " + rp.house + "ος οίκος" : ""}` : "");
    out.ascendant = deg(+c.ascendant);
    if (Number.isFinite(+c.midheaven)) {
      out.midheaven = deg(+c.midheaven);
      out.ic = deg(+c.midheaven + 180);
    }
    out.descendant = deg(+c.ascendant + 180);
    // Κλήρος της Τύχης: μέρα (Ήλιος πάνω από τον ορίζοντα, οίκοι 7 έως 12) ή νύχτα.
    if (pl.Sun && pl.Moon) {
      const day = pl.Sun.house >= 7;
      const f = day ? +c.ascendant + +pl.Moon.full_degree - +pl.Sun.full_degree : +c.ascendant + +pl.Sun.full_degree - +pl.Moon.full_degree;
      out.fortune = deg(f) + (houseOf(norm(f), c) ? `, ${houseOf(norm(f), c)}ος οίκος` : "") + (day ? " (γέννηση μέρας)" : " (γέννηση νύχτας)");
    }
    // Ποιος πλανήτης κυβερνά κάθε οίκο και πού βρίσκεται: οδηγός για τα κεφάλαια σχέσεων, δουλειάς, χρημάτων, σπιτιού.
    out.houseRulers = (c.houses || []).slice(0, 12).map((h, i) => {
      const s = signOf(+h.degree), r = RULER[s], rp = pl[r];
      return `${i + 1}ος οίκος σε ${SIGN_GR[s]}, κυβερνήτης ${PLANET_GR[r]}${rp && rp.house ? " στον " + rp.house + "ο οίκο" : ""}`;
    });
  }

  // Οι πιο στενές όψεις ανάμεσα σε προσωπικά σημεία: η «ραχοκοκαλιά» του χάρτη.
  const okNames = new Set([...PERSONAL, ...(hasTime ? ["Ascendant", "Midheaven"] : [])]);
  out.tightAspects = (c.aspects || [])
    .filter(a => okNames.has(a.aspecting_planet) && okNames.has(a.aspected_planet))
    .filter(a => Number.isFinite(+a.orb))
    .sort((a, b) => +a.orb - +b.orb)
    .slice(0, 8)
    .map(a => `${PLANET_GR[a.aspecting_planet] || a.aspecting_planet} ${a.type} ${PLANET_GR[a.aspected_planet] || a.aspected_planet} (απόκλιση ${(+a.orb).toFixed(1)}°)`);
  return out;
}

// Η ηλιακή επιστροφή: η στιγμή που ο Ήλιος ξαναγυρίζει στη μοίρα της γέννησης. Ο χάρτης εκείνης
// της στιγμής δείχνει τη χρονιά ως τα επόμενα γενέθλια. Δίνουμε την τρέχουσα και την επόμενη.
export function solarReturns(charts, now = new Date()) {
  const sun = find(charts.chart1, "Sun");
  if (!sun || !Number.isFinite(+charts.lat1)) return [];
  const target = norm(+sun.full_degree);
  const find1 = (from) => {
    const t = Astronomy.SearchSunLongitude(target, from, 370);
    return t && t.date;
  };
  const prev = find1(new Date(now.getTime() - 366 * 86400000));
  const list = [];
  let cur = prev;
  for (let i = 0; i < 3 && cur; i++) {
    list.push(cur);
    cur = find1(new Date(cur.getTime() + 5 * 86400000));
  }
  const past = list.filter(d => d <= now).pop();
  const next = list.find(d => d > now);
  return [past, next].filter(Boolean).map(d => {
    const ch = localChart({
      year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
      hour: d.getUTCHours(), min: d.getUTCMinutes(), lat: +charts.lat1, lon: +charts.lon1, tzone: 0
    });
    const pl = (n) => ch.planets.find(x => x.name === n);
    const label = d.toLocaleDateString("el-GR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Athens" });
    return {
      date: label, current: d <= now,
      ascendant: deg(ch.ascendant), midheaven: deg(ch.midheaven),
      planets: ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].map(n => `${PLANET_GR[n]} σε ${SIGN_GR[pl(n).sign]}, ${pl(n).house}ος οίκος της χρονιάς`),
      aspects: ch.aspects.filter(a => PERSONAL.includes(a.aspecting_planet) && PERSONAL.includes(a.aspected_planet)).sort((a, b) => a.orb - b.orb).slice(0, 6)
        .map(a => `${PLANET_GR[a.aspecting_planet]} ${a.type} ${PLANET_GR[a.aspected_planet]}`)
    };
  });
}

export function extrasBlock(x) {
  const lines = [];
  lines.push(`Ισορροπία στοιχείων (προσωπικοί πλανήτες${x.ascendant ? " και Ωροσκόπος" : ""}): ${Object.entries(x.elements).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  lines.push(`Ισορροπία τρόπων: ${Object.entries(x.modes).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  if (x.chartRuler) lines.push(`Κυβερνήτης του χάρτη: ${x.chartRuler}`);
  if (x.ascendant) lines.push(`Ωροσκόπος: ${x.ascendant} · Μεσουράνημα (καριέρα, φήμη): ${x.midheaven || "-"} · Ναδίρ (ρίζες, σπίτι): ${x.ic || "-"} · Δύση (σύντροφος): ${x.descendant}`);
  lines.push(`Ανάδρομοι πλανήτες κατά τη γέννηση: ${x.retro.length ? x.retro.join(", ") : "κανένας προσωπικός"}`);
  lines.push(`Συγκεντρώσεις πλανητών: ${x.stelliums.length ? x.stelliums.join(" · ") : "καμία"}`);
  if (x.northNode) lines.push(`Βόρειος Δεσμός (ο δρόμος της ψυχής): ${x.northNode} · Νότιος Δεσμός (ό,τι φέρνει από πριν): ${x.southNode}`);
  lines.push(`Χείρωνας (η πληγή που γίνεται θεραπεία): ${x.chiron || "δεν υπολογίστηκε, ΜΗΝ τον αναφέρεις"}`);
  lines.push(`Μαύρη Σελήνη, Λίλιθ (η κρυφή, καταπιεσμένη πλευρά): ${x.lilith}`);
  if (x.fortune) lines.push(`Κλήρος της Τύχης (πού βρίσκει χαρά και ευημερία): ${x.fortune}`);
  if (x.houseRulers) lines.push(`Κυβερνήτες των οίκων:\n${x.houseRulers.map(s => "• " + s).join("\n")}`);
  lines.push(`Οι πιο στενές όψεις ανάμεσα σε προσωπικά σημεία:\n${x.tightAspects.length ? x.tightAspects.map(s => "• " + s).join("\n") : "• καμία στενή"}`);
  return `ΕΠΙΠΛΕΟΝ ΣΤΟΙΧΕΙΑ ΤΟΥ ΧΑΡΤΗ (υπολογισμένα, πραγματικά):\n${lines.join("\n")}`;
}

export function solarBlock(list) {
  if (!list || !list.length) return "";
  return `ΗΛΙΑΚΗ ΕΠΙΣΤΡΟΦΗ (ο χάρτης της στιγμής που ο Ήλιος γυρίζει στη μοίρα της γέννησης, δείχνει τη χρονιά ως τα επόμενα γενέθλια):\n` +
    list.map(r => `${r.current ? "ΤΡΕΧΟΥΣΑ ΧΡΟΝΙΑ, από" : "ΕΠΟΜΕΝΗ ΧΡΟΝΙΑ, από"} ${r.date}: Ωροσκόπος της χρονιάς ${r.ascendant}, Μεσουράνημα ${r.midheaven}\n` +
      r.planets.map(s => "• " + s).join("\n") + `\nΌψεις της χρονιάς: ${r.aspects.join(", ") || "καμία στενή"}`).join("\n\n");
}

// Ο Ήλιος, η Σελήνη και ο Ωροσκόπος για την κάρτα της σελίδας (στα ελληνικά).
export function big3(charts, hasTime, moonUnsure) {
  const c = charts.chart1;
  const sun = find(c, "Sun"), moon = find(c, "Moon");
  const out = { sun: sun ? SIGN_GR[sun.sign] || "" : "" };
  if (moon && !moonUnsure) out.moon = SIGN_GR[moon.sign] || "";
  if (hasTime && Number.isFinite(+c.ascendant)) out.asc = SIGN_GR[signOf(+c.ascendant)];
  return out;
}

/* ---------- Τα κεφάλαια ---------- */

export const CHAPTERS = [
  { title: "Η ψυχή σου με μια ματιά", focus: (t) => `Η συνολική εικόνα: η ισορροπία των στοιχείων και των τρόπων (τι περισσεύει, τι λείπει και τι σημαίνει αυτό στην καθημερινότητα), οι συγκεντρώσεις πλανητών${t ? ", ο κυβερνήτης του χάρτη και πού βρίσκεται" : ""}, οι ανάδρομοι πλανήτες. Το μεγάλο θέμα της ζωής της σε μία καθαρή εικόνα. ΜΗΝ αναλύσεις ακόμα Ήλιο, Σελήνη ή Ωροσκόπο χωριστά, έχουν δικά τους κεφάλαια.` },
  { title: "Ο Ήλιος σου: ποιος είσαι στ' αλήθεια", focus: (t) => `ΜΟΝΟ ο Ήλιος: το ζώδιό του${t ? ", ο οίκος του (σε ποιον τομέα της ζωής θέλει να λάμψει)" : ""} και οι όψεις του με τους άλλους προσωπικούς πλανήτες. Η ταυτότητα, η ζωτικότητα, ο πατέρας ως εικόνα, τι την κάνει να νιώθει ζωντανή.` },
  { title: (t) => t ? "Ο Ωροσκόπος σου: πώς σε βλέπει ο κόσμος" : "Το πρόσωπο που δείχνεις στον κόσμο", focus: (t) => t ? `ΜΟΝΟ ο Ωροσκόπος: το ζώδιό του, η πρώτη εντύπωση που δίνει, το σώμα και το ύφος της, οι πλανήτες στον 1ο οίκο αν υπάρχουν, και πού βρίσκεται ο κυβερνήτης του Ωροσκόπου.` : `Πώς τη βλέπουν οι άλλοι, χωρίς Ωροσκόπο: η εικόνα που βγάζουν ο Ερμής, ο Άρης και η Αφροδίτη μαζί προς τα έξω, το ύφος της, η πρώτη εντύπωση. Μην αναλύσεις βαθιά Αφροδίτη και Άρη, έχουν δικό τους κεφάλαιο.` },
  { title: "Η Σελήνη σου: τι χρειάζεται η καρδιά σου", focus: (t) => `ΜΟΝΟ η Σελήνη: ζώδιο${t ? ", οίκος" : ""} και όψεις. Τα συναισθήματα, τι τη γαληνεύει, πώς αντιδρά όταν πληγώνεται, η μητέρα ως εικόνα, τι χρειάζεται για να νιώσει ασφάλεια. Αν η Σελήνη δεν δίνεται, μίλησε για τις συναισθηματικές της ανάγκες από τον 4ο οίκο ή τον Καρκίνο στον χάρτη και πες ότι η μέρα της γέννησης έφερε αλλαγή της Σελήνης, χωρίς να μαντέψεις ζώδιο.` },
  { title: "Ο Ερμής σου: πώς σκέφτεσαι και πώς μιλάς", focus: (t) => `ΜΟΝΟ ο Ερμής: ζώδιο${t ? ", οίκος" : ""}, όψεις, αν είναι ανάδρομος. Ο τρόπος σκέψης, μάθησης, επικοινωνίας, τα αδέλφια και το κοντινό περιβάλλον, πού παρεξηγείται.` },
  { title: "Αφροδίτη και Άρης: πώς αγαπάς και τι σε ελκύει", focus: (t) => `ΜΟΝΟ Αφροδίτη και Άρης: ζώδια${t ? ", οίκοι" : ""}, όψεις μεταξύ τους και με τους άλλους. Πώς αγαπά, τι την ελκύει, το πάθος, η θηλυκή και η αρσενική της ενέργεια, πώς διεκδικεί, πώς θυμώνει.` },
  { title: "Οι σχέσεις και ο σύντροφος της ζωής σου", focus: (t) => t ? `Ο 7ος οίκος και η Δύση: τι σύντροφο χρειάζεται, τι μοτίβο επαναλαμβάνει στις σχέσεις, ο κυβερνήτης του 7ου οίκου και πού βρίσκεται, ο Κρόνος ή ο Δίας αν αγγίζουν τις σχέσεις. Μην ξαναναλύσεις Αφροδίτη και Άρη, απλώς δέσε μαζί τους.` : `Χωρίς ώρα γέννησης δεν υπάρχει 7ος οίκος: μίλα για τις σχέσεις από τις όψεις της Αφροδίτης και της Σελήνης με τον Κρόνο και τον Δία, και από το στοιχείο που της λείπει. Τι σύντροφο χρειάζεται και τι μοτίβο επαναλαμβάνει. Μην ξαναναλύσεις Αφροδίτη και Άρη.` },
  { title: "Η καριέρα και η αποστολή σου", focus: (t) => t ? `Το Μεσουράνημα και ο 10ος οίκος, ο 6ος οίκος (η καθημερινή δουλειά), ο κυβερνήτης του 10ου και πού βρίσκεται, ο Κρόνος και ο Ήλιος ως προς τη δουλειά. Σε τι είναι προικισμένη, τι δουλειά τη γεμίζει, πώς τη βλέπει ο κόσμος επαγγελματικά.` : `Η δουλειά και η αποστολή από τον Ήλιο, τον Κρόνο, τον Δία και το στοιχείο που κυριαρχεί. Σε τι είναι προικισμένη και τι δουλειά τη γεμίζει. Χωρίς οίκους.` },
  { title: "Τα χρήματα και η αξία σου", focus: (t) => t ? `Ο 2ος οίκος (τα δικά της χρήματα, η αξία της), ο 8ος (κοινά χρήματα, κληρονομιές, ό,τι μοιράζεται), οι κυβερνήτες τους, η Αφροδίτη και ο Δίας ως προς τα χρήματα, ο Κλήρος της Τύχης. Πώς κερδίζει, πώς ξοδεύει, τι μπλοκάρει την αφθονία. Χωρίς επενδυτικές συμβουλές.` : `Τα χρήματα από την Αφροδίτη, τον Δία, τον Κρόνο και τα στοιχεία γης στον χάρτη: πώς κερδίζει, πώς ξοδεύει, τι μπλοκάρει την αφθονία. Χωρίς οίκους και χωρίς επενδυτικές συμβουλές.` },
  { title: "Η οικογένεια και οι ρίζες σου", focus: (t) => t ? `Ο 4ος οίκος και το Ναδίρ, ο κυβερνήτης του 4ου, η Σελήνη και ο Κρόνος ως προς το σπίτι. Η οικογένεια καταγωγής, τι κουβαλά από το σπίτι που μεγάλωσε, τι σπίτι χτίζει η ίδια, τα παιδιά (5ος οίκος) με λίγα λόγια.` : `Η οικογένεια και οι ρίζες από τη Σελήνη, τον Κρόνο και τα στοιχεία νερού και γης. Τι κουβαλά από το σπίτι που μεγάλωσε και τι σπίτι χτίζει. Χωρίς οίκους.` },
  { title: "Δίας και Κρόνος: η τύχη σου και τα μαθήματά σου", focus: (t) => `ΜΟΝΟ Δίας και Κρόνος: ζώδια${t ? ", οίκοι" : ""}, όψεις. Πού έρχεται η τύχη εύκολα και πού χρειάζεται κόπος, τα μεγάλα μαθήματα της ζωής, η ωρίμανση. Ανέφερε ότι ο Κρόνος γυρίζει στη θέση της γέννησης κάθε 29 περίπου χρόνια και τι σημαίνει αυτό, χωρίς να μαντέψεις ημερομηνίες.` },
  { title: "Το κάρμα και ο προορισμός σου", focus: (t) => `ΜΟΝΟ οι Δεσμοί της Σελήνης: ο Νότιος Δεσμός (ό,τι φέρνει εύκολα από πριν, η ζώνη άνεσης που την κρατά πίσω) και ο Βόρειος (ο δρόμος που ήρθε να περπατήσει)${t ? ", με τους οίκους τους" : ""}. Είναι το πιο συγκινητικό κεφάλαιο: μίλα για νόημα και αποστολή, με τρυφερότητα.` },
  { title: "Η πληγή και το δώρο σου", focus: (t) => `Ο Χείρωνας (αν δίνεται) και η Μαύρη Σελήνη (Λίλιθ)${t ? ", και ο 12ος οίκος" : ""}. Η βαθιά πληγή που γίνεται χάρισμα θεραπείας για τους άλλους, και η κρυφή, καταπιεσμένη δύναμη που ζητά να βγει. Με μεγάλη τρυφερότητα, χωρίς να τρομάξεις. Αν ο Χείρωνας λέει «ΜΗΝ τον αναφέρεις», μην τον αναφέρεις καθόλου και στήριξε την πληγή στον Κρόνο.` },
  { title: "Ο χρησμός του Μαντείου για τη ζωή σου", focus: () => `Οι πιο στενές όψεις του χάρτη ως η «ραχοκοκαλιά» της ζωής της: τι ένταση δημιουργούν και τι δύναμη κρύβουν. Μετά δέσε όλο τον χάρτη σε ένα μήνυμα: τα τρία μεγαλύτερα δώρα της, η μία μεγάλη πρόκληση, και ένας προσωπικός χρησμός από τον Ιάκωβο που να μπορεί να τον κρατήσει για πάντα. Τελείωσε με ζεστό αποχαιρετισμό με το όνομά της.` }
];

export const PLUS_CHAPTERS = [
  { title: "Η χρονιά σου: ο χάρτης των γενεθλίων σου", plus: "solar", focus: () => `Η ΗΛΙΑΚΗ ΕΠΙΣΤΡΟΦΗ από τα στοιχεία της πιο πάνω. Πρώτα η ΤΡΕΧΟΥΣΑ χρονιά ως τα επόμενα γενέθλια: ο Ωροσκόπος της χρονιάς, πού πέφτουν Ήλιος και Σελήνη της χρονιάς (ποιος τομέας ζωής φωτίζεται), Αφροδίτη και Δίας της χρονιάς. Μετά, πιο σύντομα, τι αλλάζει από τα ΕΠΟΜΕΝΑ γενέθλια. Γράφεις τις ημερομηνίες γενεθλίων ακριβώς όπως δίνονται.` },
  { title: "Οι επόμενοι 12 μήνες σου, εποχή με εποχή", plus: "sky", focus: () => `Οι επόμενοι 12 μήνες από τον ΠΡΑΓΜΑΤΙΚΟ ΟΥΡΑΝΟ: χώρισέ τους σε εποχές (φθινόπωρο, χειμώνας, άνοιξη, καλοκαίρι, ξεκινώντας από την τρέχουσα). Για κάθε εποχή: τι φέρνει στην αγάπη, στη δουλειά και στα χρήματα, ποιες ημερομηνίες είναι οι πιο δυνατές και τι να κάνει τότε. Χρησιμοποιείς ΜΟΝΟ ημερομηνίες της λίστας.` }
];

export const chapterTitle = (ch, hasTime) => typeof ch.title === "function" ? ch.title(hasTime) : ch.title;
// Με την πρόβλεψη, τα δύο κεφάλαια της χρονιάς μπαίνουν πριν από τον τελικό χρησμό και τον αποχαιρετισμό.
export const chapterList = (plus) => plus ? [...CHAPTERS.slice(0, -1), ...PLUS_CHAPTERS, CHAPTERS[CHAPTERS.length - 1]] : CHAPTERS;
export const CHAPTER_MARK = "[ΚΕΦΑΛΑΙΟ]";
