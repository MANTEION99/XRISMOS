/* Μικρό μενού στο κάτω μέρος κάθε σελίδας: Όροι, Απόρρητο, Επικοινωνία */
(function () {
  function add() {
    if (document.getElementById("mft")) return;
    var f = document.createElement("div"); f.id = "mft";
    f.style.cssText = "text-align:center;font:12px/1.6 Inter,Arial,sans-serif;color:#8f89a8;padding:22px 12px 26px;opacity:.85";
    var a = "color:#8f89a8;text-decoration:none;margin:0 8px";
    f.innerHTML = '<a style="' + a + '" href="/oroi">Όροι Χρήσης</a>·<a style="' + a + '" href="/aporrito">Πολιτική Απορρήτου</a>·<a style="' + a + '" href="/epikoinonia">Επικοινωνία</a>' +
      '<div style="margin-top:4px">Ασφαλείς πληρωμές μέσω viva.com και Stripe · Μόνο για ενήλικες 18+</div>';
    f.style.width = "100%"; f.style.boxSizing = "border-box"; f.style.flex = "0 0 100%";
    var bs = getComputedStyle(document.body);
    // Σε σελίδες όπου το body είναι flex σε σειρά, το μενού πάει σε δική του γραμμή αντί να μπει δίπλα στην κάρτα
    if (bs.display.indexOf("flex") > -1 && bs.flexDirection.indexOf("row") === 0) document.body.style.flexWrap = "wrap";
    document.body.appendChild(f);
  }
  if (document.body) add(); else document.addEventListener("DOMContentLoaded", add);
})();
