/* Μήνυμα για cookies: το Clarity φορτώνει μόνο αν η επισκέπτρια πατήσει «Αποδέχομαι». */
(function () {
  var KEY = "manteio_cookies", ID = "ydrxibksl6";
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function loadClarity() {
    if (window.__clarityLoaded) return; window.__clarityLoaded = true;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i + "?ref=bwt";
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", ID);
  }
  function banner() {
    var css = document.createElement("style");
    css.textContent =
      "#mcb{position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;max-width:520px;margin:0 auto;background:#14122a;border:1px solid #D9B25C;border-radius:16px;padding:14px 16px;color:#F5F1E8;font:14px/1.5 Inter,Arial,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.55)}" +
      "#mcb p{margin:0 0 12px}#mcb .r{display:flex;gap:10px}" +
      "#mcb button{flex:1;padding:11px 8px;border-radius:22px;font:600 15px Inter,Arial,sans-serif;cursor:pointer;border:1px solid #D9B25C}" +
      "#mcb .y{background:linear-gradient(135deg,#D9B25C,#8C6420);color:#241A08;border:none}#mcb .n{background:transparent;color:#D9B25C}";
    document.head.appendChild(css);
    var d = document.createElement("div"); d.id = "mcb"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Cookies");
    d.innerHTML = "<p>Το Μαντείο χρησιμοποιεί cookies για να βλέπει πώς χρησιμοποιείται η σελίδα και να τη βελτιώνει. Τα δέχεσαι;</p>" +
      "<div class='r'><button class='n' type='button'>Όχι, ευχαριστώ</button><button class='y' type='button'>Αποδέχομαι</button></div>";
    document.body.appendChild(d);
    d.querySelector(".y").onclick = function () { set("yes"); d.remove(); loadClarity(); };
    d.querySelector(".n").onclick = function () { set("no"); d.remove(); };
  }
  var v = get();
  if (v === "yes") loadClarity();
  else if (v !== "no") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", banner); else banner();
  }
})();
