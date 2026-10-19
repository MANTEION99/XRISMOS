/* Ημερομηνία και ώρα με απλές λίστες (μέρα, μήνας, έτος / ώρα, λεπτά) αντί για το ημερολόγιο του κινητού.
   Το ημερολόγιο του κινητού κολλάει συχνά μέσα στον browser του Facebook και στα Android, και για ημερομηνία
   γέννησης θέλει δεκάδες χρόνια κύλισμα. Το αρχικό πεδίο μένει κρυφό με το ίδιο id και την ίδια μορφή
   (ΕΕΕΕ-ΜΜ-ΗΗ και ΩΩ:ΛΛ), οπότε η υπόλοιπη σελίδα δεν αλλάζει. Μετά από αλλαγή της τιμής του κρυφού
   πεδίου από κώδικα, καλείται window.syncDateFields(). */
(function () {
  const MONTHS = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγ', 'Σεπτ', 'Οκτ', 'Νοέμ', 'Δεκ'];
  const pad = (n) => String(n).padStart(2, '0');
  const opt = (value, label) => { const o = document.createElement('option'); o.value = value; o.textContent = label; return o; };
  const makeSelect = (placeholder, items, cls) => {
    const s = document.createElement('select');
    s.className = 'dt-select ' + cls;
    s.appendChild(opt('', placeholder));
    items.forEach(([v, l]) => s.appendChild(opt(v, l)));
    return s;
  };
  const syncers = [];

  function upgradeDate(input) {
    const thisYear = new Date().getFullYear();
    const days = Array.from({ length: 31 }, (_, i) => [pad(i + 1), String(i + 1)]);
    const months = MONTHS.map((m, i) => [pad(i + 1), m]);
    const years = Array.from({ length: thisYear - 1920 + 1 }, (_, i) => { const y = thisYear - i; return [String(y), String(y)]; });
    const d = makeSelect('Μέρα', days, 'dt-day');
    const m = makeSelect('Μήνας', months, 'dt-month');
    const y = makeSelect('Έτος', years, 'dt-year');
    const row = document.createElement('div');
    row.className = 'dt-row';
    row.append(d, m, y);
    const write = () => {
      if (d.value && m.value && y.value) {
        // Αν η μέρα δεν υπάρχει σε αυτόν τον μήνα (π.χ. 31 Απριλίου), πάει στην τελευταία του μήνα.
        const last = new Date(+y.value, +m.value, 0).getDate();
        if (+d.value > last) d.value = pad(last);
        input.value = `${y.value}-${m.value}-${d.value}`;
      } else input.value = '';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    [d, m, y].forEach(s => s.addEventListener('change', write));
    const read = () => {
      const v = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.value || '');
      y.value = v ? v[1] : ''; m.value = v ? v[2] : ''; d.value = v ? v[3] : '';
    };
    input.type = 'hidden';
    input.insertAdjacentElement('afterend', row);
    read();
    syncers.push(read);
  }

  function upgradeTime(input) {
    const hours = Array.from({ length: 24 }, (_, i) => [pad(i), pad(i)]);
    const mins = Array.from({ length: 60 }, (_, i) => [pad(i), pad(i)]);
    const h = makeSelect('Ώρα', hours, 'dt-hour');
    const mi = makeSelect('Λεπτά', mins, 'dt-min');
    const row = document.createElement('div');
    row.className = 'dt-row dt-time';
    row.append(h, mi);
    const write = () => {
      // Αν διάλεξε μόνο ώρα, τα λεπτά θεωρούνται 00.
      if (h.value && !mi.value) mi.value = '00';
      input.value = h.value ? `${h.value}:${mi.value || '00'}` : '';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    [h, mi].forEach(s => s.addEventListener('change', write));
    const read = () => {
      const v = /^(\d{2}):(\d{2})$/.exec(input.value || '');
      h.value = v ? v[1] : ''; mi.value = v ? v[2] : '';
    };
    input.type = 'hidden';
    input.insertAdjacentElement('afterend', row);
    read();
    syncers.push(read);
  }

  document.querySelectorAll('input[type="date"]').forEach(upgradeDate);
  document.querySelectorAll('input[type="time"]').forEach(upgradeTime);
  window.syncDateFields = () => syncers.forEach(f => f());
})();
