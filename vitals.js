/* Αισθητήρας μετακινήσεων σελίδας (CLS) για το Clarity. Δεν αλλάζει τίποτα στη σελίδα.
   Όταν η σελίδα «πηδάει», γράφει στο Clarity ποιο στοιχείο μετακινήθηκε, πόσο και σε ποια φάση,
   ώστε να φαίνεται στα φίλτρα (Custom tags: cls, cls_el, cls_stage). */
(function () {
  if (!('PerformanceObserver' in window)) return;
  var total = 0, worst = 0, worstEl = '', worstStage = '', sent = '';
  function sel(n) {
    if (!n || n.nodeType !== 1) return n && n.nodeName ? n.nodeName : '?';
    var s = n.tagName.toLowerCase();
    if (n.id) return s + '#' + n.id;
    var c = (typeof n.className === 'string' ? n.className : '').trim().split(/\s+/).slice(0, 2).join('.');
    var p = n.parentElement, pid = '';
    while (p && !pid) { if (p.id) pid = '#' + p.id; p = p.parentElement; }
    return (pid ? pid + ' ' : '') + s + (c ? '.' + c : '');
  }
  function stage() {
    var r = document.getElementById('result');
    if (r && r.classList.contains('show')) return 'result';
    var l = document.getElementById('loading');
    if (l && l.classList.contains('show')) return 'loading';
    var cover = document.querySelector('.cover');
    if (cover && cover.offsetParent !== null) return 'cover';
    return 'form';
  }
  function report() {
    if (typeof window.clarity !== 'function' || !worstEl) return;
    var key = total.toFixed(2) + worstEl;
    if (key === sent) return;
    sent = key;
    try {
      window.clarity('set', 'cls', total >= 0.25 ? 'poor' : total >= 0.1 ? 'needs' : 'good');
      window.clarity('set', 'cls_value', total.toFixed(2));
      window.clarity('set', 'cls_el', worstEl.slice(0, 80));
      window.clarity('set', 'cls_stage', worstStage);
    } catch (e) {}
  }
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        if (e.hadRecentInput) return;
        total += e.value;
        if (e.value > worst) {
          worst = e.value;
          var src = (e.sources || []).slice().sort(function (a, b) {
            var ra = a.currentRect, rb = b.currentRect;
            return (rb ? rb.width * rb.height : 0) - (ra ? ra.width * ra.height : 0);
          })[0];
          worstEl = src ? sel(src.node) : '?';
          worstStage = stage() + ' ' + Math.round(performance.now() / 1000) + 's';
        }
      });
      if (total >= 0.1) report();
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') report(); });
})();
