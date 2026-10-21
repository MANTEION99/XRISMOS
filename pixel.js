/* Meta Pixel του Μαντείου, με συγκατάθεση cookies (ΕΕ).
   Το Pixel φορτώνει ΜΟΝΟ αφού ο επισκέπτης πατήσει «Αποδοχή». Η επιλογή κρατιέται στη συσκευή.
   Οι σελίδες στέλνουν γεγονότα με window.manteioTrack(όνομα, παράμετροι, eventId). */
(function () {
  var PIXEL_ID = '1662226415478227';
  var KEY = 'manteio_consent';
  var queue = [];
  var loaded = false;

  function getChoice() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setChoice(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function loadPixel() {
    if (loaded) return;
    loaded = true;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
    queue.splice(0).forEach(function (args) { window.fbq.apply(null, args); });
    trackReturnFromPayment();
  }

  // Γεγονός από τη σελίδα. Πριν από την απόφαση περιμένει, αν ο επισκέπτης αρνηθεί δεν στέλνεται ποτέ.
  window.manteioTrack = function (name, params, eventId) {
    var args = ['track', name, params || {}];
    if (eventId) args.push({ eventID: eventId });
    if (loaded) window.fbq.apply(null, args);
    else if (getChoice() !== 'no') queue.push(args);
  };
  window.manteioConsent = function () { return getChoice() === 'yes'; };

  // Επιστροφή από το Stripe με πληρωμή: Purchase μία φορά ανά πληρωμή.
  // Ίδιο eventID με τον server (Conversions API), ώστε το Facebook να μην τη μετρήσει διπλή.
  function trackReturnFromPayment() {
    var p = new URLSearchParams(location.search);
    var sid = p.get('session_id');
    if (!sid || !/^cs_[A-Za-z0-9_]+$/.test(sid)) return;
    var mark = 'manteio_px_' + sid.slice(-24);
    try { if (localStorage.getItem(mark)) return; localStorage.setItem(mark, '1'); } catch (e) {}
    var stage = p.get('stage');
    var value = stage === 'q3' ? 1.99 : (stage === 'q2' ? 2.99 : 4.99);
    window.fbq('track', 'Purchase', { value: value, currency: 'EUR' }, { eventID: 'purchase_' + sid });
  }

  function showBanner() {
    if (document.getElementById('consentBar')) return;
    var bar = document.createElement('div');
    bar.id = 'consentBar';
    bar.setAttribute('role', 'dialog');
    bar.style.cssText = 'position:fixed;left:10px;right:10px;bottom:10px;z-index:9999;max-width:460px;margin:0 auto;' +
      'background:rgba(16,14,30,0.97);border:1px solid rgba(217,178,92,0.6);border-radius:14px;padding:12px 14px;' +
      'box-shadow:0 8px 30px rgba(0,0,0,0.5);font-family:Inter,sans-serif;font-size:12.5px;line-height:1.5;color:#e9e3d3;';
    bar.innerHTML = '<div>Χρησιμοποιούμε cookies για να μετράμε τις επισκέψεις και να βελτιώνουμε τις διαφημίσεις μας στο Facebook.</div>' +
      '<div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end;">' +
      '<button type="button" id="consentNo" style="background:transparent;border:1px solid rgba(217,178,92,0.5);color:#c9bfa6;border-radius:18px;padding:7px 14px;font-size:12.5px;cursor:pointer;">Όχι, ευχαριστώ</button>' +
      '<button type="button" id="consentYes" style="background:#d9b25c;border:1px solid #d9b25c;color:#241a08;border-radius:18px;padding:7px 18px;font-size:12.5px;font-weight:600;cursor:pointer;">Αποδοχή</button>' +
      '</div>';
    document.body.appendChild(bar);
    document.getElementById('consentYes').addEventListener('click', function () { setChoice('yes'); bar.remove(); loadPixel(); });
    document.getElementById('consentNo').addEventListener('click', function () { setChoice('no'); queue = []; bar.remove(); });
  }

  var choice = getChoice();
  if (choice === 'yes') loadPixel();
  else if (!choice) {
    if (document.body) showBanner();
    else document.addEventListener('DOMContentLoaded', showBanner);
  }
})();

// Τα cookies του Facebook (_fbp, _fbc), για να ταιριάζει ο server την πληρωμή με τη διαφήμιση.
window.manteioFbIds = function () {
  var out = {};
  document.cookie.split(';').forEach(function (c) {
    var kv = c.trim().split('=');
    if (kv[0] === '_fbp' || kv[0] === '_fbc') out[kv[0].slice(1)] = decodeURIComponent(kv.slice(1).join('='));
  });
  return out;
};
