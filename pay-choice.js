/* Επιλογή τρόπου πληρωμής: κάρτα (Stripe) ή IRIS (Viva). Εμφανίζεται μόνο όταν η IRIS είναι ενεργή. */
(function () {
  var ready = false;
  var rawFetch = window.fetch; // το κανονικό fetch, χωρίς το παράθυρο πληρωμής που προσθέτουμε πιο κάτω
  // Προ-σύνδεση με τις σελίδες πληρωμής (κερδίζει χρόνο όταν πατηθεί η πληρωμή). Δεν στέλνει κανένα στοιχείο.
  try {
    ["https://checkout.stripe.com", "https://www.vivapayments.com"].forEach(function (h) {
      var l = document.createElement("link"); l.rel = "preconnect"; l.href = h; l.crossOrigin = "anonymous"; document.head.appendChild(l);
    });
  } catch (e) {}
  // Ζέσταμα του server πληρωμών μόλις φανεί κουμπί πληρωμής (μία φορά ανά σελίδα). Δεν δημιουργεί παραγγελία.
  try {
    var warmed = false, tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (warmed || tries > 150) { clearInterval(iv); return; }
      var ids = ["unlockBtn", "bBuy", "buyBtn", "payBtn"];
      for (var i = 0; i < ids.length; i++) {
        var b = document.getElementById(ids[i]);
        if (b && b.offsetParent !== null) {
          warmed = true; clearInterval(iv);
          if (rawFetch) rawFetch.call(window, "/.netlify/functions/create-checkout?warm=1", { cache: "no-store" }).catch(function () {});
          return;
        }
      }
    }, 2000);
  } catch (e) {}
  try { fetch("/api/viva-ready", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) { ready = !!(d && d.ready); }).catch(function () {}); } catch (e) {}

  function css() {
    if (document.getElementById("pcCss")) return;
    var s = document.createElement("style"); s.id = "pcCss";
    s.textContent = "#pcBg{position:fixed;inset:0;background:rgba(5,4,12,.78);z-index:99998;display:flex;align-items:flex-end;justify-content:center}" +
      "#pcBox{position:relative;background:#14122a;border:1px solid #D9B25C;border-radius:18px 18px 0 0;padding:20px 16px calc(34px + env(safe-area-inset-bottom));width:100%;max-width:520px;max-height:88vh;overflow-y:auto;color:#F5F1E8;font:15px/1.5 Inter,Arial,sans-serif}" +
      "#pcBox #pcX{position:absolute;top:8px;right:10px;width:40px;height:40px;padding:0;margin:0;border:0;background:none;color:#cfc8b8;font-size:28px;line-height:40px;text-align:center}" +
      "#pcBox h3{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;color:#D9B25C;margin:0 0 14px;text-align:center;font-weight:600}" +
      "#pcBox button{display:block;width:100%;text-align:center;background:rgba(217,178,92,.06);border:1px solid rgba(217,178,92,.55);border-radius:14px;color:#F5F1E8;padding:14px 16px;margin-bottom:10px;cursor:pointer;font:inherit}" +
      "#pcBox b{display:block;font-size:17px;color:#F5F1E8}#pcBox span{font-size:13.5px;color:#B9B3C9}" +
      "#pcWhat{text-align:center;margin:0 0 6px}#pcWhat .pcName{font-family:'Cormorant Garamond',Georgia,serif;font-size:21px;line-height:1.25;color:#F5F1E8;font-weight:600}" +
      "#pcWhat .pcPrice{font-size:26px;font-weight:700;color:#D9B25C;margin-top:4px}" +
      "#pcSure{text-align:center;font-size:13.5px;color:#cfc8b8;margin:0 0 14px}" +
      "#pcBox #pcBack{text-align:center;background:none;border:0;color:#cfc8b8;text-decoration:underline;font-size:15px;padding:12px 0 0;margin:6px 0 0}";
    document.head.appendChild(s);
  }
  // Τι αγοράζει και πόσο κοστίζει, για να το βλέπει μέσα στο παράθυρο πληρωμής.
  var NAMES = { epistrofi: "Θα επιστρέψει;", agapi: "Με σκέφτεται ακόμα;", alitheia: "Μου κρύβει κάτι;", oikonomika: "Το οικονομικό σου μέλλον",
    symvatotita: "Ταιριάζετε; Η Συναστρία σας", erotima: "Η δική σου ερώτηση", numerology: "Ο Χρησμός της Αριθμολογίας", taro: "Το Τρίφυλλο Ταρώ",
    xartis: "Ο Γενέθλιος Χάρτης σου", xartis_plus: "Ο Γενέθλιος Χάρτης σου και πρόβλεψη 12 μηνών", imerologio: "Οι καλές σου μέρες του 2027",
    paidi: "Ο χάρτης του παιδιού ή του εγγονιού" };
  var QUESTION_TOOLS = /^(epistrofi|agapi|alitheia|oikonomika|symvatotita|erotima|numerology|taro)(_q[23])?$/;
  function eur(c) { return (c % 100 ? (c / 100).toFixed(2).replace(".", ",") : String(c / 100)) + "€"; }
  function info(tool) {
    tool = String(tool || ""); var m = tool.match(QUESTION_TOOLS), name = "", price = 0;
    if (m) {
      name = "Η πλήρης απάντηση: " + NAMES[m[1]] + (m[2] ? " · " + m[2].slice(2) + "η ερώτηση" : "");
      price = m[2] === "_q2" ? 299 : m[2] === "_q3" ? 199 : 499;
    } else if (NAMES[tool]) {
      name = NAMES[tool];
      if (tool === "imerologio") {
        var d = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        price = d >= "2026-11-27" && d <= "2026-11-30" ? 1499 : 2999;
      } else price = { xartis: 3900, xartis_plus: 5900, paidi: 2499 }[tool] || 0;
    }
    return { name: name, price: price ? eur(price) : "" };
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // Ποιο κουμπί πατήθηκε τελευταίο, με το κείμενό του πριν αλλάξει σε «Μεταφορά...», ώστε το «Πίσω» να το επαναφέρει.
  var lastBtn = null, lastHTML = "";
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("button,a,[role=button]") : null;
    if (b && !b.closest("#pcBg")) { lastBtn = b; lastHTML = b.innerHTML; }
  }, true);
  function restoreBtn() {
    try {
      if (!lastBtn) return;
      lastBtn.innerHTML = lastHTML; lastBtn.style.pointerEvents = "auto"; lastBtn.disabled = false;
      lastBtn.classList.remove("busy"); lastBtn.removeAttribute("aria-busy");
    } catch (e) {}
  }
  function choose(tool) {
    return new Promise(function (res) {
      css();
            var bg = document.createElement("div"); bg.id = "pcBg";
      bg.innerHTML = "<div id='pcBox' role='dialog' aria-label='Τρόπος πληρωμής'>" +
        "<button type='button' data-p='viva'><b>IRIS</b></button>" +
        "<button type='button' data-p='stripe'><b>Κάρτα, Apple Pay, Google Pay</b></button>" +
        "<div style='text-align:center;font-size:12px;color:#a8a2bf;margin-top:4px'>Ασφαλής πληρωμή</div></div>";
      document.body.appendChild(bg);
      bg.addEventListener("click", function (e) {
        if (e.target !== bg) return;
        try { if (window.manteioEvent) manteioEvent("pliromi-piso:" + String(tool || "").replace(/_q[23]$/, "")); } catch (x) {}
        bg.remove(); res("back"); });
      bg.querySelectorAll("button").forEach(function (b) { b.onclick = function () {
        var c = b.getAttribute("data-p");
        // Μέτρηση: ποιον τρόπο διάλεξαν στο παράθυρο, ή αν γύρισαν πίσω
        try { if (window.manteioEvent) manteioEvent(c === "back" ? "pliromi-piso:" + String(tool || "").replace(/_q[23]$/, "") : "epilogi-pliromis:" + (c === "viva" ? "iris" : "karta")); } catch (e) {}
        bg.remove(); res(c); }; });
    });
  }
  // Μήνυμα αναμονής όσο ανοίγει η σελίδα πληρωμής IRIS της Viva
  function wait(card) {
    var w = document.createElement("div");
    w.style.cssText = "position:fixed;inset:0;z-index:99997;background:rgba(5,4,12,.85);display:flex;align-items:center;justify-content:center;padding:20px";
    w.innerHTML = "<div style='max-width:420px;background:#14122a;border:1px solid #D9B25C;border-radius:16px;padding:22px 18px;text-align:center;color:#F5F1E8;font:15px/1.55 Inter,Arial,sans-serif'>" +
      "<div style='width:34px;height:34px;margin:0 auto 12px;border:3px solid rgba(217,178,92,.3);border-top-color:#D9B25C;border-radius:50%;animation:pcspin 1s linear infinite'></div>" +
      (card
        ? "<b style='color:#D9B25C;font-size:17px'>Ανοίγει η ασφαλής πληρωμή</b><br><span class='pcWaitT'>Συνήθως παίρνει 3 με 5 δευτερόλεπτα. Μην κλείσεις τη σελίδα.</span>" +
          "<div style='margin-top:10px;color:#cfc8b8'>Πληρώνεις με κάρτα, Apple Pay ή Google Pay. Μόλις ολοκληρωθεί η πληρωμή, επιστρέφεις αυτόματα εδώ και η απάντησή σου αρχίζει να γράφεται.</div></div>"
        : "<b style='color:#D9B25C;font-size:17px'>Ανοίγει η ασφαλής πληρωμή IRIS</b><br><span class='pcWaitT'>Συνήθως παίρνει 3 με 5 δευτερόλεπτα. Μην κλείσεις τη σελίδα.</span>" +
          "<div style='margin-top:10px;color:#cfc8b8'>Πληρώνεις από το e-banking ή την εφαρμογή της τράπεζάς σου. Μόλις ολοκληρωθεί η πληρωμή, επιστρέφεις αυτόματα εδώ και η απάντησή σου αρχίζει να γράφεται. Μην κλείσεις τη σελίδα πληρωμής πριν ολοκληρωθεί.</div></div>") +
      "<style>@keyframes pcspin{to{transform:rotate(360deg)}}</style>";
    w.className = "pcWait";
    document.body.appendChild(w);
    // Αν αργήσει, να φαίνεται ότι δεν κόλλησε.
    setTimeout(function () { var t = w.querySelector(".pcWaitT"); if (t && document.body.contains(w)) t.textContent = "Σχεδόν έτοιμο, ανοίγει η σελίδα πληρωμής..."; }, 6000);
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
          return choose(b.tool).then(function (p) {
            // «Πίσω»: η πληρωμή δεν ξεκινά, το κουμπί της σελίδας επανέρχεται και η σελίδα μένει όπως ήταν
            if (p === "back") { restoreBtn(); return new Promise(function () {}); }
            if (p !== "viva") return withWait(of.call(self, u, opts), true);
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
      // Κάρτα χωρίς παράθυρο επιλογής (π.χ. όταν η IRIS δεν είναι ενεργή): δείχνουμε κι εδώ το μήνυμα αναμονής
      if (/create-checkout/.test(url)) return withWait(of.apply(this, arguments), true);
    } catch (e) {}
    return of.apply(this, arguments);
  };
  function withWait(pr, card) {
    var w = wait(card);
    return pr.then(function (r) {
      r.clone().json().then(function (d) { if (!d || !d.url) w.remove(); }).catch(function () { w.remove(); });
      return r;
    }, function (e) { w.remove(); throw e; });
  }
  // Αν γυρίσει πίσω από τη σελίδα πληρωμής με το κουμπί «πίσω», να μη μείνει το μήνυμα στην οθόνη
  window.addEventListener("pageshow", function () { document.querySelectorAll(".pcWait").forEach(function (x) { x.remove(); }); });
  try {
    var payQ = new URLSearchParams(location.search).get("pay");
    if (payQ === "fail" || payQ === "back") {
      // Η πληρωμή απέτυχε (IRIS) ή ακυρώθηκε (κάρτα): ζεστό μήνυμα και κουμπί για νέα προσπάθεια, ώστε να μη χαθεί ο πελάτης.
      var n = function () {
        css();
        try { var u = new URL(location.href); u.searchParams.delete("pay"); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) {}
        try { if (window.manteioEvent) window.manteioEvent("pliromi-den-oloklirothike:" + payQ); } catch (e) {}
        var o = document.createElement("div");
        o.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(5,4,12,.72);display:flex;align-items:center;justify-content:center;padding:16px";
        o.innerHTML = "<div style='max-width:440px;width:100%;background:#15122a;border:1px solid rgba(217,178,92,.55);border-radius:18px;padding:22px 20px;color:#F5F1E8;font:15.5px/1.55 Inter,Arial,sans-serif;text-align:center'>" +
          "<div style='font-family:\"Cormorant Garamond\",Georgia,serif;font-size:25px;color:#D9B25C;margin-bottom:8px'>Η πληρωμή δεν ολοκληρώθηκε</div>" +
          "<div style='margin-bottom:6px'>Δεν έγινε καμία χρέωση. Η απάντησή σου σε περιμένει εδώ.</div>" +
          "<div style='color:#cfc8b8;font-size:14px;margin-bottom:16px'>Μπορείς να δοκιμάσεις ξανά τώρα. Αν η τράπεζα δεν ενέκρινε την πληρωμή, διάλεξε άλλον τρόπο: IRIS αντί για κάρτα, ή μια άλλη κάρτα.</div>" +
          "<button type='button' id='pcRetry' style='display:block;width:100%;padding:14px;border:0;border-radius:24px;background:linear-gradient(135deg,#D9B25C,#8C6420);color:#241A08;font:600 16px Inter,Arial,sans-serif;cursor:pointer;margin-bottom:10px'>Δοκίμασε ξανά</button>" +
          "<button type='button' id='pcLater' style='background:none;border:0;color:#cfc8b8;font:14px Inter,Arial,sans-serif;text-decoration:underline;cursor:pointer'>Όχι τώρα</button></div>";
        document.body.appendChild(o);
        o.querySelector("#pcLater").onclick = function () { o.remove(); };
        o.querySelector("#pcRetry").onclick = function () {
          o.remove();
          try { if (window.manteioEvent) window.manteioEvent("pliromi-xanadokimi:" + payQ); } catch (e) {}
          // Το κουμπί πληρωμής της σελίδας (ανοίγει ξανά το παράθυρο IRIS ή κάρτα).
          var ids = ["unlockBtn", "bBuy", "buyBtn", "payBtn"], b = null;
          for (var i = 0; i < ids.length && !b; i++) { var x = document.getElementById(ids[i]); if (x && x.offsetParent !== null) b = x; }
          if (b) { b.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(function () { b.click(); }, 450); }
        };
      };
      if (document.readyState === "complete") setTimeout(n, 600); else window.addEventListener("load", function () { setTimeout(n, 600); });
    }
  } catch (e) {}
})();
