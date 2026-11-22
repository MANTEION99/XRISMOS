/* Επιλογή τρόπου πληρωμής: κάρτα (Stripe) ή IRIS (Viva). Εμφανίζεται μόνο όταν η IRIS είναι ενεργή. */
(function () {
  var ready = false;
  try { fetch("/api/viva-ready", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) { ready = !!(d && d.ready); }).catch(function () {}); } catch (e) {}

  function css() {
    if (document.getElementById("pcCss")) return;
    var s = document.createElement("style"); s.id = "pcCss";
    s.textContent = "#pcBg{position:fixed;inset:0;background:rgba(5,4,12,.78);z-index:99998;display:flex;align-items:flex-end;justify-content:center}" +
      "#pcBox{background:#14122a;border:1px solid #D9B25C;border-radius:18px 18px 0 0;padding:20px 16px 26px;width:100%;max-width:520px;color:#F5F1E8;font:15px/1.5 Inter,Arial,sans-serif}" +
      "#pcBox h3{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;color:#D9B25C;margin:0 0 14px;text-align:center;font-weight:600}" +
      "#pcBox button{display:block;width:100%;text-align:left;background:rgba(217,178,92,.06);border:1px solid rgba(217,178,92,.55);border-radius:14px;color:#F5F1E8;padding:14px 16px;margin-bottom:10px;cursor:pointer;font:inherit}" +
      "#pcBox b{display:block;font-size:17px;color:#F5F1E8}#pcBox span{font-size:13.5px;color:#B9B3C9}";
    document.head.appendChild(s);
  }
  function choose() {
    return new Promise(function (res) {
      css();
      var bg = document.createElement("div"); bg.id = "pcBg";
      bg.innerHTML = "<div id='pcBox' role='dialog' aria-label='Τρόπος πληρωμής'><h3>Πώς θέλεις να πληρώσεις;</h3>" +
        "<button type='button' data-p='viva'><b>Με IRIS, από την τράπεζά σου</b><span>Πληρώνεις από το e-banking της τράπεζάς σου, χωρίς κάρτα.</span></button>" +
        "<button type='button' data-p='stripe'><b>Με κάρτα</b><span>Χρεωστική ή πιστωτική κάρτα, Apple Pay ή Google Pay.</span></button>" +
        "<div style='text-align:center;font-size:12px;color:#a8a2bf;margin-top:6px'>Ασφαλής πληρωμή μέσω <b style='color:#fff;letter-spacing:.3px'>viva.com</b> (IRIS) και <b style='color:#fff'>Stripe</b> (κάρτα)</div></div>";
      document.body.appendChild(bg);
      bg.querySelectorAll("button").forEach(function (b) { b.onclick = function () {
        var c = b.getAttribute("data-p");
        // Μέτρηση: ποιον τρόπο διάλεξαν στο παράθυρο
        try { if (window.manteioEvent) manteioEvent("epilogi-pliromis:" + (c === "viva" ? "iris" : "karta")); } catch (e) {}
        bg.remove(); res(c); }; });
    });
  }
  // Μήνυμα αναμονής όσο ανοίγει η σελίδα πληρωμής IRIS της Viva
  function wait() {
    var w = document.createElement("div");
    w.style.cssText = "position:fixed;inset:0;z-index:99997;background:rgba(5,4,12,.85);display:flex;align-items:center;justify-content:center;padding:20px";
    w.innerHTML = "<div style='max-width:420px;background:#14122a;border:1px solid #D9B25C;border-radius:16px;padding:22px 18px;text-align:center;color:#F5F1E8;font:15px/1.55 Inter,Arial,sans-serif'>" +
      "<div style='width:34px;height:34px;margin:0 auto 12px;border:3px solid rgba(217,178,92,.3);border-top-color:#D9B25C;border-radius:50%;animation:pcspin 1s linear infinite'></div>" +
      "<b style='color:#D9B25C;font-size:17px'>Ανοίγει η ασφαλής πληρωμή IRIS</b><br>Περίμενε λίγα δευτερόλεπτα." +
      "<div style='margin-top:10px;color:#cfc8b8'>Πληρώνεις από το e-banking ή την εφαρμογή της τράπεζάς σου. Μόλις ολοκληρωθεί η πληρωμή, επιστρέφεις αυτόματα εδώ και η απάντησή σου αρχίζει να γράφεται. Μην κλείσεις τη σελίδα πληρωμής πριν ολοκληρωθεί.</div></div>" +
      "<style>@keyframes pcspin{to{transform:rotate(360deg)}}</style>";
    document.body.appendChild(w);
    return w;
  }
  function toast(t) {
    var d = document.createElement("div");
    d.style.cssText = "position:fixed;left:12px;right:12px;top:12px;z-index:99999;max-width:520px;margin:0 auto;background:#3a1420;border:1px solid #e07a8c;border-radius:14px;padding:12px 14px;color:#fff;font:14px/1.45 Inter,Arial,sans-serif";
    d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 15000);
  }
  var of = window.fetch;
  if (of) window.fetch = function (u, opts) {
    try {
      var url = typeof u === "string" ? u : (u && u.url) || "";
      if (ready && /create-checkout/.test(url) && opts && typeof opts.body === "string") {
        var b = JSON.parse(opts.body);
        if (!b.provider) {
          var self = this;
          return choose().then(function (p) {
            if (p !== "viva") return of.call(self, u, opts);
            b.provider = "viva"; opts = Object.assign({}, opts, { body: JSON.stringify(b) });
            var w = wait();
            return of.call(self, u, opts).then(function (r) {
              r.clone().json().then(function (d) { if (!d || !d.url) w.remove(); }).catch(function () { w.remove(); });
              // Αν η Viva δεν δώσει σελίδα πληρωμής, δείχνουμε τι έγινε αντί να μη γίνεται τίποτα
              r.clone().json().then(function (d) {
                if (!d || !d.url) toast("Η πληρωμή με IRIS δεν άνοιξε. " + ((d && (d.details || d.error)) || ("Σφάλμα " + r.status)) + " Δοκίμασε με κάρτα.");
              }).catch(function () { toast("Η πληρωμή με IRIS δεν άνοιξε (σφάλμα " + r.status + "). Δοκίμασε με κάρτα."); });
              return r;
            });
          });
        }
      }
    } catch (e) {}
    return of.apply(this, arguments);
  };
  try {
    if (new URLSearchParams(location.search).get("pay") === "fail") {
      var n = function () { css(); var d = document.createElement("div");
        d.style.cssText = "position:fixed;left:12px;right:12px;top:12px;z-index:99999;max-width:520px;margin:0 auto;background:#3a1420;border:1px solid #e07a8c;border-radius:14px;padding:12px 14px;color:#fff;font:15px Inter,Arial,sans-serif";
        d.textContent = "Η πληρωμή δεν ολοκληρώθηκε και δεν χρεώθηκες. Μπορείς να δοκιμάσεις ξανά.";
        document.body.appendChild(d); setTimeout(function () { d.remove(); }, 8000); };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", n); else n();
    }
  } catch (e) {}
})();
