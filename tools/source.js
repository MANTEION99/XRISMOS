/* Από ποιο post ήρθε η επισκέπτρια. Τα σύντομα links (manteio.live/r/ΚΩΔΙΚΟΣ) φέρνουν ?utm_campaign=ΚΩΔΙΚΟΣ.
   Κρατάμε τον τελευταίο κωδικό για 14 μέρες, ώστε να μετρά και όταν γυρίσει αργότερα να πληρώσει.
   window.manteioSource() δίνει τον κωδικό (ή κενό), και στέλνεται μαζί με τον δωρεάν χρησμό και την πληρωμή. */
(function () {
  const KEY = 'manteio_src';
  const DAYS = 14;
  try {
    const q = new URLSearchParams(location.search);
    const c = (q.get('utm_campaign') || '').trim();
    if (c) {
      const parts = [q.get('utm_source'), q.get('utm_medium'), c].filter(Boolean);
      localStorage.setItem(KEY, JSON.stringify({ src: parts.join('/').slice(0, 80), ts: Date.now() }));
    }
  } catch (e) {}
  window.manteioSource = function () {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && v.src && Date.now() - v.ts < DAYS * 86400000) return v.src;
    } catch (e) {}
    return '';
  };
})();
