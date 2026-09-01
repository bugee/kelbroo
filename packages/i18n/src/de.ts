import type { Dictionary } from './dictionary';

/**
 * Niemiecki.
 *
 * Forma grzecznościowa: **Sie**, nie „du" — piszemy do restauratora, czyli
 * do przedsiębiorcy, a nie do gościa. „Bon" to `Küchenbon`, słowo z gastronomii,
 * a nie `Beleg`, które znaczy paragon dla klienta.
 */
export const de: Dictionary = {
  meta: {
    tytul: 'kelbroo — Self-Service Dining',
    opis: 'Gäste bestellen mit dem Handy, nachdem sie den QR-Code am Tisch gescannt haben. Die Bestellung geht direkt in die Küche und an den Service. Feste monatliche Gebühr, keine Provision auf Bestellungen.',
    ogOpis:
      'Gäste bestellen mit dem Handy, nachdem sie den QR-Code am Tisch gescannt haben. Keine Provision auf Bestellungen.',
  },
  nav: {
    jak: 'So funktioniert es',
    modele: 'Zahlungen',
    funkcje: 'Funktionen',
    cennik: 'Preise',
    faq: 'FAQ',
    zaloguj: 'Anmelden',
    wyprobuj: '14 Tage testen',
    stronaGlowna: 'kelbroo — Startseite',
    jezyk: 'Sprache',
    trybCiemny: 'Dunkles Design einschalten',
    trybJasny: 'Helles Design einschalten',
  },
  hero: {
    eyebrow: 'Self-Service Dining',
    naglowekPrzed: 'Gäste bestellen mit dem Handy. Der Service kehrt ',
    naglowekAkcent: 'zu den Gästen zurück',
    lede: 'kelbroo macht aus dem QR-Code am Tisch eine vollständige Speisekarte, eine Bestellung und eine Rechnung. Ohne App, ohne Registrierung der Gäste und ohne Änderung an Ihrer Kasse.',
    ctaGlowne: '14 Tage kostenlos starten',
    ctaDrugie: 'Demo-Karte ansehen',
    notatkaMocna: 'Ohne Kreditkarte.',
    notatka: 'In einem Tag einsatzbereit.',
    scenaOpis: 'Vorschau: die Bestellung des Gastes landet auf dem Küchenbon',
  },
  makieta: {
    lokal: 'Bistro am Fluss',
    stolik: 'Tisch 12',
    dania: [
      { nazwa: 'Sauerteigsuppe', opis: 'Ei, Weißwurst', cena: '5,60' },
      { nazwa: 'Kartoffelteigtaschen', opis: '8 Stück, Röstzwiebeln', cena: '7,40' },
      { nazwa: 'Wiener Käsekuchen', opis: 'Himbeersauce', cena: '4,40' },
    ],
    zamawiam: 'Bestellen',
    waluta: '€',
    bon: 'KÜCHENBON',
    godzina: '18:42',
    stolikBon: 'TISCH 12',
    bezCebulki: 'ohne Zwiebeln',
    poz: 'Pos.',
    stempel: 'AN DIE KÜCHE',
  },
  segmenty: {
    restauracje: 'Restaurants',
    kawiarnie: 'Cafés',
    bary: 'Bars und Kneipen',
    hotele: 'Hotels',
    sieci: 'Ketten und Food Courts',
  },
  statystyki: [
    { liczba: '0 %', opis: 'Provision auf Bestellungen — Sie zahlen nur das Abo' },
    { liczba: '0 Installationen', opis: 'der Gast scannt den Code und bestellt im Browser' },
    { liczba: '6 Sprachen', opis: 'die Karte übersetzt für Gäste aus dem Ausland' },
    { liczba: '1 Tag', opis: 'von der Anmeldung bis zur ersten Bestellung' },
  ],
  kroki: {
    eyebrow: 'Am Tisch',
    naglowek: 'Vier Schritte, nichts wird abgeschrieben',
    lede: 'Die Bestellung geht direkt vom Handy des Gastes auf den Küchenbildschirm. Niemand notiert etwas auf einem Zettel und niemand verwechselt Tische.',
    pozycje: [
      {
        krok: 'SCHRITT 01',
        tytul: 'Der Gast scannt den Code',
        tresc:
          'Der QR-Code am Tisch öffnet die Karte im Browser. Ohne App-Download, ohne Kontoanlage.',
      },
      {
        krok: 'SCHRITT 02',
        tytul: 'Und bestellt',
        tresc:
          'Er wählt Gerichte, Extras und Hinweise und sieht Allergene, Fotos und Zubereitungszeiten — auf Deutsch oder in seiner Sprache.',
      },
      {
        krok: 'SCHRITT 03',
        tytul: 'Die Küche sieht den Bon',
        tresc:
          'Die Bestellung erscheint auf dem Küchenbildschirm mit Tischnummer und Zeitzähler. Der Service kann sie zuerst am Tisch bestätigen.',
      },
      {
        krok: 'SCHRITT 04',
        tytul: 'Der Service serviert',
        tresc:
          'Fertige Gerichte wandern auf die Liste „zum Servieren". Der Service bringt sie an den Tisch und schließt die Rechnung.',
      },
    ],
  },
  modele: {
    eyebrow: 'Bei Ihnen ändert sich nichts',
    naglowek: 'Gäste bestellen mit dem Handy und zahlen beim Service — wie bisher',
    lede: 'Die häufigste Sorge lautet: „Ich will weder die Zahlungsweise noch meine Kasse ändern." Müssen Sie nicht. kelbroo ändert, wie bestellt wird, und lässt die Abrechnung genau dort, wo sie heute ist.',
    kartaTag: 'Keine Transaktionsgebühren',
    kartaTytul: 'Zahlung beim Service',
    kartaLede:
      'Gäste bestellen nur mit dem Handy. Alles aus dem Besuch summiert sich zu einer Rechnung, die der Service nach dem Essen abrechnet — an Ihrer Kasse, mit Ihrem Terminal.',
    zalety: [
      'Belege stellen Sie aus wie bisher — ohne Kassenintegration',
      'Keine Provision eines Zahlungsanbieters',
      'Der Service kann jede Bestellung am Tisch bestätigen',
      'Schichtabrechnung für jede Servicekraft',
    ],
    przygotowujemy:
      'Die Zahlung durch den Gast in der App bereiten wir vor — heute bleibt die Abrechnung beim Service.',
  },
  podzial: {
    eyebrow: 'Schluss mit dem Streit um die Rechnung',
    naglowek: 'Alle scannen denselben Code und zahlen für sich',
    lede: 'Gäste an einem Tisch treten einem gemeinsamen Besuch bei — jeder bekommt einen Spitznamen und ein Erkennungszeichen, und wer möchte, gibt einen eigenen Namen ein. Ohne Konto. Danach rechnen sie getrennt ab, nach Positionen, in Gruppen oder gleichmäßig — eine geteilte Flasche teilt der Service mit einem Tippen auf.',
    zestawienie:
      'Zahlt eine Person, kann sich jeder eine Aufstellung „wer hat was bestellt" per E-Mail schicken — fertig für die Reisekostenabrechnung.',
    ctaFunkcje: 'Alle Funktionen ansehen',
    rachunekTytul: 'Tischrechnung',
    rachunekPodpis: 'TISCH 12 · 4 Personen',
    goscie: [
      { nick: 'Fröhlicher Dachs', dania: 'Suppe, Teigtaschen', kwota: '13,00 €' },
      { nick: 'Schneller Igel', dania: 'Schnitzel, Kompott', kwota: '14,40 €' },
      { nick: 'Nachteule', dania: 'Käsekuchen, Espresso', kwota: '7,20 €' },
      { nick: 'Durch 3 geteilt', dania: 'Hauswein, Karaffe', kwota: '16,00 €' },
    ],
    razem: 'GESAMT',
    razemKwota: '50,60 €',
  },
  funkcje: {
    eyebrow: 'In jedem Tarif',
    naglowek: 'Alles, was Service und Küche brauchen',
    pozycje: [
      {
        tytul: 'Karte in mehreren Sprachen',
        tresc:
          'Der Gast bekommt die Karte automatisch in seiner Sprache. Fehlt eine Übersetzung, greift immer die Standardsprache des Lokals — nie ein leerer Bildschirm.',
      },
      {
        tytul: 'Küchenbildschirm (KDS)',
        tresc:
          'Spalten „neu / in Zubereitung / fertig", Zeitzähler und Signalton. Eine Bestellung färbt sich rot, wenn sie zu lange wartet.',
      },
      {
        tytul: 'QR-Codes für Tische',
        tresc:
          'Sie erzeugen sie im Panel mit eigenem Logo und laden ein fertiges A4-Blatt zum Ausdrucken herunter — Aufkleber, Aufsteller oder Karten.',
      },
      {
        tytul: 'Bewertungen und Feedback',
        tresc:
          'Der Gast bewertet jedes Gericht nach dem Essen. Kritik geht direkt an die Leitung — bevor sie in einer öffentlichen Rezension landet.',
      },
      {
        tytul: 'Berichte und Auswertungen',
        tresc:
          'Welche Gerichte sich am besten verkaufen, welche niemand bestellt, wann Ihre Stoßzeit ist und wie lange eine Bestellung bis zur Ausgabe braucht.',
      },
      {
        tytul: 'Service bestellt und korrigiert',
        tresc:
          'Das Personal kann für einen Gast bestellen und die Bestellung korrigieren. In der Historie ist immer sichtbar, was der Gast und was der Service hinzugefügt hat.',
      },
      {
        tytul: 'Tischwechsel ohne Abrechnung',
        tresc:
          'Gäste wechseln mit einem Tippen an einen anderen Tisch — Rechnung, Bestellungen und Küchenbons gehen mit. Der alte Tisch ist sofort frei.',
      },
    ],
  },
  demo: {
    naglowek: 'Sehen Sie es mit den Augen eines Gastes',
    lede: 'Öffnen Sie die Karte des Demo-Lokals genau so, wie es ein Gast nach dem Scannen des QR-Codes am Tisch täte. Ohne Konto und ohne Installation — es ist dieselbe App, die Ihr Lokal bekommt.',
    drugi:
      'Sie können die Karte in zwei Sprachen durchsehen, ein Gericht in den Warenkorb legen und bestellen. Sie sehen auch, wie eine gemeinsame Rechnung aussieht, wenn mehrere Personen am Tisch sitzen.',
    kodPodpis: 'Mit dem Handy scannen',
    kodPodpisStuknij: 'oder antippen, wenn Sie am Handy lesen',
    zastrzezenie:
      'Demo-Bestellungen erreichen keine Küche. Servicepanel und KDS zeigen wir live in der Präsentation.',
    stolikTytul: 'Bistro Widok — Demo-Tisch',
    pokazPanel: 'Zeigen Sie mir den Küchenbildschirm',
  },
  faq: {
    eyebrow: 'Fragen von Gastronomen',
    naglowek: 'Bevor Sie fragen',
    pozycje: [
      {
        pytanie: 'Müssen Gäste eine App installieren?',
        odpowiedz:
          'Nein. Das Scannen des QR-Codes öffnet die Karte im Handy-Browser, wie jede andere Webseite. Der Gast legt kein Konto an und gibt weder E-Mail noch Telefonnummer an.',
      },
      {
        pytanie: 'Muss ich Online-Zahlungen annehmen?',
        odpowiedz:
          'Nein — und heute können Sie es nicht einmal. Gäste bestellen ausschließlich mit dem Handy und zahlen nach dem Essen beim Service, genau wie bisher. Es fallen keine Transaktionsgebühren an und an Ihrem Bargeldfluss ändert sich nichts.',
      },
      {
        pytanie: 'Was ist mit Belegen und der Registrierkasse?',
        odpowiedz:
          'Im Modus „Zahlung beim Service" stellen Sie den Beleg wie immer an Ihrer eigenen Kasse aus — kelbroo greift überhaupt nicht in die Fiskalisierung ein. Bei Online-Zahlungen ist eine Anbindung an Ihre Kasse oder Ihren Fiskaldrucker verfügbar.',
      },
      {
        pytanie: 'Ersetzt das den Service?',
        odpowiedz:
          'Nein. Es nimmt ihm das Aufnehmen von Bestellungen und das Laufen zum Terminal ab, sodass Zeit für das bleibt, was Gäste wirklich schätzen: Beratung, den Blick auf den Tisch, das Gespräch. Der Service kann Bestellungen auch selbst im Panel aufgeben.',
      },
      {
        pytanie: 'Kann der Service eine Bestellung ändern?',
        odpowiedz:
          'Ja. Er kann eine Position hinzufügen, die Menge ändern oder ein Gericht einer anderen Person am Tisch zuordnen. Jede Änderung wird in der Bestellhistorie festgehalten, sodass immer sichtbar bleibt, was vom Gast und was vom Service kam.',
      },
      {
        pytanie: 'Brauche ich neue Hardware?',
        odpowiedz:
          'Ein beliebiges Tablet, Notebook oder ein Rechner mit Browser genügt. Küchen- und Servicepanel öffnen Sie unter panel.kelbroo.com — sie funktionieren auf einem iPad, einem Android-Tablet und am Rechner gleichermaßen.',
      },
      {
        pytanie: 'Was passiert, wenn das Internet ausfällt?',
        odpowiedz:
          'kelbroo braucht eine Verbindung — ohne Internet können weder Gäste noch Personal bestellen. Sie sehen dann eine klare Meldung und keinen leeren Bildschirm. Ist das WLAN im Lokal unzuverlässig, lohnt sich ein Hotspot vom Handy als Reserve.',
      },
      {
        pytanie: 'Wie bezahle ich das Abo?',
        odpowiedz:
          'Nach der Kontoanlage wählen Sie im Panel einen Tarif und zahlen per BLIK, Überweisung oder Karte — abgewickelt von PayU. Sie können monatlich oder jährlich zahlen (dann zwei Monate günstiger). Die Rechnung stellen wir auf die beim Kauf angegebenen Daten aus.',
      },
      {
        pytanie: 'Wie lange dauert die Einrichtung?',
        odpowiedz:
          'Lokal konfigurieren, Karte einpflegen und QR-Codes drucken dauert in der Regel einen Tag. Auf Wunsch pflegen wir die Karte im Rahmen einer schlüsselfertigen Einrichtung für Sie ein.',
      },
    ],
  },
  kontakt: {
    naglowek: 'Sprechen wir',
    lede: 'Schreiben Sie, wenn Sie eine Frage haben — oder vereinbaren Sie eine Präsentation, in der wir das Panel live zeigen und eine Bestellung vom QR-Scan bis zur Ausgabe aus der Küche durchgehen. Wir antworten innerhalb eines Werktags.',
    formularzTytul: 'Lieber direkt schreiben?',
    prezentacja: 'Präsentation vereinbaren',
  },
  formularz: {
    sprawa: 'Worum geht es?',
    celPytanie: 'Ich habe eine Frage',
    celPrezentacja: 'Ich möchte eine Demo',
    imie: 'Vor- und Nachname',
    lokal: 'Lokal oder Firma',
    email: 'E-Mail',
    telefon: 'Telefon',
    nieobowiazkowo: 'Optional',
    kiedy: 'Wann erreichen wir Sie am besten',
    kiedyPodpowiedz: 'Z. B. dienstags und donnerstags vor 11 Uhr. Die Demo dauert etwa 20 Minuten.',
    wiadomosc: 'Nachricht',
    placeholderPrezentacja: 'Wie viele Tische haben Sie, wie nehmen Sie heute Bestellungen auf, was möchten Sie sehen?',
    placeholderPytanie: 'Was möchten Sie fragen?',
    pulapka: 'Dieses Feld bitte leer lassen',
    wysylam: 'Wird gesendet…',
    umowPrezentacje: 'Demo vereinbaren',
    wyslijWiadomosc: 'Nachricht senden',
    zgodaAdres: 'Ihre Adresse nutzen wir ausschließlich für die Antwort auf diese Nachricht. Details in der',
    politykaLink: 'Datenschutzerklärung',
    wyslaneTytul: 'Nachricht gesendet',
    wyslaneTresc: 'Wir melden uns innerhalb eines Werktages. Eine Bestätigung ging an die angegebene Adresse — falls sie nicht angekommen ist, prüfen Sie den Spam-Ordner.',
    bladOgolny: 'Die Nachricht konnte nicht gesendet werden.',
  },
  finalCta: {
    naglowek: 'Die erste Tischbestellung noch heute',
    lede: 'Konto anlegen, Tische und Karte hinzufügen, QR-Codes drucken. 14 Tage Pro-Tarif ohne Gebühr und ohne Kreditkarte.',
    przycisk: '14 Tage kostenlos starten',
    notatka: 'Ohne Karte · ohne feste Laufzeit · ohne Provision auf Bestellungen',
  },
  stopka: {
    opis: 'Self-Service Dining. Gäste bestellen mit dem Handy, das Personal kehrt zu den Gästen zurück.',
    produkt: 'Produkt',
    dlaKogo: 'Für wen',
    firma: 'Unternehmen',
    prawne: 'Dokumente',
    regulamin: 'AGB',
    prywatnosc: 'Datenschutz',
    rodo: 'DSGVO',
    statystyki: 'Statistik-Einwilligung',
    pomoc: 'Wissensdatenbank',
    kontakt: 'Kontakt',
    daneFirmy: 'Firmendaten',
    demoMenu: 'Demo-Karte',
    platnoscUKelnera: 'Zahlung beim Service',
    prawa: 'Alle Rechte vorbehalten.',
    warunki: 'Die Zusammenarbeit regeln die AGB, die Datenverarbeitung die Datenschutzerklärung.',
  },
  strony: {
    dlaKogo: {
      tytul: 'Für wen kelbroo ist — Restaurants, Cafés, Bars, Hotels, Ketten',
      opis: 'Was das Bestellen per Handy im Restaurant mit Bedienung, im Café, in der Bar, im Hotel und in einer Kette verändert.',
    },
    rejestracja: {
      tytul: 'Konto anlegen — kelbroo',
      opis: '14 Tage Pro-Tarif, kostenlos und ohne Kartendaten.',
    },
    potwierdz: { tytul: 'Adresse bestätigen — kelbroo' },
    regulamin: {
      tytul: 'Nutzungsbedingungen — kelbroo',
      opis: 'Die Bedingungen, zu denen kelbroo für gastronomische Betriebe erbracht wird.',
    },
    prywatnosc: {
      tytul: 'Datenschutzerklärung — kelbroo',
      opis: 'Welche Daten kelbroo verarbeitet, in welcher Rolle und wie lange.',
    },
  },
  dlaKogo: {
    naglowek: 'Für wen kelbroo ist',
    lede: 'Dasselbe Produkt löst in jedem Lokal ein anderes Problem. Unten fünf Situationen, in denen wir es im Einsatz gesehen haben — jeweils mit dem Einwand, den wir dort am häufigsten hören.',
    nawigacja: 'Arten von Betrieben',
    cudzyslow: ['„', '“'],
    segmenty: [
      {
        id: 'restauracje',
        nazwa: 'Restaurants mit Bedienung',
        kogo: 'Servicekräfte an den Tischen, eine Karte mit einem Dutzend Gerichten, Abende mit vollem Haus.',
        obiekcja: {
          pytanie: 'Heißt das, ich muss meine Zahlungsabwicklung ändern?',
          odpowiedz:
            'Nein. Sie können genau den Ablauf behalten, den Sie heute haben: Der Gast bestellt per Handy und zahlt nach dem Essen bei der Bedienung — an Ihrem Terminal und Ihrer Kasse. In diesem Modus fallen keinerlei Transaktionsgebühren an; Sie zahlen nur das Abonnement.',
        },
        korzysci: [
          {
            tytul: 'Die Bedienung läuft nicht mehr für Bestellungen',
            opis: 'Die Bestellung geht vom Tisch direkt auf den Küchenbildschirm. Ihr Personal bleibt bei dem, wofür Gäste es wirklich schätzen: beraten und den Tisch im Blick behalten.',
          },
          {
            tytul: 'Sie können jede Bestellung freigeben',
            opis: 'Wenn nichts ohne Bedienung in die Küche gehen soll, schalten Sie die Bestätigung am Tisch ein. Die Bestellung wartet in der Warteschlange, bis das Personal sie annimmt.',
          },
          {
            tytul: 'Eine Rechnung pro Tisch, auch bei sechs Handys',
            opis: 'Alle am Tisch legen auf eine gemeinsame Rechnung und sehen, wer was bestellt hat. Am Ende teilen Sie sie nach Personen, nach Positionen oder gleichmäßig.',
          },
        ],
        akcja: 'demo',
        ctaEtykieta: 'Mit den Augen des Gastes sehen',
      },
      {
        id: 'kawiarnie',
        nazwa: 'Cafés und Theken-Betriebe',
        kogo: 'Schneller Durchlauf, Schlange an der Theke, zwei Personen pro Schicht.',
        obiekcja: {
          pytanie: 'Ich habe eine kleine Karte und zwei Leute pro Schicht — ist das nicht ein zu großes System?',
          odpowiedz:
            'Die Einrichtung dauert einen Tag: Karte eintragen, QR-Codes drucken, fertig. Der Starter-Tarif umfasst bis zu 12 Tische. Sie können auch nur mit der digitalen Karte beginnen, ganz ohne Bestellfunktion.',
        },
        korzysci: [
          {
            tytul: 'Gäste bestellen vom Tisch, nicht aus der Schlange',
            opis: 'Die Schlange an der Theke ist zur Stoßzeit nicht mehr der Engpass — und wer an der Maschine steht, wird nicht ständig für eine Bestellung unterbrochen.',
          },
          {
            tytul: 'Die Karte ändern dauert eine Minute',
            opis: 'Kuchen ist aus? Position im Panel abschalten, und sie verschwindet sofort aus der Karte aller Gäste. Nichts nachzudrucken.',
          },
          {
            tytul: 'QR-Codes drucken Sie selbst',
            opis: 'Das Panel erzeugt einen Bogen für einen gewöhnlichen Drucker. Nichts zu bestellen, nichts abzuwarten.',
          },
        ],
        akcja: 'cennik',
        ctaEtykieta: 'Preise ansehen',
      },
      {
        id: 'bary',
        nazwa: 'Bars und Kneipen',
        kogo: 'Laute Abende, viele Nachbestellungen, Rechnungen, die am Ende geteilt werden.',
        obiekcja: {
          pytanie: 'Bei mir wird am Abend niemand am Handy herumtippen.',
          odpowiedz:
            'Meist ist es umgekehrt: Bei lauter Musik ist das Hinüberrufen der Bestellung die größte Zumutung des Abends. Die nächste Runde geht mit einem Tippen raus, und die Bedienung muss für nichts zweimal zurückkommen.',
        },
        korzysci: [
          {
            tytul: 'Nachbestellen, ohne das Personal zu suchen',
            opis: 'Dasselbe wie zuletzt, mit einem Tippen — und der Ruf nach der Bedienung kostet einen Klick, mit sichtbarer Bestätigung, dass sie unterwegs ist.',
          },
          {
            tytul: 'Die Rechnung teilt sich von selbst',
            opis: 'Am Ende des Abends sieht jeder, was er bestellt hat. Geteilt nach Positionen, nach Personen oder gleichmäßig — ohne Rechnen auf der Serviette.',
          },
          {
            tytul: 'Ein Limit für die offene Rechnung',
            opis: 'Sie legen den Betrag fest, ab dem ein Tisch abrechnen muss, bevor weiter bestellt wird. Der Abend endet ohne Überraschung.',
          },
        ],
        akcja: 'demo',
        ctaEtykieta: 'Mit den Augen des Gastes sehen',
      },
      {
        id: 'hotele',
        nazwa: 'Hotels',
        kogo: 'Frühstück, Hotelrestaurant, Gäste in mehreren Sprachen.',
        obiekcja: {
          pytanie: 'Die Hälfte meiner Gäste spricht die Landessprache nicht.',
          odpowiedz:
            'Sie führen die Karte in mehreren Sprachen gleichzeitig, und jeder Gast bekommt seine über die Einstellung seines Telefons. Eine fehlende Übersetzung ergibt nie einen leeren Bildschirm — dann zeigen wir die Standardsprache des Hauses.',
        },
        korzysci: [
          {
            tytul: 'Mehrsprachige Karte ohne getrennte Karten',
            opis: 'Eine Karte, mehrere Sprachfassungen. Ein an einer Stelle geänderter Preis gilt in allen.',
          },
          {
            tytul: 'Allergene und Zutaten an jeder Position',
            opis: 'Der Gast prüft selbst — ohne das Personal zu fragen und ohne Übersetzung durch die Rezeption.',
          },
          {
            tytul: 'QR-Codes überall dort, wo ein Tisch steht',
            opis: 'Restaurant, Lobby, Terrasse. Jeder Tisch hat seinen eigenen Code, damit sofort klar ist, wohin die Bestellung geht.',
          },
        ],
        akcja: 'prezentacja',
        ctaEtykieta: 'Demo vereinbaren',
      },
      {
        id: 'sieci',
        nazwa: 'Ketten und Food-Courts',
        kogo: 'Mehrere Betriebe unter einer Marke, gemeinsames Reporting, eigene Abläufe.',
        obiekcja: {
          pytanie: 'Wir haben ein eigenes Kassensystem und Abläufe, die wir nicht ändern werden.',
          odpowiedz:
            'Darüber sprechen wir vor der Einführung, nicht danach. Rollouts für Ketten begleiten wir individuell — mit Anbindung auf Ihrer Seite, gemeinsamer Preisgestaltung und festem Ansprechpartner. Der Enterprise-Tarif wird nach Umfang kalkuliert.',
        },
        korzysci: [
          {
            tytul: 'Eine Einführung, die ein Mensch begleitet',
            opis: 'Karte einpflegen, Codes drucken und anbringen, Personal schulen. Wir lassen keine Kette mit Panel und Handbuch allein.',
          },
          {
            tytul: 'Eine Karte, viele Betriebe',
            opis: 'Umfang und Aufteilung legen wir bei der Einführung fest — im Food-Court sieht das anders aus als in einer Kette mit einer Karte für alle Standorte.',
          },
          {
            tytul: 'Das Gespräch vor der Unterschrift',
            opis: 'Wir zeigen das Panel live und gehen Ihr Szenario durch, bevor Sie irgendetwas bestellen.',
          },
        ],
        akcja: 'prezentacja',
        ctaEtykieta: 'Demo vereinbaren',
      },
    ],
    band: {
      naglowek: 'Ihr Betrieb ist nicht dabei?',
      tresc: 'Schreiben Sie uns, wie Sie heute Bestellungen aufnehmen. Wir sagen offen, ob kelbroo bei Ihnen etwas ändert oder nicht.',
      napisz: 'Schreiben Sie uns',
      zacznij: 'Kostenlos starten',
      drobne: '14 Tage Pro-Tarif, kostenlos und ohne Kartendaten',
    },
  },
  rejestracjaStrona: {
    naglowek: 'Konto anlegen',
    lede: '14 Tage Pro-Tarif, kostenlos und ohne Kartendaten. Sie legen das Konto für einen Betrieb an — weitere kommen später dazu.',
  },
  rejestracjaForm: {
    nazwaLokalu: 'Name des Betriebs',
    imie: 'Vor- und Nachname',
    nip: 'Polnische Steuernummer (NIP)',
    nipPodpowiedz: 'Zehn Ziffern. Der Dienst richtet sich ausschließlich an Unternehmen.',
    email: 'E-Mail',
    haslo: 'Passwort',
    hasloPodpowiedz: 'Mindestens {min} Zeichen.',
    bledy: {
      nazwaLokalu: 'Geben Sie den Namen des Betriebs an.',
      imie: 'Geben Sie Vor- und Nachnamen an.',
      email: 'Das sieht nicht nach einer gültigen E-Mail-Adresse aus.',
      haslo: 'Das Passwort muss mindestens {min} Zeichen haben.',
      nip: 'Prüfen Sie die Steuernummer — diese Ziffern ergeben keine gültige Nummer.',
    },
    zgodaRegulamin: 'Ich akzeptiere die {link} von kelbroo.',
    zgodaPrywatnosc: 'Ich habe die {link} gelesen.',
    zakladam: 'Konto wird angelegt…',
    zacznij: '14 Tage kostenlos starten',
    bladOgolny: 'Das Konto konnte nicht angelegt werden. Bitte versuchen Sie es erneut.',
    sukcesTytul: 'Sehen Sie in Ihr Postfach',
    sukcesKonto: 'Das Konto für „{nazwa}“ ist angelegt. Wir haben eine Nachricht gesendet an:',
    sukcesKlik: 'Klicken Sie auf den Link in der Nachricht, um die Adresse zu bestätigen und ins Panel zu gelangen.',
    sukcesSpam: 'Nachricht nicht angekommen? Prüfen Sie den Spam-Ordner oder schreiben Sie an kontakt@kelbroo.com.',
  },
  potwierdzenie: {
    sprawdzam: 'Link wird geprüft…',
    bladNiekompletny: 'Dieser Link ist unvollständig.',
    bladOgolny: 'Die Adresse konnte nicht bestätigt werden.',
    gotoweTytul: 'Adresse bestätigt',
    gotoweTresc: 'Sie können sich im Panel anmelden und die ersten Positionen der Karte anlegen.',
    doPanelu: 'Zum Panel',
    nieudaneTytul: 'Bestätigung fehlgeschlagen',
    ponowioneInfo: 'Falls ein Konto mit dieser Adresse besteht, ist ein neuer Link bereits unterwegs.',
    etykietaPonow: 'Wir senden einen neuen Link',
    placeholderEmail: 'E-Mail-Adresse des Kontos',
    wyslijPonownie: 'Erneut senden',
  },
  zgoda: {
    tytul: 'Besuchsstatistik.',
    tresc:
      'Wir möchten wissen, welche Teile dieser Seite gelesen werden — das hilft uns, sie zu verbessern. Ohne Ihre Einwilligung laden wir kein Analyseskript.',
    drobne: 'Betrifft nur diese Seite. Die Gäste-App hat keine Analyse — und wird keine bekommen.',
    tak: 'Einverstanden',
    nie: 'Nein, danke',
    wyslane: 'Details in der Datenschutzerklärung.',
  },
  cennik: {
    eyebrow: 'Preise',
    naglowek: 'Festes Abo. Keine Provision auf Bestellungen.',
    lede: 'Sie zahlen pro Lokal, nicht pro Umsatz. Preise netto — die Mehrwertsteuer kommt hinzu.',
    miesiecznie: 'Monatlich',
    rocznie: 'Jährlich −17 %',
    zaMiesiac: '/ Mon.',
    rozliczenieMiesieczne: 'monatliche Abrechnung',
    rozliczenieRoczne: '{kwota} pro Jahr',
    naZawsze: 'dauerhaft kostenlos',
    wycena: 'individuelles Angebot',
    najlepszy: 'Am häufigsten gewählt',
    oszczednoscMiesiecznie: 'Bei jährlicher Zahlung sparen Sie 17 % — zwei Monate gratis.',
    oszczednoscRocznie: 'Jährliche Abrechnung — zwei Monate gratis inklusive.',
    notatki: [
      { tytul: 'Rabatte für Ketten:', tresc: '3–9 Standorte −15 %, ab 10 Standorten −25 %' },
      { tytul: 'Zusatzoptionen:', tresc: '+10 Tische 12 € · zusätzliche Sprache 9 €' },
      { tytul: 'Alle Preise', tresc: 'verstehen sich netto' },
    ],
    walutaUwaga:
      'Die Preise in Euro dienen der Orientierung. Rechnungsstellung und Zahlung erfolgen derzeit in polnischen Złoty.',
    plany: [
      {
        id: 'menu',
        dlaKogo: 'Digitale Karte mit QR-Code, ohne Bestellfunktion',
        cechy: [
          'QR-Codes ohne Limit',
          '1 Sprache, bis 10 Positionen',
          'Karte in einer Minute aktualisiert',
        ],
        cta: 'Konto anlegen',
      },
      {
        id: 'starter',
        dlaKogo: 'Café, kleines Lokal, Food Truck',
        cechy: [
          'Bis 12 Tische, 2 Sprachen, 50 Positionen',
          'Bestellung an den Tisch, Zahlung beim Service',
          'Küchenbildschirm und Servicepanel',
          'Aufteilung „jeder für sich"',
          '3 Personalkonten',
        ],
        cta: 'Starter wählen',
      },
      {
        id: 'pro',
        dlaKogo: 'Restaurant mit vollem Service',
        cechy: [
          'Bis 40 Tische, 6 Sprachen, Karte ohne Limit',
          'Speisefotos in der Karte',
          'Rechnungsteilung nach Positionen und Gruppen',
          'Bewertungen und Feedback an die Leitung',
          'Auswertungen und CSV-Export',
          'Personalkonten ohne Limit',
          'Support innerhalb von 4 Stunden',
        ],
        cta: '14 Tage testen',
      },
      {
        id: 'enterprise',
        dlaKogo: 'Restaurantkette, Hotel, Food Court',
        cechy: [
          'Mehrere Standorte, ohne Limits',
          'Anbindung an Registrierkasse und POS',
          'Eigene Domain und eigenes Branding',
          'Kundenbetreuer und SLA 99,9 %',
        ],
        cta: 'Sprechen wir',
      },
    ],
  },
};
