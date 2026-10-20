// Σύντομα links για τα posts: manteio.live/r/ΚΩΔΙΚΟΣ
// Πάνε στο «Ρώτα το Μαντείο» με utm_campaign=ΚΩΔΙΚΟΣ, ώστε να ξέρουμε ποιο post έφερε κάθε χρησμό και πληρωμή.
// Αν ο κωδικός ξεκινά με όνομα εργαλείου και παύλα (π.χ. agapi-21krios), πάει σε εκείνο το εργαλείο.
// Νέοι κωδικοί δεν θέλουν καμία αλλαγή εδώ: οποιοσδήποτε κωδικός δουλεύει.

const TOOLS = ["erotima", "epistrofi", "agapi", "alitheia", "symvatotita", "oikonomika", "arithmologia", "taro"];

export default async (req, context) => {
  const raw = String(context.params?.code || "").toLowerCase();
  const code = raw.replace(/[^a-z0-9-]/g, "").slice(0, 40) || "xoris-kodiko";
  const first = code.split("-")[0];
  const tool = TOOLS.includes(first) && code.includes("-") ? first : "erotima";
  const target = `/${tool}?utm_source=facebook&utm_medium=social&utm_campaign=${encodeURIComponent(code)}`;
  return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store" } });
};

export const config = { path: "/r/:code" };
