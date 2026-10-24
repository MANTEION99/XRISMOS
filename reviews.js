/* Κριτικές και σχόλια κάτω από τον δωρεάν χρησμό, και φόρμα κριτικής μετά τον πληρωμένο χρησμό.
   Τα σχόλια του Facebook είναι ΠΡΑΓΜΑΤΙΚΑ σχόλια από τη σελίδα (μόνο μικρό όνομα και αρχικό),
   αυτούσια. Οι κριτικές έρχονται μόνο από πελάτισσες με επιβεβαιωμένη αγορά (/api/reviews). */
(function () {
  var FB_COMMENTS = [
    ['Dimitrios A.', 'Ότι γράφει είναι απλά αλήθεια......!!!'],
    ['Olga K.', 'Αλήθεια κ ικανοποίηση ταυτόχρονα!!!'],
    ['Πέτρος Τ.', 'Είμαι Τοξότης και γίνεται όπως το γράφεις'],
    ['Ελένη Ζ.', 'Ακριβώς έτσι είναι, είμαι μια Αιγόκερως!!!!'],
    ['Lume L.', 'Μπράβο Έτσι ακριβώς είναι ο ζυγός Είμαι ζυγός και το ξέρω']
  ];

  var CSS = '' +
    '.proof{margin:26px 0 4px;text-align:left;}' +
    '.proof h3{font-family:"Cormorant Garamond",serif;font-weight:500;font-size:20px;color:var(--gold,#d9b25c);text-align:center;margin:0 0 4px;}' +
    '.proof .proof-sub{font-size:12px;color:var(--muted,#a89f8a);text-align:center;margin:0 0 14px;}' +
    '.proof-strip{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 10px;-webkit-overflow-scrolling:touch;}' +
    '.proof-card{flex:0 0 78%;max-width:300px;scroll-snap-align:start;background:rgba(255,255,255,0.04);border:1px solid rgba(217,178,92,0.3);border-radius:12px;padding:12px 14px;}' +
    '.proof-card .who{font-size:12.5px;color:var(--gold,#d9b25c);font-weight:600;margin-bottom:4px;}' +
    '.proof-card .what{font-family:"Cormorant Garamond",serif;font-size:17px;line-height:1.45;color:var(--paper,#efe8d8);}' +
    '.proof-card .stars{color:#f0c55c;font-size:14px;letter-spacing:1px;}' +
    '.proof-card .tool{font-size:11px;color:var(--muted,#a89f8a);margin-top:6px;}' +
    '.proof .proof-note{font-size:11px;color:var(--muted,#a89f8a);text-align:center;margin:4px 0 0;line-height:1.5;}' +
    '.result:has(#fullWrap.show) #socialProof{display:none;}' +
    '.review-box{margin:26px auto 0;max-width:380px;text-align:center;border-top:1px solid var(--line,rgba(217,178,92,0.35));padding-top:20px;}' +
    '.review-box h3{font-family:"Cormorant Garamond",serif;font-weight:500;font-size:20px;color:var(--gold,#d9b25c);margin:0 0 6px;}' +
    '.review-box p{font-size:13px;color:var(--muted,#a89f8a);margin:0 0 12px;line-height:1.5;}' +
    '.review-stars{display:flex;justify-content:center;gap:6px;margin:0 0 12px;}' +
    '.review-stars button{background:none;border:none;font-size:32px;line-height:1;color:rgba(217,178,92,0.35);cursor:pointer;padding:0 2px;}' +
    '.review-stars button.on{color:#f0c55c;}' +
    '.review-box textarea,.review-box input[type=text]{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.03);border:1px solid var(--line,rgba(217,178,92,0.35));border-radius:10px;color:var(--paper,#efe8d8);padding:10px 12px;font-size:15px;font-family:Inter,sans-serif;margin-bottom:10px;}' +
    '.review-box textarea{min-height:84px;resize:vertical;}' +
    '.review-box label.pub{display:flex;gap:8px;align-items:flex-start;text-align:left;font-size:12.5px;color:var(--muted,#a89f8a);margin:2px 0 14px;line-height:1.45;}' +
    '.review-box .review-msg{font-size:14px;color:var(--paper,#efe8d8);margin-top:10px;}';

  function addCss() {
    if (document.getElementById('reviewsCss')) return;
    var s = document.createElement('style'); s.id = 'reviewsCss'; s.textContent = CSS; document.head.appendChild(s);
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function stars(n) { return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }

  function card(who, what, extra) {
    var c = el('div', 'proof-card');
    c.appendChild(el('div', 'who', who));
    if (extra && extra.rating) c.appendChild(el('div', 'stars', stars(extra.rating)));
    c.appendChild(el('div', 'what', '«' + what + '»'));
    if (extra && extra.tool) c.appendChild(el('div', 'tool', extra.tool + ' · Επιβεβαιωμένη αγορά'));
    return c;
  }

  // Κάτω από τον δωρεάν χρησμό: πρώτα οι κριτικές αγοραστριών (αν υπάρχουν), μετά τα σχόλια του Facebook.
  function renderProof() {
    var box = document.getElementById('socialProof');
    if (!box || box.dataset.done) return;
    box.dataset.done = '1';
    addCss();
    var reviewsWrap = el('div', 'proof');
    box.appendChild(reviewsWrap);
    var fb = el('div', 'proof');
    fb.appendChild(el('h3', null, 'Αυτό γράφουν για το Μαντείο'));
    fb.appendChild(el('p', 'proof-sub', 'Σχόλια κάτω από τις αναρτήσεις μας στο Facebook'));
    var strip = el('div', 'proof-strip');
    FB_COMMENTS.forEach(function (c) { strip.appendChild(card(c[0], c[1])); });
    fb.appendChild(strip);
    fb.appendChild(el('p', 'proof-note', 'Πραγματικά σχόλια από τη σελίδα μας στο Facebook. Φαίνεται μόνο το μικρό όνομα και το αρχικό του επωνύμου.'));
    box.appendChild(fb);

    fetch('/api/reviews').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.count) return;
      reviewsWrap.appendChild(el('h3', null, 'Τι λένε όσες πήραν τον χρησμό τους'));
      reviewsWrap.appendChild(el('p', 'proof-sub', stars(Math.round(d.avg)) + '  ' + String(d.avg).replace('.', ',') + ' από 5 · ' + d.count + (d.count === 1 ? ' κριτική' : ' κριτικές')));
      var s = el('div', 'proof-strip');
      d.items.forEach(function (it) { s.appendChild(card(it.name, it.text || '', { rating: it.rating, tool: it.tool })); });
      reviewsWrap.appendChild(s);
    }).catch(function () {});
  }

  // Μετά τον πληρωμένο χρησμό: φόρμα κριτικής, μία φορά ανά χρησμό.
  window.manteioReviewForm = function (readingId, sessionId) {
    var box = document.getElementById('reviewBox');
    if (!box || !readingId || !sessionId || box.dataset.done) return;
    try { if (localStorage.getItem('manteio_rev_' + readingId)) return; } catch (e) {}
    box.dataset.done = '1';
    addCss();
    var wrap = el('div', 'review-box');
    wrap.appendChild(el('h3', null, 'Σε άγγιξε ο χρησμός σου;'));
    wrap.appendChild(el('p', null, 'Πες μας με δυο λόγια. Η γνώμη σου βοηθά και άλλες να βρουν τον δρόμο τους.'));
    var rating = 0;
    var row = el('div', 'review-stars');
    var btns = [];
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var b = el('button', null, '★'); b.type = 'button'; b.setAttribute('aria-label', n + ' αστέρια');
        b.addEventListener('click', function () { rating = n; btns.forEach(function (x, k) { x.classList.toggle('on', k < n); }); });
        btns.push(b); row.appendChild(b);
      })(i);
    }
    wrap.appendChild(row);
    var ta = el('textarea'); ta.maxLength = 400; ta.placeholder = 'Τι ένιωσες διαβάζοντάς τον;';
    wrap.appendChild(ta);
    var name = el('input'); name.type = 'text'; name.maxLength = 20; name.placeholder = 'Το μικρό σου όνομα';
    wrap.appendChild(name);
    var lab = el('label', 'pub');
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true;
    lab.appendChild(cb);
    lab.appendChild(el('span', null, 'Επιτρέπω να δημοσιευτεί η κριτική μου στη σελίδα, μόνο με το μικρό μου όνομα.'));
    wrap.appendChild(lab);
    var send = el('div', 'enter-btn', 'Στείλε την κριτική σου');
    send.style.padding = '10px 26px'; send.style.fontSize = '14px';
    wrap.appendChild(send);
    var msg = el('p', 'review-msg'); msg.style.display = 'none';
    wrap.appendChild(msg);
    box.appendChild(wrap);

    send.addEventListener('click', function () {
      if (!rating) { msg.textContent = 'Διάλεξε πρώτα πόσα αστέρια του δίνεις.'; msg.style.display = 'block'; return; }
      send.style.pointerEvents = 'none'; send.textContent = 'Αποστολή...';
      fetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reading_id: readingId, session_id: sessionId, rating: rating, text: ta.value, name: name.value, publish: cb.checked })
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); }).then(function (x) {
        if (!x.ok) throw new Error(x.d && x.d.error || 'σφάλμα');
        try { localStorage.setItem('manteio_rev_' + readingId, '1'); } catch (e) {}
        wrap.innerHTML = '';
        wrap.appendChild(el('h3', null, 'Σε ευχαριστούμε μέσα από την καρδιά μας'));
        wrap.appendChild(el('p', null, 'Η κριτική σου έφτασε στο Μαντείο.'));
      }).catch(function (e) {
        send.style.pointerEvents = 'auto'; send.textContent = 'Στείλε την κριτική σου';
        msg.textContent = (e && e.message) || 'Κάτι πήγε στραβά, δοκίμασε ξανά.'; msg.style.display = 'block';
      });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderProof);
  else renderProof();
})();
