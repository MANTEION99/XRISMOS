/* Κουμπί βοήθειας κάτω δεξιά: αν κάτι δεν πήγε καλά, μήνυμα στο Μαντείο σε Instagram ή TikTok. */
(function () {
  if (window.__mHelp) return; window.__mHelp = 1;
  var css = "#mhBtn{position:fixed;right:14px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:9000;width:52px;height:52px;border-radius:50%;border:1px solid #D9B25C;background:#14122a;box-shadow:0 4px 14px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}" +
    "#mhBtn svg{width:26px;height:26px}" +
    "#mhPop{position:fixed;right:14px;bottom:calc(78px + env(safe-area-inset-bottom));z-index:9001;width:min(300px,calc(100vw - 28px));box-sizing:border-box;background:#14122a;border:1px solid #D9B25C;border-radius:16px;padding:16px 16px 14px;color:#F5F1E8;font:14px/1.5 Inter,Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.5);display:none}" +
    "#mhPop.on{display:block}#mhPop h4{margin:0 0 6px;font-family:'Cormorant Garamond',Georgia,serif;font-size:21px;font-weight:600;color:#D9B25C}" +
    "#mhPop p{margin:0 0 12px;color:#e9e3d3}#mhX{position:absolute;top:6px;right:8px;background:none;border:0;color:#cfc8b8;font-size:24px;line-height:1;cursor:pointer;padding:4px}" +
    ".mhL{display:flex;gap:8px}.mhL a{flex:1;text-align:center;text-decoration:none;color:#14122a;background:#D9B25C;border-radius:10px;padding:10px 6px;font-weight:600;font-size:14px}" +
    "body.mhHide #mhBtn,body.mhHide #mhPop{display:none!important}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  function build() {
    var b = document.createElement("button"); b.id = "mhBtn"; b.type = "button"; b.setAttribute("aria-label", "Βοήθεια");
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#D9B25C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/><path d="M12 8.2v4.3"/><circle cx="12" cy="15.6" r=".6" fill="#D9B25C"/></svg>';
    var p = document.createElement("div"); p.id = "mhPop"; p.setAttribute("role", "dialog");
    p.innerHTML = '<button id="mhX" type="button" aria-label="Κλείσιμο">&times;</button><h4>Κάτι δεν πήγε καλά;</h4>' +
      '<p>Αν πλήρωσες και δεν είδες την απάντησή σου, ή αντιμετωπίζεις οποιοδήποτε πρόβλημα, στείλε μήνυμα στο Μαντείο και θα το λύσει αμέσως.</p>' +
      '<div class="mhL"><a href="https://ig.me/m/to_manteio" target="_blank" rel="noopener">Instagram</a><a href="https://www.tiktok.com/@zodiac_manteio" target="_blank" rel="noopener">TikTok</a></div>';
    document.body.appendChild(p); document.body.appendChild(b);
    b.onclick = function () { p.classList.toggle("on"); };
    document.getElementById("mhX").onclick = function () { p.classList.remove("on"); };
    // Κρύβεται όσο είναι ανοιχτό το παράθυρο πληρωμής.
    setInterval(function () { document.body.classList.toggle("mhHide", !!document.getElementById("pcBox") || !!(document.getElementById("mcb") && document.getElementById("mcb").offsetParent)); }, 500);
    // Μετά την πληρωμή: αν η απάντηση δεν έχει φανεί σε 2 λεπτά, ανοίγει μία φορά.
    var q = new URLSearchParams(location.search);
    if (q.get("session_id") || q.get("t") || q.get("s")) setTimeout(function () {
      var r = document.getElementById("readingtext");
      if ((!r || !r.textContent.trim()) && !sessionStorage.getItem("mhShown")) { sessionStorage.setItem("mhShown", "1"); p.classList.add("on"); }
    }, 120000);
  }
  if (document.body) build(); else document.addEventListener("DOMContentLoaded", build);
})();
