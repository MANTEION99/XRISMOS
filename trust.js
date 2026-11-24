/* Σιγουριά για την πληρωμή: μπάρα στην κορυφή και μικρή σημείωση κάτω από κάθε κουμπί πληρωμής */
(function () {
  var LOCK = '<svg width="13" height="13" viewBox="0 0 24 24" style="vertical-align:-2px;margin-right:6px" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  function bar() {
    if (document.getElementById("tbar")) return;
    var b = document.createElement("div"); b.id = "tbar";
    b.style.cssText = "position:sticky;top:0;z-index:50;background:rgba(11,10,22,.92);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);width:100%;box-sizing:border-box;flex:0 0 100%;text-align:center;font:600 13px/1.4 Inter,Arial,sans-serif;color:#E9E3D3;padding:8px 10px 7px;letter-spacing:.2px";
    // Δαχτυλίδι στα χρώματα του IRIS (κόκκινο, μπλε, πορτοκαλί, πετρόλ)
    var ring = '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:-2px;margin:0 5px 0 4px;' +
      'background:radial-gradient(circle,#0B0A16 0 33%,transparent 35%),conic-gradient(#2670b5 0 25%,#169c96 0 50%,#f68d22 0 75%,#ee3b38 0)"></span>';
    b.innerHTML = LOCK + "Ασφαλείς πληρωμές με" + ring + '<b style="color:#fff;letter-spacing:.5px">IRIS</b>';
    document.body.insertBefore(b, document.body.firstChild);
    var bs = getComputedStyle(document.body);
    if (bs.display.indexOf("flex") > -1 && bs.flexDirection.indexOf("row") === 0) document.body.style.flexWrap = "wrap";
  }
  function note(btn) {
    if (!btn) return;
    // Η σύγκριση τιμής μένει αμέσως κάτω από το κουμπί, και η σημείωση ασφάλειας μπαίνει μετά από αυτήν.
    if (btn.nextElementSibling && /value-note/.test(btn.nextElementSibling.className)) btn = btn.nextElementSibling;
    if (btn.nextElementSibling && btn.nextElementSibling.className === "tnote") return;
    var n = document.createElement("div"); n.className = "tnote";
    n.style.cssText = "font:13px/1.55 Inter,Arial,sans-serif;color:#cfc8b8;text-align:center;margin:12px auto 0;max-width:420px";
    n.innerHTML = '<div style="color:#D9B25C;font-weight:700;margin-bottom:3px">' + LOCK + 'Ασφαλής πληρωμή</div>' +
      'Πληρώνεις με <b>IRIS</b> από την τράπεζά σου ή με <b>κάρτα</b>, μέσω Viva και Stripe. ' +
      'Τα στοιχεία της κάρτας ή του λογαριασμού σου δεν τα βλέπει και δεν τα κρατά Το Μαντείο. ' +
      'Αν από τεχνικό πρόβλημα δεν πάρεις την απάντηση, σου επιστρέφουμε τα χρήματα. <a href="/oroi" style="color:#D9B25C">Όροι</a>';
    btn.insertAdjacentElement("afterend", n);
  }
  // Μεγαλύτερη ένδειξη IRIS μέσα στη σελίδα (στον Ωροσκόπο: πάνω από τις ερωτήσεις, και πριν και μετά το αποτέλεσμα)
  function badge(el, where) {
    if (!el || el.querySelector(".tbadge") || (el.previousElementSibling && el.previousElementSibling.className === "tbadge")) return;
    var r = '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;vertical-align:-3px;margin:0 6px 0 5px;' +
      'background:radial-gradient(circle,#14122a 0 33%,transparent 35%),conic-gradient(#2670b5 0 25%,#169c96 0 50%,#f68d22 0 75%,#ee3b38 0)"></span>';
    var d = document.createElement("div"); d.className = "tbadge";
    d.style.cssText = "text-align:center;font:600 15px/1.5 Inter,Arial,sans-serif;color:#E9E3D3;margin:14px 0 10px";
    d.innerHTML = LOCK.replace('width="13" height="13"', 'width="15" height="15"') + "Πληρώνεις με ασφάλεια με" + r + '<b style="color:#fff;letter-spacing:.5px">IRIS</b>';
    el.insertAdjacentElement(where, d);
  }
  function run() { bar(); badge(document.getElementById("more"), "afterbegin"); var a = document.getElementById("ask"); if (a) badge(a, "beforebegin"); note(document.getElementById("unlockBtn")); note(document.getElementById("bBuy")); }
  if (document.body) run(); else document.addEventListener("DOMContentLoaded", run);
})();
