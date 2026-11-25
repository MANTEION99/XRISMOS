/* Μετρητής χωρίς cookies: στέλνει μόνο σελίδα, πηγή και γεγονός. Δεν κρατά τίποτα στη συσκευή. Νέος ή ξαναήρθε βγαίνει από την απάντηση 18+ που υπάρχει ήδη. */
(function () {
  if (navigator.webdriver) return;
  function send(o) {
    try {
      var b = JSON.stringify(o);
      if (navigator.sendBeacon) navigator.sendBeacon("/api/metrisi", new Blob([b], { type: "application/json" }));
      else fetch("/api/metrisi", { method: "POST", headers: { "Content-Type": "application/json" }, body: b, keepalive: true });
    } catch (e) {}
  }
  function source() {
    var q = new URLSearchParams(location.search), u = (q.get("utm_source") || "").toLowerCase();
    if (u) return /tiktok/.test(u) ? "tiktok" : /insta/.test(u) ? "instagram" : /face|fb/.test(u) ? "facebook" : "alli";
    if (q.get("src")) return "esoteriki";
    var r = document.referrer || "";
    if (!r) return "agnosti";
    try { var h = new URL(r).hostname; } catch (e) { return "alli"; }
    if (h.indexOf("manteio.live") > -1 || h === location.hostname) return "esoteriki";
    if (/tiktok/.test(h)) return "tiktok";
    if (/instagram/.test(h)) return "instagram";
    if (/messenger/.test(h)) return "messenger";
    if (/facebook|fb\./.test(h)) return "facebook";
    if (/google\./.test(h)) return "google";
    if (/youtube/.test(h)) return "youtube";
    return "alli";
  }
  // Νέος ή ξαναήρθε: κοιτάμε μόνο αν η συσκευή έχει ήδη απαντήσει στο 18+ (manteio_18). Τίποτα καινούργιο δεν αποθηκεύεται.
  // Κρατιέται για όλη την ίδια επίσκεψη (μέχρι να κλείσει η καρτέλα), ώστε όποιος μπήκε πρώτη φορά και πλήρωσε να μετρηθεί σωστά ως νέος.
  var ret = 0;
  try {
    var ss = sessionStorage.getItem("manteio_r");
    if (ss === "0" || ss === "1") ret = +ss;
    else { ret = localStorage.getItem("manteio_18") === "1" ? 1 : 0; sessionStorage.setItem("manteio_r", String(ret)); }
  } catch (e) {}
  var page = location.pathname.replace(/\.html$/, "").replace(/-tool-agora$/, "") || "/";
  // Άνθρωποι: η πρώτη σελίδα κάθε επίσκεψης (μέχρι να κλείσει η καρτέλα) μετράει ένα άτομο, με την πηγή από την οποία ήρθε.
  // Η σημαία ζει μόνο όσο είναι ανοιχτή η καρτέλα (sessionStorage) και δεν περιέχει κανένα στοιχείο.
  var first = 0;
  try { if (!sessionStorage.getItem("manteio_p")) { sessionStorage.setItem("manteio_p", "1"); first = 1; } } catch (e) {}
  send({ t: "v", p: page, s: source(), r: ret, h: first });
  var tool = page.replace(/^\//, "") || "arxiki";
  var once = {};
  function ev(name) { if (once[name]) return; once[name] = 1; send({ t: "e", e: name }); }
  window.manteioEvent = ev;
  var of = window.fetch;
  if (of) window.fetch = function (u) {
    try {
      var s = typeof u === "string" ? u : (u && u.url) || "";
      if (/\/api\/oroskopos/.test(s)) ev("oroskopos");
      else if (/teaser/.test(s)) ev("dorean:" + tool);
      else if (/create-checkout|synomilia-buy/.test(s)) ev("pliromi-koumpi:" + tool);
      else if (/-full|epistrofi-agora/.test(s)) {
        // Άνοιξε την πληρωμένη απάντηση. Η ίδια η πληρωμή μετριέται στον server, όταν την επιβεβαιώσει το Stripe ή η Viva.
        // Εδώ στέλνουμε μόνο ότι άνοιξε, για τη γραμμή «Ξαναείδαν την απάντηση που πλήρωσαν».
        var sid = new URLSearchParams(location.search).get("session_id") || "";
        var p = of.apply(this, arguments);
        p.then(function (r) {
          if (!r.ok || !sid || once["p:" + sid]) return;
          once["p:" + sid] = 1;
          send({ t: "p", p: tool, u: sid, r: ret });
        }).catch(function () {});
        return p;
      }
    } catch (e) {}
    return of.apply(this, arguments);
  };
})();
