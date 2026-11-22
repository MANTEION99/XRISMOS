/* Ημερομηνία και ώρα γέννησης χωρίς το ημερολόγιο του κινητού.
   Μέρα: λίστα. Μήνας: λίστα με ολόκληρο το όνομα. Έτος: κουτάκι όπου γράφει τα 4 ψηφία με το αριθμητικό πληκτρολόγιο,
   ώστε να μη χρειάζεται κύλισμα δεκάδων χρόνων. Ώρα και λεπτά: λίστες.
   Το αρχικό πεδίο μένει κρυφό με το ίδιο id και την ίδια μορφή (ΕΕΕΕ-ΜΜ-ΗΗ και ΩΩ:ΛΛ), οπότε η υπόλοιπη σελίδα δεν αλλάζει.
   Μετά από αλλαγή της τιμής του κρυφού πεδίου από κώδικα, καλείται window.syncDateFields(). */
(function () {
  const css = `
  .dt-row{ display:flex; gap:6px; }
  .dt-select,.dt-yearin{
    flex:1 1 0; min-width:0; appearance:none; -webkit-appearance:none;
    background:rgba(255,255,255,0.03) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23D9B25C' stroke-width='1.4' fill='none'/%3E%3C/svg%3E") no-repeat right 8px center;
    border:1px solid rgba(217,178,92,0.35); border-radius:9px;
    padding:13px 20px 13px 10px; color:#F4EEDF; font-size:17px; font-family:'Inter',sans-serif;
  }
  .dt-yearin{ background-image:none; padding-right:10px; text-align:center; }
  .dt-yearin::placeholder{ color:rgba(244,238,223,0.55); }
  .dt-select:focus,.dt-yearin:focus{ outline:none; border-color:#D9B25C; }
  .dt-select option{ background:#15122a; color:#F4EEDF; }
  .dt-day{ flex:1.05 1 0; padding-left:8px; padding-right:16px; }
  .dt-month{ flex:1.8 1 0; }
  .dt-yearin{ flex:1.2 1 0; }
  .dt-time .dt-select{ max-width:130px; }
  .dt-hint{ font-size:12.5px; color:#e9a3a3; margin-top:5px; min-height:0; }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const MONTHS = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];
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
    // Μόνο ενήλικες: για όποιον ρωτά (dob1 ή dob), και για το άλλο πρόσωπο στα εργαλεία της αγάπης.
    const adult = ((input.id === 'dob1' || input.id === 'dob') && document.body.dataset.child !== '1') || (input.id === 'dob2' && document.body.dataset.adult2 === '1');
    const maxYear = adult ? thisYear - 18 : thisYear;
    const d = makeSelect('Μέρα', Array.from({ length: 31 }, (_, i) => [pad(i + 1), String(i + 1)]), 'dt-day');
    const m = makeSelect('Μήνας', MONTHS.map((x, i) => [pad(i + 1), x]), 'dt-month');
    const y = document.createElement('input');
    y.className = 'dt-yearin'; y.type = 'text'; y.inputMode = 'numeric'; y.pattern = '[0-9]*';
    y.maxLength = 4; y.placeholder = 'Έτος'; y.autocomplete = 'bday-year';
    y.setAttribute('aria-label', 'Έτος γέννησης, 4 ψηφία');
    const row = document.createElement('div'); row.className = 'dt-row'; row.append(d, m, y);
    const hint = document.createElement('div'); hint.className = 'dt-hint';
    const write = () => {
      y.value = y.value.replace(/\D/g, '').slice(0, 4);
      const yr = +y.value; const okY = y.value.length === 4 && yr >= 1920 && yr <= maxYear;
      hint.textContent = (y.value.length === 4 && !okY) ? (yr > maxYear && adult ? 'Το Μαντείο απευθύνεται μόνο σε ενήλικες. ' : '') + `Γράψε το έτος με 4 ψηφία, από 1920 έως ${maxYear}.` : '';
      if (d.value && m.value && okY) {
        const last = new Date(yr, +m.value, 0).getDate();
        if (+d.value > last) d.value = pad(last);
        input.value = `${y.value}-${m.value}-${d.value}`;
      } else input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    [d, m].forEach(s => s.addEventListener('change', write));
    y.addEventListener('input', write);
    y.addEventListener('blur', () => {
      if (y.value && y.value.length < 4) hint.textContent = 'Γράψε το έτος ολόκληρο, με 4 ψηφία, π.χ. 1975.';
    });
    row.dtCheck = () => {
      const started = d.value || m.value || y.value;
      const req = input.id === 'dob1' || input.id === 'dob';
      if (input.value || (!started && !req)) return '';
      if (!d.value) return 'Διάλεξε τη μέρα γέννησης.';
      if (!m.value) return 'Διάλεξε τον μήνα γέννησης.';
      if (y.value.length < 4) return 'Γράψε το έτος γέννησης ολόκληρο, με 4 ψηφία, π.χ. 1975.';
      return hint.textContent || 'Έλεγξε την ημερομηνία γέννησης.';
    };
    // Όταν διαλέξει μήνα, πάει κατευθείαν στο έτος να το γράψει.
    m.addEventListener('change', () => { if (m.value && !y.value) setTimeout(() => y.focus(), 50); });
    const read = () => {
      const v = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.value || '');
      y.value = v ? v[1] : ''; m.value = v ? v[2] : ''; d.value = v ? v[3] : '';
    };
    input.type = 'hidden'; input.removeAttribute('required');
    input.insertAdjacentElement('afterend', row);
    row.insertAdjacentElement('afterend', hint);
    read(); syncers.push(read);
  }

  function upgradeTime(input) {
    const h = makeSelect('Ώρα', Array.from({ length: 24 }, (_, i) => [pad(i), pad(i)]), 'dt-hour');
    const mi = makeSelect('Λεπτά', Array.from({ length: 60 }, (_, i) => [pad(i), pad(i)]), 'dt-min');
    const row = document.createElement('div'); row.className = 'dt-row dt-time'; row.append(h, mi);
    const write = () => {
      if (h.value && !mi.value) mi.value = '00';
      input.value = h.value ? `${h.value}:${mi.value || '00'}` : '';
      input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    [h, mi].forEach(s => s.addEventListener('change', write));
    const read = () => {
      const v = /^(\d{2}):(\d{2})$/.exec(input.value || '');
      h.value = v ? v[1] : ''; mi.value = v ? v[2] : '';
    };
    input.type = 'hidden'; input.removeAttribute('required');
    input.insertAdjacentElement('afterend', row);
    read(); syncers.push(read);
  }

  document.querySelectorAll('input[type="date"]').forEach(upgradeDate);
  document.querySelectorAll('input[type="time"]').forEach(upgradeTime);
  window.syncDateFields = () => syncers.forEach(f => f());
  // Αν η σελίδα δείξει γενικό μήνυμα λάθους ενώ λείπει κάτι από την ημερομηνία, λέμε ακριβώς τι λείπει
  // και φωτίζουμε τη γραμμή, ώστε να μη νομίζει ότι φταίνε τα ονόματα.
  window.addEventListener('load', () => {
    const orig = window.showError;
    if (typeof orig !== 'function') return;
    window.showError = function (t) {
      const rows = [...document.querySelectorAll('.dt-row')].filter(r => r.dtCheck && r.offsetParent);
      for (const r of rows) {
        const msg = r.dtCheck();
        if (msg) {
          r.style.outline = '2px solid #e9a3a3'; r.style.borderRadius = '10px';
          setTimeout(() => { r.style.outline = ''; }, 4000);
          r.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return orig.call(this, msg);
        }
      }
      return orig.apply(this, arguments);
    };
  });
})();
