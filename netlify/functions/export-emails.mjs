// Εξαγωγή των email σε CSV (ανοίγει στο Excel), για Custom Audiences και επικοινωνία.
// Προστατεύεται με κωδικό: manteio.live/api/export-emails?key=ΚΩΔΙΚΟΣ
// Ο κωδικός ορίζεται στο Netlify, στη μεταβλητή περιβάλλοντος EXPORT_KEY.
//
// Μία γραμμή ανά email και εργαλείο. Προαιρετικά:
//   &consent=1  μόνο όσοι έδωσαν συναίνεση για επικοινωνία
//   &tests=1    να συμπεριληφθούν και οι δοκιμές (email που περιέχουν "pliromes2021")
//   &ana=post   αντί για email, πίνακας ανά post (σύντομο link): δωρεάν χρησμοί και πληρωμένοι

import { getStore } from "@netlify/blobs";

const SIGNS = [
  ["Αιγόκερως", 1, 19], ["Υδροχόος", 2, 18], ["Ιχθύες", 3, 20], ["Κριός", 4, 19], ["Ταύρος", 5, 20], ["Δίδυμοι", 6, 20],
  ["Καρκίνος", 7, 22], ["Λέων", 8, 22], ["Παρθένος", 9, 22], ["Ζυγός", 10, 22], ["Σκορπιός", 11, 21], ["Τοξότης", 12, 21]
];
// Ζώδιο από ημερομηνία γέννησης ΕΕΕΕ-ΜΜ-ΗΗ (με τις συνηθισμένες ημερομηνίες αλλαγής).
function signOf(dob) {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(dob || ""));
  if (!m) return "";
  const mo = +m[1], d = +m[2];
  const [name, , last] = SIGNS[mo - 1];
  return d <= last ? name : SIGNS[mo % 12][0];
}

const TOOL_NAMES = {
  epistrofi: "Επιστροφή", erotima: "Ρώτα το Μαντείο", agapi: "Αγάπη", alitheia: "Αλήθεια",
  symvatotita: "Συμβατότητα", oikonomika: "Οικονομικά", numerology: "Αριθμολογία", taro: "Ταρώ"
};

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function allDocs(store) {
  const out = [];
  // Χωρίς paginate, το list() φέρνει όλες τις σελίδες μαζί.
  const { blobs } = await store.list();
  for (const b of blobs) {
    try { const doc = await store.get(b.key, { type: "json" }); if (doc) out.push(doc); } catch {}
  }
  return out;
}

export default async (req) => {
  const url = new URL(req.url);
  const key = process.env.EXPORT_KEY || "";
  if (!key || key.length < 12) return new Response("Δεν έχει οριστεί κωδικός EXPORT_KEY (τουλάχιστον 12 χαρακτήρες) στο Netlify.", { status: 503 });
  if (url.searchParams.get("key") !== key) return new Response("Λάθος κωδικός.", { status: 403 });
  const onlyConsent = url.searchParams.get("consent") === "1";
  const withTests = url.searchParams.get("tests") === "1";

  const docs = [
    ...(await allDocs(getStore({ name: "oracle-readings", consistency: "strong" }))),
    ...(await allDocs(getStore({ name: "epistrofi-readings", consistency: "strong" })))
  ];

  const today = new Date().toISOString().slice(0, 10);
  const csv = (header, rows, name) => new Response("\uFEFF" + [header.join(",")].concat(rows.map(r => r.map(csvCell).join(","))).join("\r\n"), {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" }
  });

  // Ανά post: πόσοι δωρεάν χρησμοί και πόσοι πληρωμένοι ήρθαν από κάθε σύντομο link.
  if (url.searchParams.get("ana") === "post") {
    const per = new Map();
    for (const r of docs) {
      if (r.kind === "question") continue;
      const email = String(r.email || "").toLowerCase();
      if (!email || (!withTests && /pliromes2021/.test(email))) continue;
      const src = (r.src || "χωρίς link").split("/").pop();
      const x = per.get(src) || { free: 0, paid: 0, first: r.createdAt || "" };
      x.free++;
      if (r.full || r.paidSession) x.paid++;
      if ((r.createdAt || "") < x.first) x.first = r.createdAt;
      per.set(src, x);
    }
    const rows = [...per.entries()].sort((a, b) => b[1].free - a[1].free)
      .map(([src, x]) => [src, x.free, x.paid, x.free ? Math.round(100 * x.paid / x.free) + "%" : "", (x.first || "").slice(0, 10)]);
    return csv(["post (κωδικός link)", "δωρεάν χρησμοί", "πλήρωσαν", "ποσοστό", "πρώτη φορά"], rows, `manteio-ana-post-${today}.csv`);
  }

  // Μία εγγραφή ανά email και εργαλείο: κρατάμε την πιο πρόσφατη, η συναίνεση και η πληρωμή μετράνε αν υπήρξαν έστω μία φορά.
  const rows = new Map();
  for (const r of docs) {
    if (r.kind === "question") continue;
    const email = String(r.email || "").trim().toLowerCase();
    if (!email) continue;
    if (!withTests && /pliromes2021/.test(email)) continue;
    const tool = r.tool || "epistrofi";
    const k = `${email}|${tool}`;
    const p = r.inputs || {};
    const paid = !!(r.full || r.paidSession);
    const prev = rows.get(k);
    const created = r.createdAt || "";
    const row = {
      email, name: p.name1 || "", sign: signOf(p.dob1), dob: p.dob1 || "", tool: TOOL_NAMES[tool] || tool,
      src: (prev && prev.src) || (r.src || "").split("/").pop(),
      paid: paid || (prev && prev.paid), consent: !!r.marketingConsent || (prev && prev.consent),
      date: prev && prev.date > created ? prev.date : created
    };
    rows.set(k, row);
  }

  let list = [...rows.values()];
  if (onlyConsent) list = list.filter(r => r.consent);
  list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const header = ["email", "όνομα", "ζώδιο", "ημερομηνία γέννησης", "εργαλείο", "πλήρωσε", "συναίνεση επικοινωνίας", "ημερομηνία", "πηγή (post)"];
  const lines = [header.join(",")].concat(list.map(r => [
    r.email, r.name, r.sign, r.dob, r.tool, r.paid ? "ναι" : "όχι", r.consent ? "ναι" : "όχι", (r.date || "").slice(0, 10), r.src || ""
  ].map(csvCell).join(",")));

  // Το BOM στην αρχή κάνει το Excel να διαβάζει σωστά τα ελληνικά.
  return new Response("﻿" + lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="manteio-emails-${today}${onlyConsent ? "-synainesi" : ""}.csv"`,
      "Cache-Control": "no-store"
    }
  });
};

export const config = { path: "/api/export-emails", method: "GET" };
