/* Στο τέλος της πληρωμένης απάντησης: μόνο η πρόσκληση για την επόμενη ερώτηση, από το Μαντείο.
   Οι ήρωες δεν μιλούν πια μέσα στην απάντηση: απαντά πάντα το Μαντείο. */
(function () {
  const G = 'color:#D9B25C';
  const INVITE = {
    q1: 'Αν σου έμεινε απορία, το Μαντείο σού κρατά ακόμα δύο ερωτήσεις: τη δεύτερη μόνο με <b style="' + G + '">12€</b> και την τρίτη ακόμη λιγότερο, μόνο με <b style="' + G + '">8€</b>.',
    q2: 'Αν σου έμεινε κι άλλη απορία, το Μαντείο σού κρατά ακόμα μία ερώτηση, για ακόμη λιγότερα: μόνο <b style="' + G + '">8€</b>.'
  };
  window.manteioHeroIntro = function () {};
  window.manteioHeroClose = function (tool, stage, noQuestions) {
    const inv = !noQuestions && INVITE[stage || 'q1'];
    if (!inv) return null;
    const box = document.createElement('div');
    box.className = 'hero-close';
    box.style.cssText = 'margin:4px auto 20px;padding:16px;border:1px solid rgba(217,178,92,.55);border-radius:14px;background:rgba(217,178,92,.06);text-align:center;max-width:420px;';
    const i = document.createElement('p');
    i.style.cssText = "font-family:'Inter',sans-serif;font-size:14.5px;line-height:1.6;color:var(--paper,#F4EEDF);margin:0;";
    i.innerHTML = inv;
    box.appendChild(i);
    return box;
  };
})();
