/* Κοινή λογική σελίδας για τα εργαλεία του κοινού μηχανισμού.
   Η σελίδα κάθε εργαλείου ορίζει πριν από αυτό το script το αντικείμενο CFG (δες build-oracle-pages.py).
   Ροή: δωρεάν άνοιγμα με email, σφραγισμένη συνέχεια, πληρωμή (δέσμευση), χρησμός που γράφεται
   στο παρασκήνιο και εμφανίζεται σαν πληκτρολόγηση, 2η και 3η ερώτηση με τον ίδιο τρόπο. */

const TOOL = CFG.tool;
const KEY = (k) => `manteio_${TOOL}_${k}`;
const STORAGE_KEY = KEY('fields');
const TEASER_KEY = KEY('teaser');
const ENTERED_KEY = KEY('entered');
const EMAIL_KEY = 'manteio_email';
const ERR_MARK = '<<<ΣΦΑΛΜΑ>>>';
const FIELD_IDS = ['name1', 'dob1', 'tob1', 'pob1', 'name2', 'dob2', 'tob2', 'pob2', 'question'];
const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session_id');
const readingIdParam = params.get('rid');
const PREVIEW = location.hostname.includes('deploy-preview');

const $ = (id) => document.getElementById(id);
const cover = $('cover'), card = $('card');
const form = $('form'), btn = $('btn'), err = $('err');
const loading = $('loading'), result = $('result');
const teaserText = $('teaserText'), infoLine = $('infoLine'), seal = $('seal');
const fullWrap = $('fullWrap'), pctnum = $('pctnum'), readingtext = $('readingtext');
const adviceWrap = $('adviceWrap'), adviceText = $('adviceText');

let savedFields = null;
try { savedFields = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) {}
let currentReadingId = null;
let currentData = {};

const nameCase = (s) => String(s || '').replace(/(^|\s)(\S)/g, (m, sp, c) => sp + c.toLocaleUpperCase('el'));
function showCard() { cover.style.display = 'none'; card.classList.add('show'); }
function showError(t) { err.textContent = t; err.style.display = 'block'; }
function saveTeaserState(rid, text, info, data) {
  try { localStorage.setItem(TEASER_KEY, JSON.stringify({ rid, text, info, data, ts: Date.now() })); } catch (e) {}
}
function clearTeaserState() {
  try { localStorage.removeItem(TEASER_KEY); localStorage.removeItem(ENTERED_KEY); } catch (e) {}
}
function fillSavedFields() {
  if (!savedFields) return;
  FIELD_IDS.forEach(k => { if ($(k) && savedFields[k]) $(k).value = savedFields[k]; });
}
function readFields() {
  const v = (id) => ($(id) ? $(id).value.trim() : '');
  const f = {};
  FIELD_IDS.forEach(k => { f[k] = v(k); });
  return f;
}

/* ---------- Χαρτιά ταρώ και αριθμοί ---------- */

const SLOT_LABELS = ['ΠΑΡΕΛΘΟΝ', 'ΠΑΡΟΝ', 'ΜΕΛΛΟΝ'];
function renderCards(cards, revealAll) {
  const box = $('spread');
  if (!box || !Array.isArray(cards) || cards.length !== 3) return;
  box.innerHTML = '';
  box.style.display = 'flex';
  cards.forEach((c, i) => {
    const open = revealAll || i === 0;
    const div = document.createElement('div');
    div.className = 'spread-card' + (open ? '' : ' closed');
    div.innerHTML = `<div class="slot-label">${SLOT_LABELS[i]}</div>
      <div class="frame">${open ? `<img src="tarot-cards/${c.file}" class="${c.reversed ? 'reversed' : ''}" alt="">` : '<div class="card-back"><span>Μ</span></div>'}</div>
      <div class="card-name"></div><div class="orientation"></div>`;
    if (open) {
      div.querySelector('img').alt = c.name;
      div.querySelector('.card-name').textContent = c.name;
      div.querySelector('.orientation').textContent = c.reversed ? 'Ανάστροφο' : 'Όρθιο';
    } else {
      div.querySelector('.card-name').textContent = 'Σφραγισμένο';
    }
    box.appendChild(div);
  });
}
function renderNumbers(n, revealAll) {
  const box = $('numbers');
  if (!box || !n) return;
  box.style.display = 'flex';
  const items = [['ΑΡΙΘΜΟΣ ΖΩΗΣ', n.lifePath, true], ['ΑΡΙΘΜΟΣ ΟΝΟΜΑΤΟΣ', n.nameNumber, revealAll], ['ΑΡΙΘΜΟΣ ΨΥΧΗΣ', n.soulNumber, revealAll], ['ΠΡΟΣΩΠΙΚΟ ΕΤΟΣ ' + n.year, n.personalYear, revealAll]];
  box.innerHTML = items.map(([label, val, open]) =>
    `<div class="number-block${open ? '' : ' closed'}"><div class="num">${open ? val : '?'}</div><div class="num-label">${label}</div></div>`).join('');
}
function renderData(data, revealAll) {
  if (!data) return;
  currentData = data;
  if (data.cards) renderCards(data.cards, revealAll);
  if (data.numbers) renderNumbers(data.numbers, revealAll);
}

/* ---------- Streaming και κείμενο ---------- */

async function readStream(response, onText) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let all = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    all += decoder.decode(value, { stream: true });
    onText(all);
  }
  all += decoder.decode();
  onText(all);
  return all;
}

function renderContinuation(cont, finished) {
  let text = cont.replace(ERR_MARK, '');
  let pct = null;
  const m = text.match(/^\s*\[ΠΟΣΟΣΤΟ:\s*(\d+)\]\s*/);
  if (m) { pct = m[1]; text = text.slice(m[0].length); }
  else if (/^\s*\[/.test(text) && !text.includes(']')) { text = ''; }
  if (pct && CFG.pctLabel) { stopRitual(); revealPercent(pct); }
  if (text.trim()) stopRitual();
  const parts = text.split(/\[?\s*ΣΥΜΒΟΥΛΗ\s*\]?\s*:?/);
  readingtext.textContent = parts[0].trim();
  if (parts[1] !== undefined) {
    adviceWrap.style.display = 'block';
    adviceText.textContent = parts[1].trim();
    readingtext.classList.remove('typing');
    adviceText.classList.toggle('typing', !finished);
  } else {
    readingtext.classList.toggle('typing', !finished);
  }
}

/* Γραφή με ανθρώπινο ρυθμό: σταθερός ρυθμός, μικρές παύσεις στα σημεία στίξης. */
function makeTyper(render) {
  let target = '', shown = 0, finished = false, timer = null, pauseUntil = 0, doneCbs = [];
  const skip = (t, i) => {
    const m = t.slice(i).match(/^\s*\[ΠΟΣΟΣΤΟ:\s*\d+\]\s*/);
    return m ? i + m[0].length : i;
  };
  const tick = () => {
    const now = Date.now();
    if (now < pauseUntil) return;
    const backlog = target.length - shown;
    if (backlog <= 0) {
      if (finished) { clearInterval(timer); timer = null; render(target, true); doneCbs.splice(0).forEach(f => f()); }
      return;
    }
    const cps = backlog > 2500 ? 220 : backlog > 1200 ? 110 : backlog > 500 ? 60 : 32;
    const n = Math.max(1, Math.round(cps * 0.04));
    shown = skip(target, shown);
    shown = Math.min(target.length, shown + n);
    const ch = target[shown - 1];
    if (backlog < 1200) {
      if (/[.!;?]/.test(ch)) pauseUntil = now + 320;
      else if (/[,·:]/.test(ch)) pauseUntil = now + 120;
    }
    render(target.slice(0, shown), false);
  };
  return {
    set(t, isFinished) {
      target = t; finished = !!isFinished;
      if (shown > target.length) shown = target.length;
      if (!timer) timer = setInterval(tick, 40);
    },
    instant(t) { target = t; shown = t.length; finished = true; render(t, true); doneCbs.splice(0).forEach(f => f()); },
    busy() { return shown < target.length; },
    whenDone() { return new Promise(r => { if (finished && shown >= target.length && !timer) r(); else doneCbs.push(r); }); }
  };
}

/* ---------- Τελετουργία αναμονής ---------- */

function ritualHTML() {
  let ticks = '', stars = '';
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, x1 = 75 + 62 * Math.cos(a), y1 = 75 + 62 * Math.sin(a), x2 = 75 + 70 * Math.cos(a), y2 = 75 + 70 * Math.sin(a);
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#d9b45f" stroke-width="1.2" opacity="0.8"/>`;
    const b = a + Math.PI / 12, r = 50 + (i % 3) * 5;
    stars += `<circle class="ritual-star" style="animation-delay:${(i * 0.37).toFixed(2)}s" cx="${(75 + r * Math.cos(b)).toFixed(1)}" cy="${(75 + r * Math.sin(b)).toFixed(1)}" r="${i % 4 === 0 ? 1.8 : 1.1}" fill="#f3d98b"/>`;
  }
  return `<div class="ritual">
    <div class="ritual-orb">
      <svg viewBox="0 0 150 150" aria-hidden="true"><g class="ritual-ring">
        <circle cx="75" cy="75" r="70" fill="none" stroke="#d9b45f" stroke-width="0.8" opacity="0.7"/>
        <circle cx="75" cy="75" r="62" fill="none" stroke="#d9b45f" stroke-width="0.5" opacity="0.5"/>${ticks}</g></svg>
      <svg viewBox="0 0 150 150" aria-hidden="true"><g class="ritual-ring2">
        <circle cx="75" cy="75" r="40" fill="none" stroke="#d9b45f" stroke-width="0.6" stroke-dasharray="2 6" opacity="0.8"/>${stars}</g></svg>
      <div class="ritual-core">Μ</div>
    </div>
    <p class="ritual-line"></p>
  </div>`;
}
let ritualTimer = null, ritualBox = null;
function startRitual(container, lines) {
  stopRitual();
  container.innerHTML = ritualHTML();
  container.style.display = 'block';
  const line = container.querySelector('.ritual-line');
  let i = 0;
  const show = () => {
    line.style.opacity = 0;
    setTimeout(() => { line.textContent = lines[i % lines.length]; line.style.opacity = 1; i++; }, 700);
  };
  show();
  ritualTimer = setInterval(show, 3600);
  ritualBox = container;
}
function stopRitual() {
  if (!ritualTimer) return;
  const c = ritualBox;
  clearInterval(ritualTimer);
  ritualTimer = null; ritualBox = null;
  if (c) { c.style.display = 'none'; c.innerHTML = ''; }
}
function firstName() {
  const f = readFields();
  return nameCase((f.name1 || (savedFields && savedFields.name1) || '').split(' ')[0]);
}
function withName(lines) {
  const n = firstName();
  return lines.map(l => l.replace('{name}', n ? ', ' + n : ''));
}

function addWaitProgress(container, steps) {
  const box = container.querySelector('.ritual');
  if (!box) return { finish() {} };
  box.insertAdjacentHTML('beforeend',
    '<div class="wait-bar"><span></span></div>' +
    '<ul class="wait-steps">' + steps.map(t => '<li><span class="dot"></span><span>' + t + '</span></li>').join('') + '</ul>' +
    '<p class="wait-note">Συνήθως χρειάζεται 1 με 2 λεπτά. Μείνε σε αυτή τη σελίδα. Κι αν την κλείσεις, ο χρησμός σου θα σε περιμένει εδώ, χωρίς νέα χρέωση.</p>');
  const bar = box.querySelector('.wait-bar span');
  const lis = box.querySelectorAll('.wait-steps li');
  const note = box.querySelector('.wait-note');
  const t0 = Date.now();
  const setStep = (k) => lis.forEach((li, i) => {
    li.className = i < k ? 'done' : (i === k ? 'active' : '');
    li.querySelector('.dot').textContent = i < k ? '✓' : '';
  });
  const tick = () => {
    if (!box.isConnected) return clearInterval(timer);
    const t = (Date.now() - t0) / 1000;
    setStep(t < 5 ? 1 : (t < 14 ? 2 : 3));
    bar.style.width = Math.min(92, 100 * (1 - Math.exp(-t / 55))) + '%';
    if (t > 150 && !note.dataset.long) {
      note.dataset.long = '1';
      note.textContent = 'Παίρνει λίγο περισσότερο από το συνηθισμένο, αλλά προχωρά κανονικά. Ο χρησμός σου θα εμφανιστεί εδώ μόλις ολοκληρωθεί.';
    }
  };
  tick();
  const timer = setInterval(tick, 1000);
  return { finish() { clearInterval(timer); bar.style.width = '100%'; setStep(steps.length); } };
}

function revealPercent(target) {
  const pctWrap = $('pctWrap');
  if (!pctWrap || pctWrap.dataset.done) return;
  pctWrap.dataset.done = '1';
  pctWrap.style.display = 'block';
  const n = parseInt(target, 10) || 0, start = performance.now(), dur = 1800;
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur), eased = 1 - Math.pow(1 - k, 3);
    pctnum.textContent = Math.round(n * eased) + '%';
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- 1. Δωρεάν άνοιγμα ---------- */

function restoreTeaser() {
  let st = null;
  try { st = JSON.parse(localStorage.getItem(TEASER_KEY) || 'null'); } catch (e) {}
  if (!st || !st.rid || Date.now() - st.ts > 7 * 86400000) return false;
  currentReadingId = st.rid;
  showCard();
  form.style.display = 'none';
  result.classList.add('show');
  renderData(st.data, false);
  teaserText.textContent = st.text || '';
  if (!st.text) teaserText.style.display = 'none';
  if (st.info) { infoLine.textContent = st.info; infoLine.style.display = 'block'; }
  seal.classList.add('show');
  $('restartLink').style.display = 'block';
  return true;
}

$('enterBtn').addEventListener('click', () => {
  showCard();
  fillSavedFields();
  try { const em = localStorage.getItem(EMAIL_KEY); if (em) $('email').value = em; } catch (e) {}
  try { localStorage.setItem(ENTERED_KEY, '1'); } catch (e) {}
});
FIELD_IDS.forEach(k => {
  const el = $(k);
  if (el) el.addEventListener('input', () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(readFields())); } catch (e) {} });
});
$('email').addEventListener('input', () => { try { localStorage.setItem(EMAIL_KEY, $('email').value); } catch (e) {} });

function validate(f) {
  if (!f.name1) return 'Γράψε ' + (CFG.kind === 'numerology' ? 'το ονοματεπώνυμό σου.' : 'το όνομά σου.');
  if (CFG.kind !== 'taro' && !f.dob1) return 'Γράψε την ημερομηνία γέννησής σου.';
  if (CFG.kind === 'astro2' && !f.name2) return 'Γράψε και το όνομα του άλλου προσώπου.';
  if (CFG.needDob2 && !f.dob2) return 'Χρειάζεται και η ημερομηνία γέννησης του άλλου προσώπου.';
  if (CFG.needQuestion && f.question.length < 3) return 'Γράψε την ερώτησή σου.';
  return '';
}

async function startCheckout(buttonEl, readingId, tool, stage) {
  const original = buttonEl.textContent;
  buttonEl.textContent = 'Μεταφορά στην ασφαλή πληρωμή...';
  buttonEl.style.pointerEvents = 'none';
  try {
    const returnUrl = window.location.origin + window.location.pathname + '?rid=' + encodeURIComponent(readingId) + (stage ? '&stage=' + stage : '');
    const res = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, reading_id: readingId, returnUrl })
    });
    const data = await res.json();
    if (!data.url) throw new Error('no url');
    window.location.href = data.url;
  } catch (e) {
    buttonEl.textContent = original;
    buttonEl.style.pointerEvents = 'auto';
    infoLine.textContent = 'Κάτι πήγε στραβά με την πληρωμή, δοκίμασε ξανά.';
    infoLine.style.display = 'block';
  }
}

$('unlockBtn').addEventListener('click', () => {
  if (currentReadingId) startCheckout($('unlockBtn'), currentReadingId, TOOL, '');
});

async function submitTeaser() {
  const f = readFields();
  const email = $('email').value.trim();
  const problem = validate(f);
  if (problem) { showError(problem); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showError('Γράψε ένα σωστό email, για να σου κρατήσουμε τον χρησμό.'); return; }
  err.style.display = 'none';
  btn.disabled = true;
  loading.innerHTML = '';
  loading.classList.add('show');
  startRitual(loading, withName(CFG.teaserRitual));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch (e) {}

  try {
    const res = await fetch('/api/oracle-teaser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: TOOL, ...f, email, consent: $('consent').checked })
    });

    if (res.status === 409) {
      const data = await res.json();
      currentReadingId = data.reading_id;
      stopRitual(); loading.classList.remove('show');
      form.style.display = 'none';
      result.classList.add('show');
      renderData(data.data, false);
      infoLine.textContent = 'Το δωρεάν άνοιγμα αυτού του χρησμού δίνεται μία φορά σε κάθε email, και το έχεις ήδη πάρει. Ο πλήρης χρησμός σου είναι έτοιμος να γραφτεί.';
      infoLine.style.display = 'block';
      teaserText.style.display = 'none';
      seal.classList.add('show');
      saveTeaserState(currentReadingId, '', infoLine.textContent, data.data);
      $('restartLink').style.display = 'block';
      return;
    }
    if (!res.ok) {
      let msg = 'Κάτι διακόπηκε στη σύνδεση με τα άστρα. Δοκίμασε ξανά σε λίγο.';
      let raw = '';
      try { raw = await res.text(); const data = JSON.parse(raw); if (data.error) msg = data.error; } catch (e) {}
      if (PREVIEW) msg += ' [' + res.status + ' ' + raw.slice(0, 200) + ']';
      if (res.status === 429) msg = 'Πολλές προσπάθειες μαζί. Περίμενε ένα λεπτό και δοκίμασε ξανά.';
      stopRitual(); loading.classList.remove('show');
      showError(msg);
      btn.disabled = false;
      return;
    }

    currentReadingId = res.headers.get('X-Reading-Id');
    let pub = {};
    try { pub = JSON.parse(decodeURIComponent(escape(atob(res.headers.get('X-Oracle-Data') || 'e30=')))); } catch (e) {}
    form.style.display = 'none';
    teaserText.classList.add('typing');

    const teaserTyper = makeTyper((txt) => {
      if (txt.trim() && !result.classList.contains('show')) {
        stopRitual(); loading.classList.remove('show');
        result.classList.add('show');
        renderData(pub, false);
      }
      teaserText.textContent = txt;
    });
    // Η απάντηση μπορεί να είναι «ανακατεύθυνση» (υγεία, νομικά, απόγνωση, βία, τζόγος): τότε δεν
    // δείχνουμε χρησμό ούτε πληρωμή. Περιμένουμε τους πρώτους χαρακτήρες για να το καταλάβουμε.
    const REDIRECT_RE = /^\s*\[\s*ΑΝΑΚΑΤΕΥΘΥΝΣΗ\s*\]/;
    let redirectMode = null;
    const all = await readStream(res, (t) => {
      const clean = t.replace(ERR_MARK, '');
      if (redirectMode === null) {
        if (clean.trim().length < 18) return;
        redirectMode = REDIRECT_RE.test(clean);
      }
      if (!redirectMode) teaserTyper.set(clean, false);
    });
    if (redirectMode || REDIRECT_RE.test(all)) {
      stopRitual(); loading.classList.remove('show');
      result.classList.remove('show');
      form.style.display = '';
      const msg = all.replace(ERR_MARK, '').replace(REDIRECT_RE, '').trim();
      showError(msg + (CFG.needQuestion ? ' Ο δωρεάν χρησμός σου δεν χρησιμοποιήθηκε: μπορείς να γράψεις μια άλλη ερώτηση.' : ''));
      err.classList.add('redirect-msg');
      if ($('question')) { $('question').value = ''; $('question').focus(); }
      currentReadingId = null;
      return;
    }
    teaserTyper.set(all.replace(ERR_MARK, ''), true);
    await teaserTyper.whenDone();
    stopRitual(); loading.classList.remove('show');
    result.classList.add('show');
    renderData(pub, false);
    teaserText.classList.remove('typing');
    if (all.includes(ERR_MARK)) {
      infoLine.textContent = 'Η σύνδεση διακόπηκε. Μπορείς να δεις ολόκληρο τον χρησμό σου παρακάτω.';
      infoLine.style.display = 'block';
    }
    seal.classList.add('show');
    saveTeaserState(currentReadingId, teaserText.textContent, all.includes(ERR_MARK) ? infoLine.textContent : '', pub);
    $('restartLink').style.display = 'block';
  } catch (e) {
    stopRitual(); loading.classList.remove('show');
    showError('Κάτι διακόπηκε στη σύνδεση με τα άστρα. Δοκίμασε ξανά σε λίγο.' + (PREVIEW ? ' [' + (e && e.message) + ']' : ''));
  } finally {
    btn.disabled = false;
  }
}

/* ---------- 2. Ο πληρωμένος χρησμός ή η απάντηση στην ερώτηση ---------- */

function loadFullReading() {
  showCard();
  form.style.display = 'none';
  $('paidBadge').style.display = 'block';
  result.classList.add('show');
  fullWrap.classList.add('show');
  if ($('pctWrap')) $('pctWrap').style.display = 'none';
  const isQuestionPage = !!params.get('stage');
  startRitual($('ritualFull'), withName(isQuestionPage ? CFG.questionRitual : CFG.fullRitual));
  addWaitProgress($('ritualFull'), isQuestionPage ? CFG.questionSteps : CFG.waitSteps);
  setTimeout(() => { try { $('ritualFull').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }, 700);

  let failures = 0, lastLen = 0, lastGrow = Date.now(), firstPoll = true, typerStarted = false, metaShown = false;
  const fullTyper = makeTyper((txt, fin) => renderContinuation(txt, fin));
  const showMeta = (data) => {
    if (metaShown) return;
    metaShown = true;
    if (data.stage && data.stage !== 'q1') {
      $('cardTitle').textContent = CFG.title + (data.stage === 'q2' ? ', 2η ερώτηση' : ', 3η ερώτηση');
      teaserText.style.display = 'none';
      if (data.question) { $('questionShown').textContent = '«' + data.question + '»'; $('questionHead').style.display = 'block'; }
      renderData(data.data, true);
    } else {
      if (data.teaser) teaserText.textContent = data.teaser; else teaserText.style.display = 'none';
      renderData(data.data, true);
    }
  };
  const fail = (msg) => {
    stopRitual();
    $('pauseNote').style.display = 'none';
    if (!readingtext.textContent.trim()) fullWrap.classList.remove('show');
    infoLine.textContent = msg;
    infoLine.style.display = 'block';
  };
  const poll = async () => {
    let data = null, status = 0;
    try {
      const res = await fetch('/api/oracle-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reading_id: readingIdParam, session_id: sessionId, retry: firstPoll })
      });
      status = res.status;
      data = await res.json();
    } catch (e) { data = null; }

    if (!data || (status !== 200 && status !== 402 && status !== 404)) {
      if (++failures < 40) return setTimeout(poll, 3000);
      return fail('Κάτι διακόπηκε στη σύνδεση. Ανανέωσε τη σελίδα, ο χρησμός σου σε περιμένει χωρίς νέα χρέωση.');
    }
    if (status !== 200) return fail(data.error || 'Δεν βρέθηκε έγκυρη πληρωμή για αυτόν τον χρησμό.');
    failures = 0;
    showMeta(data);

    if (data.status === 'redirect') {
      stopRitual();
      firstPoll = false;
      return showRedirect(data.message, () => { $('ritualFull').style.display = 'block'; startRitual($('ritualFull'), withName(CFG.questionRitual)); setTimeout(poll, 1500); });
    }

    const len = (data.text || '').length;
    if (len !== lastLen) { lastLen = len; lastGrow = Date.now(); $('pauseNote').style.display = 'none'; }
    else if (len > 0 && data.status !== 'done' && Date.now() - lastGrow > 5000 && !fullTyper.busy()) $('pauseNote').style.display = 'block';
    if (data.status === 'done' || fullTyper.busy()) $('pauseNote').style.display = 'none';

    if (data.status === 'done' && firstPoll && !typerStarted) {
      stopRitual();
      fullTyper.instant(data.text);
      renderExtraActions(data);
      return;
    }
    firstPoll = false;
    if (data.text) { typerStarted = true; fullTyper.set(data.text, data.status === 'done'); }

    if (data.status === 'done') {
      await fullTyper.whenDone();
      stopRitual();
      renderExtraActions(data);
      return;
    }
    if (data.status === 'released') {
      return fail('Ζητούμε συγγνώμη, ο χρησμός σου δεν μπόρεσε να γραφτεί αυτή τη φορά. Το ποσό που είχε δεσμευτεί στην κάρτα σου ακυρώθηκε, οπότε δεν χρεώθηκες τίποτα. Μπορείς να ξαναδοκιμάσεις όποτε θέλεις.');
    }
    if (data.status === 'error') {
      return fail('Ο χρησμός σου δεν ολοκληρώθηκε αυτή τη φορά. Ανανέωσε τη σελίδα σε λίγο, θα γραφτεί ξανά χωρίς νέα χρέωση.' + (PREVIEW ? ' [' + (data.detail || '') + ']' : ''));
    }
    setTimeout(poll, 1500);
  };
  poll();
}

// Ερώτηση εκτός ορίων: μήνυμα, νέα ερώτηση με την ίδια πληρωμή, χωρίς χρέωση αν δεν ρωτήσει.
function showRedirect(message, resume) {
  const box = $('extraActions');
  box.innerHTML = '';
  const msg = document.createElement('p');
  msg.className = 'info';
  msg.textContent = (message || '') + ' Μπορείς να γράψεις τώρα μια άλλη ερώτηση με την ίδια πληρωμή. Αν δεν κάνεις άλλη ερώτηση, δεν θα χρεωθείς: το ποσό είναι απλώς δεσμευμένο στην κάρτα σου και αποδεσμεύεται αυτόματα μέσα σε λίγες ημέρες.';
  box.appendChild(msg);
  const q = askBox('Η νέα σου ερώτηση', 'Ρώτα ξανά', async (question, b) => {
    b.textContent = 'Στέλνεται...'; b.style.pointerEvents = 'none';
    try {
      const res = await fetch('/api/oracle-question', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reading_id: readingIdParam, question })
      });
      if (!res.ok) throw new Error(String(res.status));
      box.innerHTML = '';
      $('questionShown').textContent = '«' + question + '»';
      $('questionHead').style.display = 'block';
      readingtext.textContent = '';
      resume();
    } catch (e) {
      b.textContent = 'Δοκίμασε ξανά'; b.style.pointerEvents = 'auto';
    }
  });
  box.appendChild(q);
}

/* ---------- 3. 2η και 3η ερώτηση ---------- */

function askBox(label, buttonText, onAsk) {
  const wrap = document.createElement('div');
  wrap.className = 'ask-box';
  wrap.innerHTML = `<div class="field" style="text-align:left;"><label></label><textarea></textarea>
    <div class="time-note" style="font-size:12px;opacity:0.7;margin-top:6px;line-height:1.4;"></div></div>
    <p class="error" style="display:none;"></p><div class="enter-btn ask-btn"></div>`;
  wrap.querySelector('label').textContent = label;
  wrap.querySelector('textarea').placeholder = CFG.questionPlaceholder;
  wrap.querySelector('.time-note').textContent = CFG.questionHint;
  const b = wrap.querySelector('.ask-btn');
  b.textContent = buttonText;
  b.addEventListener('click', () => {
    const question = wrap.querySelector('textarea').value.trim();
    const e = wrap.querySelector('.error');
    if (question.length < 3) { e.textContent = 'Γράψε την ερώτησή σου.'; e.style.display = 'block'; return; }
    e.style.display = 'none';
    onAsk(question, b);
  });
  return wrap;
}

function renderExtraActions(data) {
  const box = $('extraActions');
  box.innerHTML = '';
  const stage = data.stage || 'q1';
  const nextStage = stage === 'q1' ? 'q2' : (stage === 'q2' ? 'q3' : null);
  if (!nextStage) return;
  const priceLabel = nextStage === 'q2' ? '2,99€' : '1,99€';
  const title = document.createElement('p');
  title.className = 'ask-title';
  title.textContent = nextStage === 'q2' ? 'Θέλεις να ρωτήσεις κάτι ακόμα;' : 'Μια τελευταία ερώτηση;';
  box.appendChild(title);
  const q = askBox(nextStage === 'q2' ? 'Η δεύτερη ερώτησή σου' : 'Η τρίτη ερώτησή σου', `Ρώτα · ${priceLabel}`, async (question, b) => {
    const original = b.textContent;
    b.textContent = 'Μεταφορά στην ασφαλή πληρωμή...'; b.style.pointerEvents = 'none';
    try {
      const res = await fetch('/api/oracle-question', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: readingIdParam, question })
      });
      const d = await res.json();
      if (!res.ok || !d.reading_id) throw new Error(d.error || 'σφάλμα');
      b.textContent = original;
      startCheckout(b, d.reading_id, `${TOOL}_${d.stage}`, d.stage);
    } catch (e) {
      b.textContent = original; b.style.pointerEvents = 'auto';
      const er = box.querySelector('.error');
      er.textContent = 'Κάτι πήγε στραβά, δοκίμασε ξανά.' + (PREVIEW ? ' [' + e.message + ']' : '');
      er.style.display = 'block';
    }
  });
  box.appendChild(q);
  const valueNote = document.createElement('p');
  valueNote.className = 'value-note-q';
  valueNote.textContent = 'Μια τέτοια πρόβλεψη, για κάθε νέα ερώτηση, κοστίζει κανονικά όσο μια νέα συνεδρία. Εδώ, ' + CFG.sameData + ', μόνο ' + priceLabel + '.';
  box.appendChild(valueNote);
}

/* ---------- Ποια εκδοχή της σελίδας δείχνουμε ---------- */

if (sessionId && readingIdParam) {
  loadFullReading();
} else {
  btn.textContent = 'Δες δωρεάν τον χρησμό σου';
  if (!restoreTeaser()) {
    let entered = null;
    try { entered = localStorage.getItem(ENTERED_KEY); } catch (e) {}
    if (entered) {
      showCard();
      fillSavedFields();
      try { const em = localStorage.getItem(EMAIL_KEY); if (em) $('email').value = em; } catch (e) {}
    }
  }
}

$('restartLink').addEventListener('click', () => {
  clearTeaserState();
  window.location.href = window.location.pathname;
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  submitTeaser();
});
