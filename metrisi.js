/* Μετρητής χωρίς cookies: στέλνει μόνο σελίδα, πηγή και γεγονός. Δεν κρατά τίποτα στη συσκευή. */
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
  var page = location.pathname.replace(/\.html$/, "").replace(/-tool-agora$/, "") || "/";
  send({ t: "v", p: page, s: source() });
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
        // Πληρωμένη απάντηση: μετριέται μία φορά ανά πληρωμή (όχι σε κάθε άνοιγμα ή ανανέωση της σελίδας)
        var sid = new URLSearchParams(location.search).get("session_id") || "";
        var p = of.apply(this, arguments);
        p.then(function (r) {
          if (!r.ok || !sid) return;
          var key = "manteio_paid_" + sid;
          try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch (e) {}
          send({ t: "e", e: "pliromeni:" + tool, u: sid });
          // Με ποιον τρόπο πλήρωσε: vv_ είναι Viva (IRIS), cs_ είναι Stripe (κάρτα, Apple Pay, Google Pay)
          send({ t: "e", e: "tropos-pliromis:" + (/^vv_/.test(sid) ? "iris" : "karta"), u: sid + "#m" });
        }).catch(function () {});
        return p;
      }
    } catch (e) {}
    return of.apply(this, arguments);
  };
})();
