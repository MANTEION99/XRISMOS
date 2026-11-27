// Ο γενέθλιος χάρτης ενός μέλους για τη σελίδα των Εκλεκτών: θέσεις πλανητών, οίκοι,
// Ωροσκόπος, Μεσουράνημα και όψεις. Υπολογίζεται τοπικά (astronomy-engine).
import Astronomy from "./vendor/astronomy.cjs";
import makeSky from "./sky.cjs";
import placeLib from "./place.cjs";
import localChartLib from "./local-chart.cjs";
const { zoneOffset } = makeSky(Astronomy);
const { localChart } = localChartLib;

export async function memberChart(p) {
  const found = p.pob ? await placeLib.resolvePlace(p.pob).catch(() => null) : null;
  const place = found
    ? { lat: found.lat, lon: found.lon, tzName: found.tzName, label: found.name }
    : { lat: 37.9838, lon: 23.7275, tzName: "Europe/Athens", label: "" };
  const [y, m, d] = p.dob.split("-").map(Number);
  const hasTime = /^\d{2}:\d{2}$/.test(p.tob || "");
  const [hh, mm] = hasTime ? p.tob.split(":").map(Number) : [12, 0];
  const c = localChart({ year: y, month: m, day: d, hour: hh, min: mm, lat: place.lat, lon: place.lon, tzone: zoneOffset(place.tzName, y, m, d, hh, mm) });
  const planets = c.planets.filter(x => x.name !== "Ascendant").map(x => ({ name: x.name, lon: +x.full_degree, retro: x.is_retro === "true" && x.name !== "Node", house: hasTime ? x.house : null }));
  return {
    hasTime, place: p.pob || place.label || "", placeFound: !!found,
    dob: p.dob, tob: hasTime ? p.tob : "",
    planets,
    asc: hasTime ? +c.ascendant : null,
    mc: hasTime ? +c.midheaven : null,
    cusps: hasTime ? c.houses.map(h => +h.degree) : null,
    aspects: c.aspects.map(a => ({ a: a.aspecting_planet, b: a.aspected_planet, type: a.type, orb: a.orb }))
  };
}
