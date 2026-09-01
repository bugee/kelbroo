import type { Dictionary } from './dictionary';

/**
 * Angielski.
 *
 * Tłumaczenie, nie kalka: „self-service dining" zostaje, bo to nasz tagline,
 * ale „bon kuchenny" jest **kitchen ticket**, a nie „kitchen receipt" — to
 * słowo z kuchni, nie z księgowości. Makieta telefonu ma dania, które faktycznie
 * bywają w karcie, bo jej zadaniem jest pokazać produkt, a nie polską kuchnię.
 */
export const en: Dictionary = {
  meta: {
    tytul: 'kelbroo — self-service dining',
    opis: 'Guests order from their phone after scanning a QR code at the table. The order goes straight to the kitchen and to the waiter. A flat monthly fee, no commission on orders.',
    ogOpis:
      'Guests order from their phone after scanning a QR code at the table. No commission on orders.',
  },
  nav: {
    jak: 'How it works',
    modele: 'Payments',
    funkcje: 'Features',
    cennik: 'Pricing',
    faq: 'FAQ',
    zaloguj: 'Log in',
    wyprobuj: 'Try 14 days',
    stronaGlowna: 'kelbroo — home',
    jezyk: 'Language',
  },
  hero: {
    eyebrow: 'Self-service dining',
    naglowekPrzed: 'Guests order from their phone. Waiters go back ',
    naglowekAkcent: 'to the guests',
    lede: 'kelbroo turns the QR code on the table into a full menu, an order and a bill. No app to download, no guest sign-up, and no change to your cash register.',
    ctaGlowne: 'Start 14 days free',
    ctaDrugie: 'See the demo menu',
    notatkaMocna: 'No card required.',
    notatka: 'Live in a day.',
    scenaOpis: "Preview: a guest's order lands on the kitchen ticket",
  },
  makieta: {
    lokal: 'Riverside Bistro',
    stolik: 'Table 12',
    dania: [
      { nazwa: 'Sourdough soup', opis: 'egg, white sausage', cena: '5.60' },
      { nazwa: 'Potato dumplings', opis: '8 pcs, fried onion', cena: '7.40' },
      { nazwa: 'Viennese cheesecake', opis: 'raspberry sauce', cena: '4.40' },
    ],
    zamawiam: 'Order',
    waluta: '€',
    bon: 'KITCHEN TICKET',
    godzina: '18:42',
    stolikBon: 'TABLE 12',
    bezCebulki: 'no onion',
    poz: 'items',
    stempel: 'TO KITCHEN',
  },
  segmenty: {
    restauracje: 'Restaurants',
    kawiarnie: 'Cafés',
    bary: 'Bars and pubs',
    hotele: 'Hotels',
    sieci: 'Chains and food courts',
  },
  statystyki: [
    { liczba: '0%', opis: 'commission on orders — you pay the subscription only' },
    { liczba: '0 installs', opis: 'the guest scans a code and orders in the browser' },
    { liczba: '6 languages', opis: 'the menu translated for guests from abroad' },
    { liczba: '1 day', opis: 'from sign-up to the first order' },
  ],
  kroki: {
    eyebrow: 'At the table',
    naglowek: 'Four steps, nothing copied by hand',
    lede: "The order goes straight from the guest's phone to the kitchen screen. Nobody writes anything on a notepad and nobody mixes up tables.",
    pozycje: [
      {
        krok: 'STEP 01',
        tytul: 'The guest scans the code',
        tresc:
          'The QR code on the table opens the menu in a browser. No app to download, no account to create.',
      },
      {
        krok: 'STEP 02',
        tytul: 'And places an order',
        tresc:
          'They pick dishes, extras and notes, and see allergens, photos and preparation times — in English or in their own language.',
      },
      {
        krok: 'STEP 03',
        tytul: 'The kitchen sees the ticket',
        tresc:
          'The order appears on the kitchen screen with the table number and a timer. The waiter can confirm it at the table first.',
      },
      {
        krok: 'STEP 04',
        tytul: 'The waiter serves',
        tresc:
          'Finished dishes move to the "ready to serve" list. The waiter takes them to the table and closes the bill.',
      },
    ],
  },
  modele: {
    eyebrow: 'Nothing changes for you',
    naglowek: 'Guests order from their phone and pay the waiter — as before',
    lede: 'The worry we hear most often is: "I don\'t want to change how people pay, or my cash register." You don\'t have to. kelbroo changes how people order and leaves settlement exactly where it is today.',
    kartaTag: 'No transaction fees',
    kartaTytul: 'Pay the waiter',
    kartaLede:
      'Guests only order from their phone. Everything from the visit adds up to one bill, which the waiter settles after the meal — on your register, with your terminal.',
    zalety: [
      'You issue receipts as you do today — no register integration',
      'No payment-processor commission',
      'The waiter can confirm every order at the table',
      'A shift settlement report for each waiter',
    ],
    przygotowujemy:
      'In-app payment by the guest is on its way — today settlement stays with the waiter.',
  },
  podzial: {
    eyebrow: 'No more arguing over the bill',
    naglowek: 'Everyone scans the same code and pays for themselves',
    lede: 'Guests at one table join a shared visit — each gets a nickname and a marker, and anyone who wants can type their own name. No account needed. Then they settle separately, by item, in groups or evenly — the waiter splits a shared bottle into parts with one tap.',
    zestawienie:
      'When one person pays, everyone can e-mail themselves a "who ordered what" summary — ready for an expense claim.',
    ctaFunkcje: 'See all features',
    rachunekTytul: 'Table bill',
    rachunekPodpis: 'TABLE 12 · 4 people',
    goscie: [
      { nick: 'Cheerful Badger', dania: 'Soup, dumplings', kwota: '€13.00' },
      { nick: 'Quick Hedgehog', dania: 'Schnitzel, compote', kwota: '€14.40' },
      { nick: 'Night Owl', dania: 'Cheesecake, espresso', kwota: '€7.20' },
      { nick: 'Split three ways', dania: 'House wine, carafe', kwota: '€16.00' },
    ],
    razem: 'TOTAL',
    razemKwota: '€50.60',
  },
  funkcje: {
    eyebrow: 'In every plan',
    naglowek: 'Everything the floor and the kitchen need',
    pozycje: [
      {
        tytul: 'Menu in several languages',
        tresc:
          "The guest gets the menu in their own language automatically. A missing translation always falls back to the venue's default — never an empty screen.",
      },
      {
        tytul: 'Kitchen display (KDS)',
        tresc:
          'Columns for "new / preparing / ready", a timer and an audible alarm. An order turns red when it has waited too long.',
      },
      {
        tytul: 'QR codes for tables',
        tresc:
          'Generate them in the panel with your own logo and download a ready A4 sheet to print — stickers, stands or cards.',
      },
      {
        tytul: 'Dish ratings and feedback',
        tresc:
          'Guests rate each dish after the meal. Criticism goes straight to the manager — before it ends up in a public review.',
      },
      {
        tytul: 'Reports and analytics',
        tresc:
          'Which dishes sell best, which nobody orders, when your peak is and how long an order takes to leave the kitchen.',
      },
      {
        tytul: 'Waiters order and amend',
        tresc:
          'Staff can place an order for a guest and correct it. The history always shows what the guest added and what the waiter did.',
      },
      {
        tytul: 'Move tables without settling',
        tresc:
          'Guests move to another table with one tap — the bill, the orders and the kitchen tickets follow them. The old table is free immediately.',
      },
    ],
  },
  demo: {
    naglowek: "See it through a guest's eyes",
    lede: 'Open the demo restaurant menu exactly as a guest would after scanning the QR code at the table. No account, nothing to install — it is the same app your venue gets.',
    drugi:
      'You can browse the menu in two languages, add a dish to the basket and place an order. You will also see how a shared bill looks when several people sit at one table.',
    kodPodpis: 'Scan with your phone',
    kodPodpisStuknij: 'or tap, if you are reading on a phone',
    zastrzezenie:
      'Demo orders do not reach any kitchen. We show the staff panel and the KDS live during a demo call.',
    stolikTytul: 'Bistro Widok — demo table',
    pokazPanel: 'Show me the kitchen screen',
  },
  faq: {
    eyebrow: 'Questions from restaurateurs',
    naglowek: 'Before you ask',
    pozycje: [
      {
        pytanie: 'Do guests have to install an app?',
        odpowiedz:
          'No. Scanning the QR code opens the menu in the phone browser, like any other web page. The guest creates no account and gives no e-mail or phone number.',
      },
      {
        pytanie: 'Do I have to accept online payments?',
        odpowiedz:
          'No — and today you cannot. Guests only order from their phone and pay the waiter after the meal, exactly as before. You pay no transaction fees and nothing changes in how cash moves through your venue.',
      },
      {
        pytanie: 'What about receipts and the cash register?',
        odpowiedz:
          'In pay-the-waiter mode you issue the receipt on your own register, as always — kelbroo does not touch fiscalisation at all. With online payments, integration with your register or fiscal printer is available.',
      },
      {
        pytanie: 'Will this replace waiters?',
        odpowiedz:
          'No. It takes order-taking and terminal-fetching off their hands, so they have time for what guests actually value: advice, keeping an eye on the table, conversation. Waiters can also place orders themselves from the panel.',
      },
      {
        pytanie: "Can a waiter amend a guest's order?",
        odpowiedz:
          'Yes. They can add an item, change a quantity or reassign a dish to someone else at the table. Every change is written to the order history, so it is always clear what the guest added and what staff did.',
      },
      {
        pytanie: 'Do I need new hardware?',
        odpowiedz:
          'Any tablet, laptop or computer with a browser will do. You open the kitchen and waiter panels at panel.kelbroo.com — they work the same on an iPad, an Android tablet and a desktop.',
      },
      {
        pytanie: 'What happens if the internet goes down?',
        odpowiedz:
          'kelbroo needs a connection — without internet neither guests nor staff can place an order. You will see a clear message rather than a blank screen. If the venue wi-fi is unreliable, it is worth keeping a phone hotspot as backup.',
      },
      {
        pytanie: 'How do I pay for the subscription?',
        odpowiedz:
          'After creating an account you choose a plan in the panel and pay by BLIK, bank transfer or card — handled by PayU. You can pay monthly or yearly (two months cheaper). We issue a VAT invoice to the details given at purchase.',
      },
      {
        pytanie: 'How long does setup take?',
        odpowiedz:
          'Configuring the venue, entering the menu and printing QR codes usually takes a day. We can also enter the menu for you as part of a turnkey setup.',
      },
    ],
  },
  kontakt: {
    naglowek: 'Let us talk',
    lede: 'Write if you have a question — or book a demo where we show the panel live and walk through an order from the QR scan to the food leaving the kitchen. We reply within one working day.',
    formularzTytul: 'Prefer to write?',
    prezentacja: 'Book a demo',
  },
  formularz: {
    sprawa: 'What is it about?',
    celPytanie: 'I have a question',
    celPrezentacja: 'I want a demo',
    imie: 'Full name',
    lokal: 'Venue or company',
    email: 'E-mail',
    telefon: 'Phone',
    nieobowiazkowo: 'Optional',
    kiedy: 'When is the best time to reach you',
    kiedyPodpowiedz: 'E.g. Tuesdays and Thursdays before 11. The demo takes about 20 minutes.',
    wiadomosc: 'Message',
    placeholderPrezentacja: 'How many tables do you have, how do you take orders today, what would you like to see?',
    placeholderPytanie: 'What would you like to ask?',
    pulapka: 'Leave this field empty',
    wysylam: 'Sending…',
    umowPrezentacje: 'Book a demo',
    wyslijWiadomosc: 'Send message',
    zgodaAdres: 'We will use your address only to reply to this message. Details in the',
    politykaLink: 'privacy policy',
    wyslaneTytul: 'Message sent',
    wyslaneTresc: 'We will get back to you within one business day. A confirmation went to the address you gave — if it has not arrived, check your spam folder.',
    bladOgolny: 'The message could not be sent.',
  },
  finalCta: {
    naglowek: 'Your first table order today',
    lede: 'Create an account, add tables and a menu, print the QR codes. 14 days of the Pro plan free, with no card.',
    przycisk: 'Start 14 days free',
    notatka: 'No card · no fixed-term contract · no commission on orders',
  },
  stopka: {
    opis: 'Self-service dining. Guests order from their phone, staff go back to the guests.',
    produkt: 'Product',
    dlaKogo: 'Who it is for',
    firma: 'Company',
    prawne: 'Documents',
    regulamin: 'Terms of service',
    prywatnosc: 'Privacy',
    rodo: 'GDPR',
    statystyki: 'Analytics consent',
    pomoc: 'Help centre',
    kontakt: 'Contact',
    daneFirmy: 'Company details',
    demoMenu: 'Demo menu',
    platnoscUKelnera: 'Pay the waiter',
    prawa: 'All rights reserved.',
    warunki:
      'Cooperation is governed by the terms of service, and data processing by the privacy policy.',
  },
  strony: {
    dlaKogo: {
      tytul: 'Who kelbroo is for — restaurants, cafés, bars, hotels, chains',
      opis: 'What phone ordering changes in a full-service restaurant, a café, a bar, a hotel and a group of venues.',
    },
    rejestracja: {
      tytul: 'Create an account — kelbroo',
      opis: '14 days of the Pro plan, free and with no card details.',
    },
    potwierdz: { tytul: 'Confirm your address — kelbroo' },
    regulamin: {
      tytul: 'Terms of Service — kelbroo',
      opis: 'The terms on which kelbroo is provided to hospitality venues.',
    },
    prywatnosc: {
      tytul: 'Privacy Policy — kelbroo',
      opis: 'What data kelbroo processes, in what role and for how long.',
    },
  },
  dlaKogo: {
    naglowek: 'Who kelbroo is for',
    lede: 'The same product solves a different problem in every venue. Below are five situations where we have seen it at work — each with the objection we hear most often.',
    nawigacja: 'Types of venue',
    cudzyslow: ['“', '”'],
    segmenty: [
      {
        id: 'restauracje',
        nazwa: 'Full-service restaurants',
        kogo: 'Waiters at the tables, a menu of a dozen or more dishes, evenings with a full room.',
        obiekcja: {
          pytanie: 'Does this mean I have to change how I take payments?',
          odpowiedz:
            'No. You can keep exactly the flow you have today: the guest orders from their phone and pays the waiter after the meal — on your terminal and your till. In this mode there are no transaction fees at all; you pay the subscription and nothing else.',
        },
        korzysci: [
          {
            tytul: 'Waiters stop running for orders',
            opis: 'The order goes from the table straight to the kitchen screen. Your staff stay with what guests actually value them for: advice and looking after the table.',
          },
          {
            tytul: 'You can approve every order',
            opis: 'If you would rather nothing reached the kitchen without a waiter, turn on confirmation at the table. The order waits in the queue until staff accept it.',
          },
          {
            tytul: 'One bill per table, even with six phones',
            opis: 'Everyone at the table adds to a shared bill and sees who ordered what. At the end you split it per person, per item or evenly.',
          },
        ],
        akcja: 'demo',
        ctaEtykieta: 'See it through a guest’s eyes',
      },
      {
        id: 'kawiarnie',
        nazwa: 'Cafés and counter service',
        kogo: 'Fast turnover, a queue at the counter, two people on a shift.',
        obiekcja: {
          pytanie: 'I have a short menu and two people on a shift — isn’t this too big a system?',
          odpowiedz:
            'Setup takes a day: you type in the menu, print the QR codes, and that is it. The Starter plan covers up to 12 tables. You can also begin with the digital menu alone, without ordering.',
        },
        korzysci: [
          {
            tytul: 'Guests order from the table, not from the queue',
            opis: 'The queue at the counter stops being the bottleneck at peak hours — and whoever is on the machine is not interrupted every minute to take an order.',
          },
          {
            tytul: 'Changing the menu takes a minute',
            opis: 'Run out of cake? Switch the item off in the panel and it disappears from every guest’s menu at once. Nothing to reprint.',
          },
          {
            tytul: 'You print the QR codes yourself',
            opis: 'The panel generates a sheet for an ordinary printer. Nothing to order and nothing to wait for.',
          },
        ],
        akcja: 'cennik',
        ctaEtykieta: 'See the pricing',
      },
      {
        id: 'bary',
        nazwa: 'Bars and pubs',
        kogo: 'Loud evenings, plenty of refills, bills split at the end.',
        obiekcja: {
          pytanie: 'In my place nobody is going to fiddle with a phone in the evening.',
          odpowiedz:
            'Usually the opposite is true: over loud music, shouting an order across the table is the biggest nuisance of the evening. The next round goes in with one tap, and the waiter does not have to come back twice for anything.',
        },
        korzysci: [
          {
            tytul: 'Another round without hunting for staff',
            opis: 'The same as last time, in one tap — and calling a waiter takes one click, with a visible sign that they are on their way.',
          },
          {
            tytul: 'The bill splits itself',
            opis: 'At the end of the evening everyone sees what they ordered. Split per item, per person or evenly — no arithmetic on a napkin.',
          },
          {
            tytul: 'A limit on the open tab',
            opis: 'You set the amount at which a table has to settle before ordering more. The evening does not end with a surprise.',
          },
        ],
        akcja: 'demo',
        ctaEtykieta: 'See it through a guest’s eyes',
      },
      {
        id: 'hotele',
        nazwa: 'Hotels',
        kogo: 'Breakfasts, a hotel restaurant, guests speaking several languages.',
        obiekcja: {
          pytanie: 'Half my guests do not speak the local language.',
          odpowiedz:
            'You keep the menu in several languages at once, and each guest gets theirs from their phone settings. A missing translation never produces a blank screen — we show the venue’s default language instead.',
        },
        korzysci: [
          {
            tytul: 'A multilingual menu without separate cards',
            opis: 'One menu, several language versions. A price changed in one place carries over to all of them.',
          },
          {
            tytul: 'Allergens and ingredients on every item',
            opis: 'Guests check for themselves, without asking staff and without reception translating.',
          },
          {
            tytul: 'QR codes wherever there is a table',
            opis: 'Restaurant, lobby, terrace. Every table has its own code, so it is immediately clear where the order goes.',
          },
        ],
        akcja: 'prezentacja',
        ctaEtykieta: 'Book a demo',
      },
      {
        id: 'sieci',
        nazwa: 'Chains and food courts',
        kogo: 'Several venues under one brand, shared reporting, your own procedures.',
        obiekcja: {
          pytanie: 'We have our own POS and procedures, and we are not going to change them.',
          odpowiedz:
            'We talk about that before the rollout, not after. Chain rollouts are handled individually — with integration on your side, joint pricing and a dedicated contact. The Enterprise plan is quoted to scope.',
        },
        korzysci: [
          {
            tytul: 'A rollout led by a person',
            opis: 'Entering the menu, printing and mounting the codes, training the staff. We do not leave a chain alone with a panel and a manual.',
          },
          {
            tytul: 'One menu, many venues',
            opis: 'The scope and the way it is divided is agreed during the rollout — it looks one way in a food court and another in a chain with a single menu across every location.',
          },
          {
            tytul: 'A conversation before the signature',
            opis: 'We show the panel live and walk through your scenario before you order anything.',
          },
        ],
        akcja: 'prezentacja',
        ctaEtykieta: 'Book a demo',
      },
    ],
    band: {
      naglowek: 'Your venue is not on the list?',
      tresc: 'Tell us how you take orders today. We will say plainly whether kelbroo changes anything for you or not.',
      napisz: 'Write to us',
      zacznij: 'Start for free',
      drobne: '14 days of the Pro plan, free and with no card details',
    },
  },
  rejestracjaStrona: {
    naglowek: 'Create an account',
    lede: '14 days of the Pro plan, free and with no card details. You create the account for one venue — you can add more later.',
  },
  rejestracjaForm: {
    nazwaLokalu: 'Venue name',
    imie: 'Full name',
    nip: 'Polish VAT ID (NIP)',
    nipPodpowiedz: 'Ten digits. The service is for businesses only.',
    email: 'E-mail',
    haslo: 'Password',
    hasloPodpowiedz: 'At least {min} characters.',
    bledy: {
      nazwaLokalu: 'Enter the name of the venue.',
      imie: 'Enter your first and last name.',
      email: 'That does not look like a valid e-mail address.',
      haslo: 'The password must be at least {min} characters long.',
      nip: 'Check the VAT ID — these digits do not add up.',
    },
    zgodaRegulamin: 'I accept the kelbroo {link}.',
    zgodaPrywatnosc: 'I have read the {link}.',
    zakladam: 'Creating the account…',
    zacznij: 'Start 14 days free',
    bladOgolny: 'The account could not be created. Please try again.',
    sukcesTytul: 'Check your inbox',
    sukcesKonto: 'The account for “{nazwa}” has been created. We have sent a message to:',
    sukcesKlik: 'Click the link in the message to confirm the address and enter the panel.',
    sukcesSpam: 'Message not arrived? Check your spam folder or write to kontakt@kelbroo.com.',
  },
  potwierdzenie: {
    sprawdzam: 'Checking the link…',
    bladNiekompletny: 'This link is incomplete.',
    bladOgolny: 'The address could not be confirmed.',
    gotoweTytul: 'Address confirmed',
    gotoweTresc: 'You can log in to the panel and add the first items to your menu.',
    doPanelu: 'Go to the panel',
    nieudaneTytul: 'Could not confirm',
    ponowioneInfo: 'If an account with that address exists, a new link is already on its way.',
    etykietaPonow: 'We will send a new link',
    placeholderEmail: 'the account e-mail address',
    wyslijPonownie: 'Send again',
  },
  zgoda: {
    tytul: 'Visit statistics.',
    tresc:
      'We would like to know which parts of this page get read — it helps us improve it. Without your consent we load no analytics script at all.',
    drobne: 'This page only. The guest app has no analytics — and will not get any.',
    tak: 'I agree',
    nie: 'No thanks',
    wyslane: 'Details in the privacy policy.',
  },
  cennik: {
    eyebrow: 'Pricing',
    naglowek: 'A flat subscription. No commission on orders.',
    lede: 'You pay per venue, not per turnover. Prices are net — VAT is added at checkout.',
    miesiecznie: 'Monthly',
    rocznie: 'Yearly −17%',
    zaMiesiac: '/ mo',
    rozliczenieMiesieczne: 'billed monthly',
    rozliczenieRoczne: '{kwota} per year',
    naZawsze: 'free forever',
    wycena: 'individual quote',
    najlepszy: 'Most popular',
    oszczednoscMiesiecznie: 'Paying yearly saves you 17% — two months free.',
    oszczednoscRocznie: 'Billed yearly — two months free included.',
    notatki: [
      { tytul: 'Chain discounts:', tresc: '3–9 venues −15%, 10+ venues −25%' },
      { tytul: 'Add-ons:', tresc: '+10 tables €12 · extra language €9' },
      { tytul: 'All prices', tresc: 'are net of VAT' },
    ],
    walutaUwaga:
      'Prices in euro are for reference. Invoicing and payment currently take place in Polish złoty.',
    plany: [
      {
        id: 'menu',
        dlaKogo: 'A digital menu with a QR code, without ordering',
        cechy: ['Unlimited QR codes', '1 language, up to 10 items', 'Menu updated in a minute'],
        cta: 'Create an account',
      },
      {
        id: 'starter',
        dlaKogo: 'Café, small venue, food truck',
        cechy: [
          'Up to 12 tables, 2 languages, 50 items',
          'Table ordering, payment to the waiter',
          'Kitchen display and waiter panel',
          'Split "everyone for themselves"',
          '3 staff accounts',
        ],
        cta: 'Choose Starter',
      },
      {
        id: 'pro',
        dlaKogo: 'A restaurant with full waiter service',
        cechy: [
          'Up to 40 tables, 6 languages, unlimited menu',
          'Dish photos in the menu',
          'Bill split by item and by group',
          'Dish ratings and feedback to the manager',
          'Analytics and CSV report export',
          'Unlimited staff accounts',
          'Support within 4 hours',
        ],
        cta: 'Try 14 days',
      },
      {
        id: 'enterprise',
        dlaKogo: 'Restaurant chain, hotel, food court',
        cechy: [
          'Multiple venues, no limits',
          'Cash register and POS integration',
          'Own domain and branding',
          'Account manager and 99.9% SLA',
        ],
        cta: 'Let us talk',
      },
    ],
  },
};
