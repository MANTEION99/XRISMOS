#!/usr/bin/env python3
"""Φτιάχνει τις σελίδες των εργαλείων του κοινού μηχανισμού (Αγάπη, Αλήθεια, Συμβατότητα,
Οικονομικά, Αριθμολογία, Ταρώ) από ένα κοινό πρότυπο.
Τρέξιμο από τη ρίζα του repo:  python3 tools/build-oracle-pages.py
Αλλαγές στην εμφάνιση ή στη λογική γίνονται ΜΟΝΟ στα tools/oracle-base.css, tools/oracle-page.js
και σε αυτό το αρχείο, και μετά ξανατρέχει το script."""

import json, html, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE_CSS = (ROOT / "tools/oracle-base.css").read_text(encoding="utf-8")
PAGE_JS = (ROOT / "tools/oracle-page.js").read_text(encoding="utf-8")
DATE_JS = (ROOT / "tools/date-fields.js").read_text(encoding="utf-8")

EXTRA_CSS = """
  .spread{ display:none; gap:10px; justify-content:center; margin:0 0 22px; flex-wrap:nowrap; }
  .spread-card{ width:min(100px, 27vw); text-align:center; }
  .spread-card .frame{ border:1px solid var(--gold); border-radius:8px; overflow:hidden; aspect-ratio:7/12; margin-bottom:8px; box-shadow:0 8px 20px rgba(0,0,0,0.4); background:#120f22; }
  .spread-card img{ width:100%; height:100%; object-fit:cover; display:block; }
  .spread-card img.reversed{ transform:rotate(180deg); }
  .card-back{ width:100%; height:100%; display:flex; align-items:center; justify-content:center;
    background:repeating-linear-gradient(45deg, rgba(217,178,92,0.10) 0 6px, transparent 6px 12px), radial-gradient(circle at 50% 45%, #2a2147, #120f22 70%); }
  .card-back span{ width:38px; height:38px; border-radius:50%; border:1px solid var(--gold); color:var(--gold); display:flex; align-items:center; justify-content:center; font-family:'Cormorant Garamond',serif; font-size:20px; }
  .spread-card .slot-label{ font-size:10.5px; letter-spacing:1.5px; color:var(--gold); margin-bottom:4px; }
  .spread-card .card-name{ font-family:'Cormorant Garamond',serif; font-size:14px; color:var(--paper); line-height:1.3; }
  .spread-card.closed .card-name{ color:var(--muted); font-style:italic; }
  .spread-card .orientation{ font-size:10px; color:var(--muted); }
  .numbers{ display:none; justify-content:center; gap:14px; flex-wrap:wrap; margin:0 0 22px; }
  .number-block{ text-align:center; min-width:70px; }
  .number-block .num{ font-family:'Cormorant Garamond',serif; font-size:40px; font-weight:600; color:var(--gold); line-height:1; }
  .number-block.closed .num{ color:var(--muted); opacity:0.6; }
  .number-block .num-label{ font-size:9.5px; color:var(--muted); letter-spacing:1px; margin-top:6px; max-width:90px; }
  .question-head{ display:none; text-align:center; margin:0 0 18px; }
  .question-head .ql{ font-size:11.5px; letter-spacing:2px; color:var(--gold); margin-bottom:6px; }
  .question-head .qt{ font-family:'Cormorant Garamond',serif; font-style:italic; font-size:19px; color:var(--paper); line-height:1.4; }
  .ask-title{ font-family:'Cormorant Garamond',serif; font-size:20px; color:var(--gold); margin:6px 0 14px; }
  .ask-box{ max-width:380px; margin:0 auto; }
  .ask-box .enter-btn{ padding:11px 28px; font-size:14px; }
  .seal-blur{ min-height:360px; }
  .safety-note{ font-size:12px; line-height:1.55; color:var(--muted); margin:16px 0 0; padding:10px 12px; border-left:2px solid var(--gold); background:rgba(217,178,92,0.06); border-radius:4px; text-align:left; }
  .result:has(#fullWrap.show) .teaser-note{ display:none; }
  .error.redirect-msg{ color:var(--paper); line-height:1.6; }
  .value-note-q{ font-size:12.5px; line-height:1.55; color:var(--muted); max-width:320px; margin:12px auto 18px; text-align:center; }
"""

NOTE_TIME1 = '<div class="time-note">Αν δεν ξέρεις την ώρα, ο χρησμός θα βγει από τους πλανήτες σου.</div>'
NOTE_TIME2 = '<div class="time-note">Αν δεν την ξέρεις, ο χρησμός θα βγει από τους πλανήτες.</div>'
NOTE_PLACE = '<div class="time-note">Αν γεννήθηκες σε χωριό, γράψε την κοντινότερη πόλη.</div>'

def field(id_, label, typ="text", placeholder="", note=""):
    ph = f' placeholder="{html.escape(placeholder)}"' if placeholder else ""
    if typ == "textarea":
        inp = f'<textarea id="{id_}"{ph}></textarea>'
    else:
        inp = f'<input type="{typ}" id="{id_}"{ph} />'
    return f'      <div class="field">\n        <label for="{id_}">{label}</label>\n        {inp}\n        {note}\n      </div>\n'

def person1(name_label="Το όνομά σου", name_ph="π.χ. Μαρία", with_time=True, with_place=True):
    s = field("name1", name_label, placeholder=name_ph)
    s += field("dob1", "Ημερομηνία γέννησής σου", "date")
    if with_time: s += field("tob1", "Ώρα γέννησής σου (αν την ξέρεις)", "time", note=NOTE_TIME1)
    if with_place: s += field("pob1", "Πόλη γέννησής σου", placeholder="π.χ. Αθήνα", note=NOTE_PLACE)
    return s

def person2(need_dob):
    s = '      <div class="divider">ΚΑΙ</div>\n'
    s += field("name2", "Το όνομά του/της", placeholder="π.χ. Γιώργος")
    s += field("dob2", "Ημερομηνία γέννησής του/της" + ("" if need_dob else " (αν την ξέρεις)"), "date")
    s += field("tob2", "Ώρα γέννησής του/της (αν την ξέρεις)", "time", note=NOTE_TIME2)
    s += field("pob2", "Πόλη γέννησής του/της (αν την ξέρεις)", placeholder="π.χ. Θεσσαλονίκη", note=NOTE_PLACE)
    return s

ASTRO_STEPS = ["Η πληρωμή σου επιβεβαιώθηκε", "Οι χάρτες ανοίγουν", "Υπολογίζονται οι κινήσεις των πλανητών για τους επόμενους 12 μήνες", "Ο χρησμός σου γράφεται ειδικά για σένα"]
Q_STEPS = ["Η πληρωμή σου επιβεβαιώθηκε", "Η ερώτησή σου διαβάζεται", "Αναζητούμε την απάντηση", "Η απάντηση γράφεται ειδικά για σένα"]
Q_RITUAL = ["Η ερώτησή σου φτάνει στα άστρα{name}...", "Αναζητούμε την απάντηση στους ίδιους χάρτες...", "Η απάντησή σου γράφεται..."]

TOOLS = {
  "erotima": dict(
    file="erotima-tool-agora.html", kind="open", needDob2=False, needQuestion=True,
    title="Ρώτα το Μαντείο", h1="Ρώτα<br>το Μαντείο", img="images/manteio-advisor.jpg",
    sub="Γράψε ό,τι σε απασχολεί, με δικά σου λόγια. Ο χάρτης της γέννησής σου έχει ήδη την απάντηση.",
    ask="Και μετά τον χρησμό σου, μπορείς να κάνεις και δεύτερη και τρίτη ερώτηση πάνω στον ίδιο χάρτη.",
    fields=lambda: person1() + field("question", "Τι θέλεις να ρωτήσεις;", "textarea", "π.χ. Θα βρει δουλειά ο γιος μου φέτος; Να μετακομίσω; Τι μου φέρνει ο χειμώνας;", '<div class="time-note">Γράψε με δικά σου λόγια αυτό που σε απασχολεί. Όσο πιο συγκεκριμένα, τόσο πιο καθαρή η απάντηση.</div>') + '      <div class="divider">ΑΝ Η ΕΡΩΤΗΣΗ ΑΦΟΡΑ ΚΑΙ ΑΛΛΟ ΠΡΟΣΩΠΟ (ΠΡΟΑΙΡΕΤΙΚΟ)</div>\n' + field("name2", "Το όνομά του/της", placeholder="π.χ. Γιώργος") + field("dob2", "Ημερομηνία γέννησής του/της (αν την ξέρεις)", "date") + field("tob2", "Ώρα γέννησής του/της (αν την ξέρεις)", "time", note=NOTE_TIME2) + field("pob2", "Πόλη γέννησής του/της (αν την ξέρεις)", placeholder="π.χ. Θεσσαλονίκη", note=NOTE_PLACE),
    pctLabel=None,
    blur="Ο χάρτης σου δείχνει καθαρά την απάντηση σε αυτό που ρωτάς. Υπάρχει ένα πρώτο σημάδι μέσα στους επόμενους μήνες και μια περίοδος που αλλάζει τα πράγματα, με συγκεκριμένες ημερομηνίες από τον πραγματικό ουρανό, και τι χρειάζεται να κάνεις εσύ τότε.",
    sealSub="Η καθαρή απάντηση στην ερώτησή σου, πότε αλλάζει και τι να κάνεις τότε.",
    teaserRitual=["Η ερώτησή σου φτάνει στα άστρα{name}...", "Ο χάρτης της γέννησής σου ανοίγει...", "Αναζητούμε στον χάρτη σου το σημείο που απαντά..."],
    fullRitual=["Η σφραγίδα του χρησμού σου ανοίγει...", "Υπολογίζονται οι κινήσεις των πλανητών για τους επόμενους 12 μήνες...", "Αναζητούμε τη στιγμή που αλλάζει αυτό που ρωτάς...", "Ο χρησμός σου γράφεται{name}..."],
    waitSteps=ASTRO_STEPS,
    qPh="π.χ. Και τι να κάνω μέχρι τότε;", qHint="Ρώτα ό,τι σε καίει, πάνω στον ίδιο χάρτη.", sameData="με τον ίδιο χάρτη"),
  "agapi": dict(
    file="agapi-tool-agora.html", kind="astro2", needDob2=False, needQuestion=False,
    title="Ο Χρησμός της Αγάπης", h1="Ο Χρησμός<br>της Αγάπης", img="images/agapi.jpg",
    sub="Σε σκέφτεται ακόμα; Νιώθει το ίδιο; Η Αφροδίτη του δεν αλλάζει ανάλογα με το τι θα ήθελες να ακούσεις.",
    ask="Και μετά τον χρησμό σου, μπορείς να ρωτήσεις τα άστρα ό,τι σε καίει για εκείνο το πρόσωπο και για την καρδιά σου.",
    fields=lambda: person1() + person2(False),
    pctLabel="ΠΟΣΟ ΖΩΝΤΑΝΟ ΕΙΝΑΙ ΤΟ ΣΥΝΑΙΣΘΗΜΑ",
    blur="Η Αφροδίτη του δείχνει καθαρά τι νιώθει ακόμα για σένα και γιατί σωπαίνει. Υπάρχει μια περίοδος μέσα στους επόμενους μήνες που αυτό το συναίσθημα θα φανεί, και ο χάρτης λέει ποια κίνηση θα το φέρει στην επιφάνεια και τι χρειάζεται να κάνεις εσύ τότε.",
    sealSub="Πόσο ζωντανό είναι ακόμα το συναίσθημα, πότε θα φανεί και τι να κάνεις εσύ.",
    teaserRitual=["Τα άστρα ανοίγουν τον χάρτη της γέννησής σου{name}...", "Οι πλανήτες παίρνουν τις θέσεις που είχαν τη μέρα που γεννηθήκατε...", "Η Αφροδίτη του αρχίζει να μιλά..."],
    fullRitual=["Η σφραγίδα του χρησμού σου ανοίγει...", "Η Αφροδίτη και η Σελήνη του ξεκλειδώνουν όσα δεν λέει...", "Αναζητούμε τη στιγμή που θα φανεί το συναίσθημα...", "Ο χρησμός σου γράφεται{name}..."],
    waitSteps=ASTRO_STEPS,
    qPh="π.χ. Θα μου πει τι νιώθει τελικά;", qHint="Ρώτα ό,τι σε καίει για εσάς τους δύο ή για την καρδιά σου.", sameData="με τους ίδιους χάρτες"),
  "alitheia": dict(
    file="alitheia-tool-agora.html", kind="astro2", needDob2=False, needQuestion=False,
    title="Ο Χρησμός της Αλήθειας", h1="Ο Χρησμός<br>της Αλήθειας", img="images/alitheia.jpg",
    sub="Υπάρχει κάτι που δεν σου λέει; Ο χάρτης του δεν κρύβεται, ακόμα κι όταν εκείνος προσπαθεί.",
    ask="Και μετά τον χρησμό σου, μπορείς να ρωτήσεις τα άστρα ό,τι σε καίει για εκείνο το πρόσωπο.",
    fields=lambda: person1() + person2(False),
    pctLabel="ΠΙΘΑΝΟΤΗΤΑ ΑΠΟΚΡΥΨΗΣ",
    blur="Ο Ερμής του δείχνει αν πρόκειται για απόκρυψη ή για σιωπή, και τι νιώθει για σένα πίσω από αυτή. Υπάρχει μια συγκεκριμένη περίοδος που η αλήθεια βγαίνει στο φως, και ο χάρτης λέει πότε ακριβώς και πώς να τη δεχτείς.",
    sealSub="Αν κρύβει κάτι ή απλώς σωπαίνει, τι νιώθει πραγματικά και πότε βγαίνει η αλήθεια στο φως.",
    teaserRitual=["Τα άστρα ανοίγουν τον χάρτη της γέννησής σου{name}...", "Ο Ερμής, ο πλανήτης των λόγων, αρχίζει να μιλά...", "Αναζητούμε όσα δεν ειπώθηκαν..."],
    fullRitual=["Η σφραγίδα του χρησμού σου ανοίγει...", "Ο Ερμής του φανερώνει όσα κρατά για τον εαυτό του...", "Αναζητούμε τη μέρα που βγαίνει η αλήθεια στο φως...", "Ο χρησμός σου γράφεται{name}..."],
    waitSteps=ASTRO_STEPS,
    qPh="π.χ. Γιατί άλλαξε συμπεριφορά τον τελευταίο μήνα;", qHint="Ρώτα ό,τι σε καίει για εκείνο το πρόσωπο ή για την καρδιά σου.", sameData="με τους ίδιους χάρτες"),
  "symvatotita": dict(
    file="symvatotita-tool-agora.html", kind="astro2", needDob2=True, needQuestion=False,
    title="Ταιριάζετε; Η Πλήρης Συμβατότητά σας", h1="Ταιριάζετε;<br>Η Πλήρης Συμβατότητά σας", img="images/syndesi.jpg",
    sub="Κατανόησε τι δείχνει πραγματικά ο συνδυασμός των δύο χαρτών σας, πέρα από αμφιβολίες και σιωπές.",
    ask="Και μετά τον χρησμό σας, μπορείς να ρωτήσεις τα άστρα ό,τι σε καίει για εσάς τους δύο.",
    fields=lambda: person1() + person2(True),
    pctLabel="ΠΟΣΟΣΤΟ ΣΥΜΒΑΤΟΤΗΤΑΣ",
    blur="Οι δύο Σελήνες σας δείχνουν πόσο καταλαβαίνει ο ένας τον άλλον χωρίς λόγια, η Αφροδίτη και ο Άρης τη χημεία σας, και οι Ερμήδες πού παρεξηγείστε. Υπάρχει ένα σημείο που σας δένει πιο δυνατά από όλα και μια δοκιμασία που πρέπει να ξέρετε.",
    sealSub="Το ποσοστό συμβατότητας, πού δένετε, πού συγκρούεστε και αν υπάρχει κοινό μέλλον.",
    teaserRitual=["Τα άστρα ανοίγουν τους δύο χάρτες σας{name}...", "Οι πλανήτες σας συναντιούνται...", "Αναζητούμε πού δένουν οι δύο ουρανοί σας..."],
    fullRitual=["Η σφραγίδα του χρησμού σας ανοίγει...", "Οι Σελήνες, οι Αφροδίτες και οι Ερμήδες σας συγκρίνονται...", "Αναζητούμε την καλύτερη περίοδο για εσάς τους δύο...", "Ο χρησμός σας γράφεται{name}..."],
    waitSteps=ASTRO_STEPS,
    qPh="π.χ. Γιατί νιώθω ότι κάτι δεν λέγεται μεταξύ μας;", qHint="Ρώτα ό,τι σε καίει για εσάς τους δύο.", sameData="με τους ίδιους χάρτες"),
  "oikonomika": dict(
    file="oikonomika-tool-agora.html", kind="astro1", needDob2=False, needQuestion=True,
    title="Μια Φωτισμένη Οικονομική Αρχή", h1="Μια Φωτισμένη<br>Οικονομική Αρχή", img="images/afthonia.jpg",
    sub="Κατανόησε τι δείχνει ο χάρτης σου για τα οικονομικά σου, και πότε ανοίγει το παράθυρο ανακούφισης.",
    ask="Και μετά τον χρησμό σου, μπορείς να ρωτήσεις τα άστρα ό,τι σε απασχολεί για τα χρήματα και τη δουλειά σου.",
    fields=lambda: person1() + field("question", "Ποια είναι η ερώτησή σου;", "textarea", "π.χ. Πότε θα ξεχρεώσω; Πότε θα πουληθεί το σπίτι μου;", '<div class="time-note">Γράψε με δικά σου λόγια αυτό που σε απασχολεί.</div>'),
    pctLabel="ΠΙΘΑΝΟΤΗΤΑ ΑΝΑΚΟΥΦΙΣΗΣ",
    blur="Ο Δίας και η Αφροδίτη του ουρανού περνούν πάνω από σημεία του χάρτη σου που κρατούν τα χρήματα και τη δουλειά. Υπάρχει ένα πρώτο σημάδι μέσα στους επόμενους μήνες και μια περίοδος που ανοίγει πραγματικά το παράθυρο, με συγκεκριμένες ημερομηνίες και τι να κάνεις τότε.",
    sealSub="Η απάντηση στην ερώτησή σου, πότε ανοίγει το παράθυρο ανακούφισης και τι να κάνεις τότε.",
    teaserRitual=["Τα άστρα ανοίγουν τον χάρτη της γέννησής σου{name}...", "Ο Δίας και ο Κρόνος παίρνουν τις θέσεις τους...", "Αναζητούμε το σημείο των χρημάτων στον χάρτη σου..."],
    fullRitual=["Η σφραγίδα του χρησμού σου ανοίγει...", "Υπολογίζονται οι κινήσεις του Δία και της Αφροδίτης για τους επόμενους 12 μήνες...", "Αναζητούμε τη μέρα που ανοίγει το παράθυρο...", "Ο χρησμός σου γράφεται{name}..."],
    waitSteps=ASTRO_STEPS,
    qPh="π.χ. Αξίζει να αλλάξω δουλειά φέτος;", qHint="Ρώτα ό,τι σε απασχολεί για τα χρήματα, τη δουλειά ή το σπίτι σου.", sameData="με τον ίδιο χάρτη"),
  "numerology": dict(
    file="numerology-tool-agora.html", kind="numerology", needDob2=False, needQuestion=False,
    title="Ο Χρησμός της Αριθμολογίας", h1="Ο Χρησμός<br>της Αριθμολογίας", img="images/arithmologia.jpg",
    sub="Οι αριθμοί της γέννησής σου κρύβουν ένα μοτίβο που επαναλαμβάνεται σε όλη σου τη ζωή, χωρίς να το έχεις προσέξει ποτέ.",
    ask="Και μετά τον χρησμό σου, μπορείς να ρωτήσεις ό,τι σε καίει για τον εαυτό σου και τη χρονιά σου.",
    fields=lambda: field("name1", "Το ονοματεπώνυμό σου", placeholder="π.χ. Μαρία Παπαδοπούλου", note='<div class="time-note">Γράψε το όνομα που χρησιμοποιείς στη ζωή σου.</div>') + field("dob1", "Ημερομηνία γέννησής σου", "date"),
    pctLabel=None,
    blur="Ο Αριθμός του Ονόματός σου δείχνει πώς σε βλέπουν οι άλλοι και ο Αριθμός της Ψυχής σου τι λαχταράς κρυφά. Μαζί εξηγούν γιατί το ίδιο μοτίβο ξαναγυρίζει στην αγάπη και στα χρήματα, και το Προσωπικό σου Έτος δείχνει τι ανοίγει και τι κλείνει τους επόμενους μήνες.",
    sealSub="Ο Αριθμός Ονόματος, ο Αριθμός Ψυχής, το μοτίβο που επαναλαμβάνεται και τι φέρνει η χρονιά σου.",
    teaserRitual=["Οι αριθμοί της γέννησής σου υπολογίζονται{name}...", "Κάθε γράμμα του ονόματός σου παίρνει τον αριθμό του...", "Αναζητούμε το μοτίβο της ζωής σου..."],
    fullRitual=["Η σφραγίδα του χρησμού σου ανοίγει...", "Ο Αριθμός Ονόματος και ο Αριθμός Ψυχής φανερώνονται...", "Υπολογίζεται το Προσωπικό σου Έτος...", "Ο χρησμός σου γράφεται{name}..."],
    waitSteps=["Η πληρωμή σου επιβεβαιώθηκε", "Οι αριθμοί σου φανερώνονται", "Το μοτίβο της ζωής σου συντίθεται", "Ο χρησμός σου γράφεται ειδικά για σένα"],
    qPh="π.χ. Γιατί επαναλαμβάνω τα ίδια λάθη στις σχέσεις μου;", qHint="Ρώτα ό,τι σε καίει για τον εαυτό σου, τις σχέσεις ή τη χρονιά σου.", sameData="με τους ίδιους αριθμούς"),
  "taro": dict(
    file="taro-tool-agora.html", kind="taro", needDob2=False, needQuestion=True,
    title="Το Τρίφυλλο Ταρώ", h1="Το Τρίφυλλο<br>Ταρώ", img="images/taro.jpg",
    sub="Τρία χαρτιά πάνω στο δικό σου ερώτημα: τι σε έφερε ως εδώ, τι ζεις τώρα και τι έρχεται.",
    ask="Και μετά την ανάγνωσή σου, μπορείς να ρωτήσεις κι άλλα πάνω στα ίδια χαρτιά.",
    fields=lambda: field("name1", "Το όνομά σου", placeholder="π.χ. Μαρία") + field("question", "Ποιο είναι το ερώτημά σου;", "textarea", "π.χ. Τι πρέπει να ξέρω για τη σχέση μου τους επόμενους μήνες;", '<div class="time-note">Σκέψου το ερώτημα καθαρά πριν το γράψεις. Τα χαρτιά απαντούν σε αυτό που ρωτάς.</div>'),
    pctLabel=None,
    blur="Το χαρτί του Παρόντος δείχνει αυτό που ζεις τώρα και δεν το βλέπεις ακόμα καθαρά. Το χαρτί του Μέλλοντος δείχνει πού οδηγούν τα πράγματα τους επόμενους μήνες, και μαζί δίνουν καθαρή απάντηση στο ερώτημά σου.",
    sealSub="Το Παρόν, το Μέλλον και η καθαρή απάντηση στο ερώτημά σου.",
    teaserRitual=["Τα χαρτιά ανακατεύονται{name}...", "Τρία χαρτιά βγαίνουν από την τράπουλα...", "Το πρώτο χαρτί γυρίζει..."],
    fullRitual=["Το Παρόν και το Μέλλον γυρίζουν...", "Τα χαρτιά δένονται με το ερώτημά σου...", "Η ανάγνωσή σου γράφεται{name}..."],
    waitSteps=["Η πληρωμή σου επιβεβαιώθηκε", "Τα δύο σφραγισμένα χαρτιά γυρίζουν", "Τα χαρτιά δένονται με το ερώτημά σου", "Η ανάγνωσή σου γράφεται ειδικά για σένα"],
    qPh="π.χ. Τι να κάνω για να πάει καλά;", qHint="Ρώτα ό,τι σε καίει, πάνω στα ίδια τρία χαρτιά.", sameData="με τα ίδια χαρτιά"),
}

CORNERS = "".join(f'    <div class="corner {c}"><svg viewBox="0 0 22 22"><path d="M2,2 L2,14 M2,2 L14,2" stroke="#D9B25C" stroke-width="1.2" fill="none"/></svg></div>\n' for c in ["tl", "tr", "bl", "br"])
LOCK = '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="1.6"/></svg>'
STAR = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 6.6L21 10l-5 4.4 1.5 6.6L12 17.8 6.5 21l1.5-6.6L3 10l6.6-1.4z" stroke="currentColor" stroke-width="1.4"/></svg>'
DISCLAIMER = "Το περιεχόμενο του Μαντείου έχει αποκλειστικά ψυχαγωγικό χαρακτήρα και απευθύνεται σε ενήλικες. Δεν αποτελεί πρόβλεψη με επιστημονική βάση και δεν υποκαθιστά τη γνώμη ή τη συμβουλή γιατρού, ψυχολόγου, δικηγόρου, οικονομικού συμβούλου ή άλλου επαγγελματία. Μην παίρνεις σημαντικές αποφάσεις για την υγεία, τα οικονομικά, τις σχέσεις ή τη ζωή σου βασισμένη μόνο σε αυτό. Αν περνάς μια δύσκολη περίοδο, μίλησε με έναν ειδικό ή με έναν άνθρωπο που εμπιστεύεσαι."

SAFETY_NOTE = "Το Μαντείο δεν απαντά σε θέματα υγείας, εγκυμοσύνης, νομικά ή δικαστικά, ούτε δίνει οικονομικές ή επενδυτικές συμβουλές. Αν σε κάποιο σημείο ο χρησμός σου φαίνεται να αγγίζει τέτοιο θέμα, μην τον λάβεις υπόψη σε καμία περίπτωση και απευθύνσου σε γιατρό, δικηγόρο ή οικονομικό σύμβουλο. Αν περνάς κάτι πολύ δύσκολο, μίλησε τώρα με έναν ειδικό: Γραμμή Παρέμβασης για την Αυτοκτονία 1018, Γραμμή SOS για τη βία κατά των γυναικών 15900, και σε άμεσο κίνδυνο 112."

def build(tool, c):
    cfg = {
        "tool": tool, "kind": c["kind"], "title": c["title"], "needDob2": c["needDob2"], "needQuestion": c["needQuestion"],
        "pctLabel": c["pctLabel"], "teaserRitual": c["teaserRitual"], "fullRitual": c["fullRitual"],
        "questionRitual": Q_RITUAL, "waitSteps": c["waitSteps"], "questionSteps": Q_STEPS,
        "questionPlaceholder": c["qPh"], "questionHint": c["qHint"], "sameData": c["sameData"],
    }
    pct = (f'      <div class="pct-wrap" id="pctWrap" style="display:none;">\n        <div class="pct" id="pctnum">0%</div>\n'
           f'        <div class="pct-label">{c["pctLabel"]}</div>\n      </div>\n') if c["pctLabel"] else ""
    title_plain = c["title"]
    return f"""<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="UTF-8">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(title_plain)} | Μαντείο</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<!-- ΠΑΡΑΓΕΤΑΙ ΑΥΤΟΜΑΤΑ από tools/build-oracle-pages.py. Μην το αλλάζεις με το χέρι. -->
<style>
{BASE_CSS}
{EXTRA_CSS}
  .time-note{{ font-size:12px; opacity:0.7; margin-top:6px; line-height:1.4; }}
</style>
<script type="text/javascript">
    (function(c,l,a,r,i,t,y){{
        c[a]=c[a]||function(){{(c[a].q=c[a].q||[]).push(arguments)}};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    }})(window, document, "clarity", "script", "ydrxibksl6");
</script>
</head>
<body>
<div class="stars"></div>

<div class="cover" id="cover">
  <div class="cover-inner">
{CORNERS}
    <h1>{c["h1"]}</h1>
    <img class="illus" src="{c["img"]}" alt="{html.escape(title_plain)}" onerror="this.style.display='none'">
    <p class="sub">{c["sub"]}</p>
    <p class="price-line" style="margin-bottom:10px;">Η αρχή του χρησμού σου δωρεάν</p>
    <p class="ask-line" style="font-size:15px;line-height:1.5;color:var(--muted);margin:0 auto 22px;max-width:340px;">{c["ask"]}</p>
    <p class="trust-line">{STAR}Εμπιστεύονται ήδη πάνω από 33.000 άνθρωποι στο Facebook</p>
    <div class="enter-btn" id="enterBtn">Δες τον χρησμό σου</div>
    <div class="secure-note">{LOCK} Χωρίς κάρτα για το δωρεάν άνοιγμα</div>
  </div>
</div>

<div class="card" id="card">
  <div class="card-inner">
{CORNERS}
    <div class="eyebrow">Μαντείο</div>
    <div class="paid-badge" id="paidBadge" style="display:none;">Η πληρωμή σου επιβεβαιώθηκε ✓</div>
    <h2 id="cardTitle">{html.escape(title_plain)}</h2>

  <form id="form">
{c["fields"]()}
      <div id="emailFields">
        <div class="divider">ΠΟΥ ΝΑ ΣΟΥ ΤΟΝ ΚΡΑΤΗΣΟΥΜΕ</div>
        <div class="field">
          <label for="email">Το email σου</label>
          <input type="email" id="email" placeholder="π.χ. maria@gmail.com" autocomplete="email" />
        </div>
        <div class="field consent">
          <input type="checkbox" id="consent" />
          <label for="consent">Θέλω να λαμβάνω τους χρησμούς και τα νέα του Μαντείου στο email μου. Μπορώ να διαγραφώ όποτε θέλω.</label>
        </div>
      </div>
    <p class="error" id="err"></p>
    <button type="submit" class="submit" id="btn">Δες δωρεάν τον χρησμό σου</button>
  </form>

  <div class="loading" id="loading"></div>

  <div class="result" id="result">
    <div class="spread" id="spread"></div>
    <div class="numbers" id="numbers"></div>
    <div class="reading" id="teaserText"></div>
    <p class="safety-note teaser-note">{SAFETY_NOTE}</p>
    <p class="info" id="infoLine" style="display:none;"></p>

    <div class="seal-wrap" id="seal">
      <div class="seal-blur" aria-hidden="true">{c["blur"]}</div>
      <div class="seal-overlay">
        <div class="wax">Μ</div>
        <div class="seal-title">Ο χρησμός σου συνεχίζεται</div>
        <div class="seal-sub">{c["sealSub"]}</div>
        <div class="enter-btn" id="unlockBtn">Δες τη συνέχεια · 4,99€</div>
        <p class="value-note" style="font-size:12.5px;line-height:1.55;color:var(--muted);max-width:320px;margin:10px auto 18px;text-align:center;">Μια τέτοια πρόβλεψη κοστίζει περίπου 100€. Εδώ γράφεται μόνο για σένα, με 4,99€. Χρεώνεσαι μόνο όταν ολοκληρωθεί ο χρησμός σου.</p>
        <div class="secure-note">{LOCK} Ασφαλής πληρωμή μέσω Stripe</div>
      </div>
    </div>
    <p class="support-line" style="text-align:center;font-size:12.5px;color:var(--muted);margin-top:18px;line-height:1.5;">Αν κάτι δεν πάει καλά, γράψε μας στο <a href="https://m.me/61573958341176" target="_blank" rel="noopener" style="color:var(--gold);">Messenger του Μαντείου</a> και θα το λύσουμε αμέσως.</p>
    <p id="restartLink" style="display:none;text-align:center;font-size:12.5px;color:var(--muted);margin-top:16px;cursor:pointer;text-decoration:underline;">Θέλεις νέο χρησμό; Ξεκίνα από την αρχή</p>

    <div class="full-wrap" id="fullWrap">
      <div class="question-head" id="questionHead"><div class="ql">Η ΕΡΩΤΗΣΗ ΣΟΥ</div><div class="qt" id="questionShown"></div></div>
      <div id="ritualFull"></div>
{pct}      <div class="reading" id="readingtext"></div>
      <p class="safety-note">{SAFETY_NOTE}</p>
      <p id="pauseNote" class="pause-note" style="display:none;">Ο χρησμός σου συνεχίζει να γράφεται, μείνε εδώ<span class="dots"><i>.</i><i>.</i><i>.</i></span></p>
      <div id="adviceWrap" style="display:none; margin-top:20px; padding-top:18px; border-top:1px solid var(--line);">
        <div style="font-size:11.5px; letter-spacing:2px; color:var(--gold); text-transform:uppercase; margin-bottom:8px;">Πρακτική συμβουλή</div>
        <div id="adviceText" style="font-family:'Inter',sans-serif; font-size:14.5px; line-height:1.65; color:var(--paper); white-space:pre-wrap;"></div>
      </div>
    </div>
    <div id="extraActions" style="margin-top:22px; text-align:center;"></div>
  </div>

  <p class="note" style="line-height:1.55;">{DISCLAIMER}</p>
  </div>
</div>

<script>
{DATE_JS}
</script>
<script>
const CFG = {json.dumps(cfg, ensure_ascii=False)};
{PAGE_JS}
</script>
</body>
</html>
"""

for tool, c in TOOLS.items():
    out = build(tool, c)
    (ROOT / c["file"]).write_text(out, encoding="utf-8")
    print("έγραψα", c["file"], len(out))
