/* Επιβεβαίωση ηλικίας 18+. Εμφανίζεται μία φορά ανά συσκευή. Η απάντηση «ναι» μένει στη συσκευή (manteio_18). */
(function () {
  var KEY = "manteio_18";
  try { if (localStorage.getItem(KEY) === "1") return; } catch (e) {}
  if (navigator.webdriver) return;
  function show() {
    var st = document.createElement("style");
    st.textContent =
      "#mag{position:fixed;inset:0;z-index:100000;background:rgba(5,4,12,.88);display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}" +
      "#mag .bx{max-width:400px;width:100%;background:#14122a;border:1.5px solid #D9B25C;border-radius:18px;padding:26px 22px 22px;text-align:center;color:#F5F1E8;font:16px/1.55 Inter,Arial,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)}" +
      "#mag h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;color:#D9B25C;margin:0 0 8px;font-weight:700}" +
      "#mag p{margin:0 0 18px;color:#d9d3c4}" +
      "#mag button{display:block;width:100%;padding:14px;border-radius:11px;font:700 16px Inter,Arial,sans-serif;cursor:pointer;margin-top:10px}" +
      "#mag .y{background:linear-gradient(135deg,#D9B25C,#B08A3A);color:#241A08;border:none}" +
      "#mag .n{background:transparent;color:#F5F1E8;border:1px solid rgba(217,178,92,.55)}";
    document.head.appendChild(st);
    var o = document.createElement("div");
    o.id = "mag"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
    o.innerHTML = '<div class="bx"><h2>Είσαι άνω των 18;</h2>' +
      '<p>Το Μαντείο απευθύνεται μόνο σε ενήλικες. Πατώντας «Ναι» δηλώνεις ότι είσαι άνω των 18.</p>' +
      '<button class="y" type="button">Ναι, είμαι άνω των 18</button>' +
      '<button class="n" type="button">Όχι, είμαι κάτω από 18</button></div>';
    document.body.appendChild(o);
    document.documentElement.style.overflow = "hidden";
    o.querySelector(".y").onclick = function () {
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
      o.remove(); document.documentElement.style.overflow = "";
    };
    o.querySelector(".n").onclick = function () {
      o.querySelector(".bx").innerHTML = '<h2>Λυπούμαστε</h2><p style="margin:0">Το Μαντείο είναι μόνο για ενήλικες. Σε περιμένουμε όταν κλείσεις τα 18.</p>';
    };
  }
  if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
})();
