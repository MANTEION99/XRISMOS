/* Ο ήρωας κάθε υπηρεσίας: μία πρόταση συστάσεων στην αρχή της πληρωμένης απάντησης
   και κλείσιμο στο τέλος (φράση, πρόσκληση για την επόμενη ερώτηση, υπογραφή). */
(function () {
  const H = {
    oikonomika: {
      intro: 'Είμαι ο Μίδας. Ό,τι άγγιζα γινόταν χρυσάφι, κι έμαθα με τον δύσκολο τρόπο τι αξίζει πραγματικά.',
      close: 'Να θυμάσαι: το χρυσάφι δεν έρχεται σε όποιον το κυνηγά, έρχεται σε όποιον είναι έτοιμος να το δεχτεί.',
      sig: 'Ο Μίδας, φύλακας του χρησμού της αφθονίας' },
    epistrofi: {
      intro: 'Είμαι η Πηνελόπη. Περίμενα είκοσι χρόνια και ξέρω να διακρίνω ποιος γυρίζει.',
      close: 'Ό,τι κι αν γίνει, θυμήσου: εγώ δεν περίμενα με άδεια χέρια. Ύφαινα τη ζωή μου.',
      sig: 'Η Πηνελόπη, φύλακας του χρησμού της επιστροφής' },
    erotima: {
      intro: 'Είμαι η Πυθία των Δελφών. Βασιλιάδες ανέβαιναν ως εμένα για μια απάντηση. Σήμερα ανέβηκες εσύ.',
      close: 'Η απάντηση που ζητούσες ήταν ήδη μέσα σου. Εγώ απλώς τη φώτισα.',
      sig: 'Η Πυθία, φύλακας του χρησμού σου' },
    agapi: {
      intro: 'Είμαι η Αφροδίτη. Ξέρω κάθε σκέψη που περνά από μια καρδιά που αγαπά, ακόμα κι αν δεν λέγεται.',
      close: 'Μια σκέψη που δεν ειπώθηκε δεν παύει να υπάρχει. Κι εσύ αξίζεις να σε σκέφτονται χωρίς να το ζητάς.',
      sig: 'Η Αφροδίτη, φύλακας του χρησμού της αγάπης' },
    alitheia: {
      intro: 'Είμαι η Κασσάνδρα. Έβλεπα την αλήθεια πριν τη δουν οι άλλοι, ακόμα κι όταν κανείς δεν ήθελε να την ακούσει.',
      close: 'Η αλήθεια πονά μία φορά. Το ψέμα πονά κάθε μέρα.',
      sig: 'Η Κασσάνδρα, φύλακας του χρησμού της αλήθειας' },
    symvatotita: {
      intro: 'Είμαι η Ψυχή. Ο Έρωτας με διάλεξε, κι εγώ πέρασα κάθε δοκιμασία για να μείνουμε μαζί.',
      close: 'Δύο χάρτες που ταιριάζουν είναι δώρο. Δύο άνθρωποι που διαλέγουν ο ένας τον άλλον κάθε μέρα είναι θαύμα.',
      sig: 'Η Ψυχή, φύλακας του χρησμού της σύνδεσης' },
    taro: {
      intro: 'Είμαι η Εκάτη, η θεά των σταυροδρομιών. Κρατώ το φως εκεί που οι δρόμοι χωρίζουν.',
      close: 'Τα χαρτιά δείχνουν τον δρόμο. Το βήμα το κάνεις εσύ.',
      sig: 'Η Εκάτη, φύλακας του χρησμού του ταρό' },
    numerology: {
      intro: 'Είμαι ο Πυθαγόρας. Πίστευα ότι τα πάντα είναι αριθμοί, και οι δικοί σου αριθμοί έχουν κάτι να σου πουν.',
      close: 'Οι αριθμοί σου δεν αλλάζουν. Αλλάζει μόνο το πόσο καλά τους καταλαβαίνεις.',
      sig: 'Ο Πυθαγόρας, φύλακας του χρησμού των αριθμών' },
    xartis: {
      intro: 'Είμαι η Ουρανία, η Μούσα των άστρων. Τη στιγμή που γεννήθηκες, κοίταξα τον ουρανό και κράτησα τη θέση κάθε πλανήτη.',
      close: 'Ο ουρανός δεν ξαναστάθηκε ποτέ όπως τη μέρα που γεννήθηκες. Αυτός ο χάρτης είναι μόνο δικός σου.',
      sig: 'Η Ουρανία, φύλακας του γενέθλιου χάρτη σου' },
    paidi: {
      intro: 'Είμαι η Λητώ, μητέρα του Απόλλωνα και της Άρτεμης. Ξέρω τι σημαίνει να κοιτάς ένα παιδί και να αναρωτιέσαι τι θα γίνει.',
      close: 'Τα άστρα δείχνουν τον δρόμο του. Την αγάπη που θα το συνοδεύει, τη δίνεις εσύ.',
      sig: 'Η Λητώ, φύλακας του χάρτη του παιδιού σου' }
  };
  H.xartis_plus = H.xartis;
  const G = 'color:#D9B25C';
  const INVITE = {
    q1: 'Αν σου έμεινε απορία, σου κρατώ ακόμα δύο ερωτήσεις: τη δεύτερη μόνο με <b style="' + G + '">12€</b> και την τρίτη ακόμη λιγότερο, μόνο με <b style="' + G + '">8€</b>.',
    q2: 'Αν σου έμεινε κι άλλη απορία, σου κρατώ ακόμα μία ερώτηση, για ακόμη λιγότερα: μόνο <b style="' + G + '">8€</b>.'
  };

  window.manteioHeroIntro = function (tool, stage) {
    const h = H[tool], el = document.getElementById('heroIntro');
    if (!h || !el || (stage && stage !== 'q1') || el.dataset.on) return;
    el.textContent = h.intro;
    el.style.display = 'block';
    el.dataset.on = '1';
  };

  window.manteioHeroClose = function (tool, stage, noQuestions) {
    const h = H[tool];
    if (!h) return null;
    const box = document.createElement('div');
    box.className = 'hero-close';
    box.style.cssText = 'margin:4px auto 20px;padding:18px 16px;border:1px solid rgba(217,178,92,.55);border-radius:14px;background:rgba(217,178,92,.06);text-align:center;max-width:420px;';
    const p = document.createElement('p');
    p.style.cssText = "font-family:'Cormorant Garamond',serif;font-style:italic;font-size:20px;line-height:1.45;color:var(--paper,#F4EEDF);margin:0 0 12px;";
    p.textContent = h.close;
    box.appendChild(p);
    const inv = !noQuestions && INVITE[stage || 'q1'];
    if (inv) {
      const i = document.createElement('p');
      i.style.cssText = "font-family:'Inter',sans-serif;font-size:14.5px;line-height:1.6;color:var(--paper,#F4EEDF);margin:0 0 12px;";
      i.innerHTML = inv;
      box.appendChild(i);
    }
    const s = document.createElement('p');
    s.style.cssText = "font-family:'Cormorant Garamond',serif;font-size:16px;letter-spacing:.5px;color:#D9B25C;margin:0;";
    s.textContent = h.sig;
    box.appendChild(s);
    return box;
  };
})();
