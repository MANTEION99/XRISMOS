// ΠΡΟΣΩΡΙΝΟ, για διάγνωση: δείχνει τι απαντά το AstrologyAPI σε ένα σταθερό δοκιμαστικό χάρτη.
// Δεν δείχνει το κλειδί. Θα σβηστεί μόλις βρεθεί το πρόβλημα.
export default async () => {
  const key = process.env.ASTROLOGY_API_KEY || "";
  const body = { day: 15, month: 6, year: 1970, hour: 12, min: 0, lat: 37.9838, lon: 23.7275, tzone: 2, house_type: "placidus" };
  let status = null, text = "";
  try {
    const res = await fetch("https://json.astrologyapi.com/v1/western_horoscope", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-astrologyapi-key": key },
      body: JSON.stringify(body)
    });
    status = res.status;
    text = (await res.text()).slice(0, 600);
  } catch (e) {
    text = "fetch failed: " + e.message;
  }
  return new Response(JSON.stringify({
    key_set: !!key, key_length: key.length, key_has_spaces: key !== key.trim(),
    astrologyapi_status: status, astrologyapi_reply: text
  }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
};

export const config = { path: "/api/astro-check" };
