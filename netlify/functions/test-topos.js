// ΠΡΟΣΩΡΙΝΟ: έλεγχος εύρεσης τόπου γέννησης με το πραγματικό AstrologyAPI. Μόνο σε deploy preview.
const astro = require("../lib/astro.cjs");

const PLACES = [
  "Αθήνα", "Θεσσαλονίκη", "Πάτρα", "Χανιά Κρήτης", "Κομοτηνή", "Ανώγεια", "Νέα Σμύρνη",
  "Καλαμάτα, Μεσσηνία", "Λευκωσία", "Λεμεσός", "Λονδίνο", "Μελβούρνη", "Νέα Υόρκη",
  "Στουτγκάρδη", "Κωνσταντινούπολη", "Αλεξάνδρεια", "Ηράκλειο", "Δράμα", "Λαύριο", "Αγρίνιο", "Κηφισιά", "Μέτσοβο", "Σέρρες", "Μόναχο", "Σικάγο", "Thessaloniki", "asdfgh"
];

exports.handler = async function (event) {
  const host = (event.headers && (event.headers.host || event.headers.Host)) || "";
  if (!host.includes("deploy-preview")) return { statusCode: 404, body: "Not found" };
  const t0 = Date.now();
  const rows = await Promise.all(PLACES.map(async (p) => {
    const r = await astro.place(p, "1968-07-15", "10:30");
    return `${r.found ? "OK " : "-- "} ${p.padEnd(22)} => ${r.label}  lat ${r.lat}  lon ${r.lon}  ${r.tzName}  UTC${r.tzone >= 0 ? "+" : ""}${r.tzone}`;
  }));
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: rows.join("\n") + `\n\n${Math.round((Date.now() - t0) / 100) / 10} δευτερόλεπτα`
  };
};
