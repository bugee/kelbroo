import type { Dictionary } from './dictionary';

/**
 * Polski — **wersja źródłowa**.
 *
 * Tłumaczenia powstają z niej, nie odwrotnie. Zmiana treści na stronie zaczyna
 * się tutaj; pozostałe języki dogania się w tym samym commicie, bo słownik
 * jest jednym typem i brak zdania nie skompiluje się.
 */
export const pl: Dictionary = {
  meta: {
    tytul: 'kelbroo — self-service dining',
    opis: 'Goście zamawiają z telefonu po zeskanowaniu kodu QR przy stoliku. Zamówienie trafia prosto do kuchni i do kelnera. Stały abonament, bez prowizji od zamówień.',
    ogOpis:
      'Goście zamawiają z telefonu po zeskanowaniu kodu QR przy stoliku. Bez prowizji od zamówień.',
  },
  nav: {
    jak: 'Jak to działa',
    modele: 'Płatności',
    funkcje: 'Funkcje',
    cennik: 'Cennik',
    faq: 'FAQ',
    zaloguj: 'Zaloguj się',
    wyprobuj: 'Wypróbuj 14 dni',
    stronaGlowna: 'kelbroo — strona główna',
    jezyk: 'Język',
    trybCiemny: 'Włącz tryb ciemny',
    trybJasny: 'Włącz tryb jasny',
  },
  hero: {
    eyebrow: 'Self-service dining',
    naglowekPrzed: 'Goście zamawiają z telefonu. Kelnerzy wracają ',
    naglowekAkcent: 'do gości',
    lede: 'kelbroo zamienia kod QR na stoliku w pełne menu, zamówienie i rachunek. Bez aplikacji do pobrania, bez rejestracji gościa i bez zmiany Twojej kasy fiskalnej.',
    ctaGlowne: 'Zacznij 14 dni za darmo',
    ctaDrugie: 'Zobacz demo menu',
    notatkaMocna: 'Bez karty na start.',
    notatka: 'Wdrożenie w jeden dzień.',
    scenaOpis: 'Podgląd: zamówienie gościa trafia na bon kuchenny',
  },
  makieta: {
    lokal: 'Bistro Nadwiślańskie',
    stolik: 'Stolik 12',
    dania: [
      { nazwa: 'Żurek na zakwasie', opis: 'jajko, biała kiełbasa', cena: '24,00' },
      { nazwa: 'Pierogi ruskie', opis: '8 szt., cebulka', cena: '32,00' },
      { nazwa: 'Sernik wiedeński', opis: 'sos malinowy', cena: '19,00' },
    ],
    zamawiam: 'Zamawiam',
    waluta: 'zł',
    bon: 'BON KUCHENNY',
    godzina: '18:42',
    stolikBon: 'STOLIK 12',
    bezCebulki: 'bez cebulki',
    poz: 'poz.',
    stempel: 'NA KUCHNIĘ',
  },
  segmenty: {
    restauracje: 'Restauracje',
    kawiarnie: 'Kawiarnie',
    bary: 'Bary i puby',
    hotele: 'Hotele',
    sieci: 'Sieci i food courty',
  },
  statystyki: [
    { liczba: '0 zł', opis: 'prowizji od zamówień — płacisz tylko abonament' },
    { liczba: '0 instalacji', opis: 'gość skanuje kod i zamawia w przeglądarce' },
    { liczba: '6 języków', opis: 'menu tłumaczone dla gości zagranicznych' },
    { liczba: '1 dzień', opis: 'od rejestracji do pierwszego zamówienia' },
  ],
  kroki: {
    eyebrow: 'Przy stoliku',
    naglowek: 'Cztery kroki, zero przepisywania zamówień',
    lede: 'Zamówienie idzie prosto z telefonu gościa na ekran kuchni. Nikt niczego nie notuje na kartce i nikt nie myli stolików.',
    pozycje: [
      {
        krok: 'KROK 01',
        tytul: 'Gość skanuje kod',
        tresc:
          'Kod QR na stoliku otwiera menu w przeglądarce. Bez pobierania aplikacji, bez zakładania konta.',
      },
      {
        krok: 'KROK 02',
        tytul: 'Składa zamówienie',
        tresc:
          'Wybiera dania, dodatki i uwagi. Widzi alergeny, zdjęcia i czas przygotowania — po polsku albo w swoim języku.',
      },
      {
        krok: 'KROK 03',
        tytul: 'Kuchnia widzi bon',
        tresc:
          'Zamówienie pojawia się na ekranie kuchni z numerem stolika i licznikiem czasu. Kelner może je najpierw potwierdzić przy stoliku.',
      },
      {
        krok: 'KROK 04',
        tytul: 'Kelner podaje',
        tresc:
          'Gotowe dania trafiają na listę „do wydania". Kelner zanosi je do stolika i zamyka rachunek.',
      },
    ],
  },
  modele: {
    eyebrow: 'Bez zmian u Ciebie',
    naglowek: 'Goście zamawiają z telefonu, płacą kelnerowi — jak dotąd',
    lede: 'Najczęstsza obawa restauratorów brzmi: „nie chcę zmieniać sposobu płacenia ani kasy fiskalnej". Nie musisz. kelbroo zmienia sposób zamawiania, a rozliczenie zostawia dokładnie tam, gdzie jest dzisiaj.',
    kartaTag: 'Bez opłat transakcyjnych',
    kartaTytul: 'Płatność u kelnera',
    kartaLede:
      'Goście tylko zamawiają z telefonu. Wszystko z wizyty sumuje się w jeden rachunek, który kelner rozlicza po posiłku — na Twojej kasie, Twoim terminalem.',
    zalety: [
      'Paragon wystawiasz jak dotychczas — bez integracji z kasą',
      'Zero prowizji operatora płatności',
      'Kelner może potwierdzać każde zamówienie przy stoliku',
      'Raport rozliczenia zmiany dla każdego kelnera',
    ],
    przygotowujemy:
      'Płatność gościa w aplikacji przygotowujemy — dziś rozliczenie zostaje u kelnera.',
  },
  podzial: {
    eyebrow: 'Koniec sporów o rachunek',
    naglowek: 'Każdy skanuje ten sam kod i płaci za siebie',
    lede: 'Goście przy jednym stoliku dołączają do wspólnej wizyty — każdy dostaje nick i znak rozpoznawczy, a kto chce, wpisuje własną nazwę. Bez zakładania konta. Potem rozliczają się osobno, po pozycjach, w grupach albo po równo — wspólną butelkę kelner dzieli na części jednym stuknięciem.',
    zestawienie:
      'Gdy płaci jedna osoba, każdy może wysłać sobie na e-mail zestawienie „kto co zamówił" — gotowe do rozliczenia delegacji.',
    ctaFunkcje: 'Zobacz wszystkie funkcje',
    rachunekTytul: 'Rachunek stolika',
    rachunekPodpis: 'STOLIK 12 · 4 osoby',
    goscie: [
      { nick: 'Wesoły Borsuk', dania: 'Żurek, pierogi ruskie', kwota: '56,00 zł' },
      { nick: 'Szybki Jeż', dania: 'Schabowy, kompot', kwota: '62,00 zł' },
      { nick: 'Nocna Sowa', dania: 'Sernik, espresso', kwota: '31,00 zł' },
      { nick: 'Dzielone na 3', dania: 'Wino domowe, karafka', kwota: '69,00 zł' },
    ],
    razem: 'RAZEM',
    razemKwota: '218,00 zł',
  },
  funkcje: {
    eyebrow: 'W każdym planie',
    naglowek: 'Wszystko, czego potrzebuje sala i kuchnia',
    pozycje: [
      {
        tytul: 'Menu w wielu językach',
        tresc:
          'Gość dostaje kartę w swoim języku automatycznie. Brakujące tłumaczenie zawsze zastępuje wersja polska — nigdy pusty ekran.',
      },
      {
        tytul: 'Ekran kuchni (KDS)',
        tresc:
          'Kolumny „nowe / w przygotowaniu / gotowe", licznik czasu i alarm dźwiękowy. Zamówienie czerwienieje, gdy czeka za długo.',
      },
      {
        tytul: 'Kody QR na stoliki',
        tresc:
          'Generujesz je w panelu z własnym logo i pobierasz gotowy arkusz A4 do wydruku — naklejki, stojaki albo karty.',
      },
      {
        tytul: 'Oceny dań i feedback',
        tresc:
          'Gość ocenia każde danie po posiłku. Uwaga krytyczna trafia prosto do managera — zanim wyląduje w publicznej recenzji.',
      },
      {
        tytul: 'Raporty i analityka',
        tresc:
          'Które dania sprzedają się najlepiej, które nikt nie zamawia, o której masz szczyt i ile czasu zajmuje wydanie zamówienia.',
      },
      {
        tytul: 'Kelner zamawia i poprawia',
        tresc:
          'Obsługa może złożyć zamówienie za gościa i je skorygować. W historii zawsze widać, co dodał gość, a co kelner.',
      },
      {
        tytul: 'Przesiadka bez rozliczania',
        tresc:
          'Goście przenoszą się przy inny stolik jednym kliknięciem — rachunek, zamówienia i bony w kuchni idą za nimi. Stary stolik zwalnia się od razu.',
      },
    ],
  },
  demo: {
    naglowek: 'Zobacz to oczami gościa',
    lede: 'Otwórz menu pokazowej restauracji dokładnie tak, jak zrobiłby to gość po zeskanowaniu kodu QR przy stoliku. Bez zakładania konta i bez instalowania czegokolwiek — to ta sama aplikacja, którą dostaje Twój lokal.',
    drugi:
      'Przejrzysz kartę w dwóch językach, dodasz danie do koszyka i złożysz zamówienie. Zobaczysz też, jak wygląda wspólny rachunek, gdy przy stoliku siedzi więcej osób.',
    kodPodpis: 'Zeskanuj telefonem',
    kodPodpisStuknij: 'albo stuknij, jeśli czytasz na telefonie',
    zastrzezenie:
      'Zamówienia z demo nie trafiają do żadnej kuchni. Panel obsługi i KDS pokazujemy na żywo podczas prezentacji.',
    stolikTytul: 'Bistro Widok — stolik pokazowy',
    pokazPanel: 'Pokaż mi panel kuchni',
  },
  faq: {
    eyebrow: 'Pytania restauratorów',
    naglowek: 'Zanim zapytasz',
    pozycje: [
      {
        pytanie: 'Czy goście muszą instalować aplikację?',
        odpowiedz:
          'Nie. Zeskanowanie kodu QR otwiera menu w przeglądarce telefonu — tak samo jak zwykłą stronę. Gość nie zakłada konta, nie podaje maila ani numeru telefonu.',
      },
      {
        pytanie: 'Czy muszę przyjmować płatności online?',
        odpowiedz:
          'Nie — i dziś nawet nie możesz. Goście wyłącznie zamawiają z telefonu, a płacą kelnerowi po posiłku, dokładnie jak dotychczas. Nie ponosisz żadnych opłat transakcyjnych i nic nie zmienia się w Twoim obiegu gotówki.',
      },
      {
        pytanie: 'A co z paragonami i kasą fiskalną?',
        odpowiedz:
          'W trybie płatności u kelnera paragon wystawiasz na swojej kasie, tak jak zawsze — kelbroo w ogóle nie wchodzi w fiskalizację. Przy płatnościach online dostępna jest integracja z Twoją kasą lub drukarką fiskalną.',
      },
      {
        pytanie: 'Czy to zastąpi kelnerów?',
        odpowiedz:
          'Nie. Zdejmuje z nich przyjmowanie zamówień i bieganie po terminal, więc mają czas na to, za co goście naprawdę doceniają obsługę: doradzanie, dopilnowanie stolika, rozmowę. Kelner może też sam składać zamówienia z panelu.',
      },
      {
        pytanie: 'Czy kelner może poprawić zamówienie gościa?',
        odpowiedz:
          'Tak. Może dodać pozycję, zmienić ilość albo przepisać danie na inną osobę przy stoliku. Każda zmiana zapisuje się w historii zamówienia, więc zawsze widać, co dodał gość, a co obsługa.',
      },
      {
        pytanie: 'Potrzebuję nowego sprzętu?',
        odpowiedz:
          'Wystarczy dowolny tablet, laptop lub komputer z przeglądarką. Panel kuchni i panel kelnera otwierasz pod adresem panel.kelbroo.com — działają tak samo na iPadzie, na tablecie z Androidem i na komputerze.',
      },
      {
        pytanie: 'Co się stanie, gdy padnie internet?',
        odpowiedz:
          'kelbroo wymaga połączenia — bez internetu ani gość, ani obsługa nie złożą zamówienia. Zobaczycie wtedy czytelny komunikat, a nie pusty ekran. Jeśli wi-fi w lokalu bywa zawodne, warto mieć na tablecie zapasowy internet z telefonu.',
      },
      {
        pytanie: 'Jak płacę za abonament?',
        odpowiedz:
          'Po założeniu konta wybierasz plan w panelu i płacisz BLIK-iem, przelewem albo kartą — obsługuje to PayU. Możesz zapłacić za miesiąc albo za rok (wtedy dwa miesiące taniej). Fakturę VAT wystawiamy na dane podane przy zakupie.',
      },
      {
        pytanie: 'Ile trwa wdrożenie?',
        odpowiedz:
          'Konfiguracja lokalu, wprowadzenie menu i wydruk kodów QR to zwykle jeden dzień. Możemy też wprowadzić menu za Ciebie w ramach wdrożenia „pod klucz".',
      },
    ],
  },
  kontakt: {
    naglowek: 'Porozmawiajmy',
    lede: 'Napisz, jeśli masz pytanie — albo umów prezentację, na której pokażemy panel na żywo i przejdziemy przez zamówienie od skanu kodu QR do wydania z kuchni. Odpowiadamy w ciągu jednego dnia roboczego.',
    formularzTytul: 'Wolisz napisać wprost?',
    prezentacja: 'Umów prezentację',
  },
  formularz: {
    sprawa: 'W jakiej sprawie?',
    celPytanie: 'Mam pytanie',
    celPrezentacja: 'Chcę prezentację',
    imie: 'Imię i nazwisko',
    lokal: 'Lokal lub firma',
    email: 'E-mail',
    telefon: 'Telefon',
    nieobowiazkowo: 'Nieobowiązkowo',
    kiedy: 'Kiedy najlepiej się odezwać',
    kiedyPodpowiedz: 'Np. wtorki i czwartki przed 11. Prezentacja trwa około 20 minut.',
    wiadomosc: 'Wiadomość',
    placeholderPrezentacja: 'Ile macie stolików, jak dziś przyjmujecie zamówienia, co chcecie zobaczyć?',
    placeholderPytanie: 'O co chcesz zapytać?',
    pulapka: 'Nie wypełniaj tego pola',
    wysylam: 'Wysyłam…',
    umowPrezentacje: 'Umów prezentację',
    wyslijWiadomosc: 'Wyślij wiadomość',
    zgodaAdres: 'Adres wykorzystamy wyłącznie do odpowiedzi na tę wiadomość. Szczegóły w',
    politykaLink: 'polityce prywatności',
    wyslaneTytul: 'Wiadomość wysłana',
    wyslaneTresc: 'Odezwiemy się w ciągu jednego dnia roboczego. Potwierdzenie poszło na podany adres — jeśli nie dotarło, sprawdź folder ze spamem.',
    bladOgolny: 'Nie udało się wysłać wiadomości.',
  },
  finalCta: {
    naglowek: 'Pierwsze zamówienie ze stolika jeszcze dziś',
    lede: 'Załóż konto, dodaj stoliki i menu, wydrukuj kody QR. 14 dni planu Pro bez opłat i bez podawania karty.',
    przycisk: 'Zacznij 14 dni za darmo',
    notatka: 'Bez karty · bez umowy na czas określony · bez prowizji od zamówień',
  },
  stopka: {
    opis: 'Self-service dining. Goście zamawiają z telefonu, obsługa wraca do gości.',
    produkt: 'Produkt',
    dlaKogo: 'Dla kogo',
    firma: 'Firma',
    prawne: 'Dokumenty',
    regulamin: 'Regulamin',
    prywatnosc: 'Prywatność',
    rodo: 'RODO',
    statystyki: 'Statystyki i zgoda',
    pomoc: 'Baza wiedzy',
    kontakt: 'Kontakt',
    daneFirmy: 'Dane firmy',
    demoMenu: 'Demo menu',
    platnoscUKelnera: 'Płatność u kelnera',
    prawa: 'Wszystkie prawa zastrzeżone.',
    warunki: 'Warunki współpracy opisuje regulamin, a przetwarzanie danych — polityka prywatności.',
  },
  strony: {
    dlaKogo: {
      tytul: 'Dla kogo jest kelbroo — restauracje, kawiarnie, bary, hotele, sieci',
      opis: 'Co zmienia zamawianie z telefonu w restauracji z pełną obsługą, w kawiarni, w barze, w hotelu i w sieci lokali.',
    },
    rejestracja: {
      tytul: 'Załóż konto — kelbroo',
      opis: '14 dni planu Pro bez opłat i bez podawania karty.',
    },
    potwierdz: { tytul: 'Potwierdzenie adresu — kelbroo' },
    regulamin: {
      tytul: 'Regulamin — kelbroo',
      opis: 'Warunki świadczenia usługi kelbroo dla lokali gastronomicznych.',
    },
    prywatnosc: {
      tytul: 'Polityka prywatności — kelbroo',
      opis: 'Jakie dane przetwarza kelbroo, w jakiej roli i jak długo.',
    },
  },
  dlaKogo: {
    naglowek: 'Dla kogo jest kelbroo',
    lede: 'Ten sam produkt rozwiązuje w każdym lokalu inny problem. Poniżej pięć sytuacji, w których widzieliśmy go w działaniu — z obiekcją, którą słyszymy w każdej z nich najczęściej.',
    nawigacja: 'Rodzaje lokali',
    cudzyslow: ['„', '”'],
    segmenty: [
      {
        id: 'restauracje',
        nazwa: 'Restauracje z pełną obsługą',
        kogo: 'Kelnerzy przy stolikach, karta z kilkunastoma daniami, wieczory z pełną salą.',
        obiekcja: {
          pytanie: 'Czy to znaczy, że muszę zmienić sposób przyjmowania płatności?',
          odpowiedz:
            'Nie. Możesz zostawić dokładnie ten obieg, który masz: gość zamawia z telefonu, a płaci kelnerowi po posiłku — na Twoim terminalu i Twojej kasie fiskalnej. W tym trybie nie ma żadnych opłat transakcyjnych, płacisz wyłącznie abonament.',
        },
        korzysci: [
          {
            tytul: 'Kelner przestaje biegać po zamówienia',
            opis: 'Zamówienie idzie ze stolika prosto na ekran kuchni. Obsługa zostaje przy tym, za co goście naprawdę doceniają lokal: doradzaniu i dopilnowaniu stolika.',
          },
          {
            tytul: 'Możesz zatwierdzać każde zamówienie',
            opis: 'Jeśli wolisz, żeby nic nie trafiało na kuchnię bez kelnera, włącz potwierdzanie przy stoliku. Zamówienie czeka w kolejce, dopóki obsługa go nie przyjmie.',
          },
          {
            tytul: 'Jeden rachunek na stolik, nawet gdy telefonów jest sześć',
            opis: 'Wszyscy przy stoliku dokładają do wspólnego rachunku i widzą, kto co zamówił. Na koniec dzielicie go po osobach, po pozycjach albo po równo.',
          },
        ],
        akcja: 'demo',
        ctaEtykieta: 'Zobacz to oczami gościa',
      },
      {
        id: 'kawiarnie',
        nazwa: 'Kawiarnie i lokale przy ladzie',
        kogo: 'Szybki obrót, kolejka do lady, dwie osoby na zmianie.',
        obiekcja: {
          pytanie: 'Mam małą kartę i dwie osoby na zmianie — czy to nie za duży system?',
          odpowiedz:
            'Konfiguracja to jeden dzień: wpisujesz kartę, drukujesz kody QR i tyle. Plan Starter obejmuje do 12 stolików. Możesz też zacząć od samego cyfrowego menu, bez zamawiania.',
        },
        korzysci: [
          {
            tytul: 'Gość zamawia od stolika, nie z kolejki',
            opis: 'Kolejka do lady przestaje być wąskim gardłem w godzinach szczytu — a osoba przy ekspresie nie przerywa co chwilę, żeby przyjąć zamówienie.',
          },
          {
            tytul: 'Zmiana karty zajmuje minutę',
            opis: 'Ciasto się skończyło? Wyłączasz pozycję w panelu i znika z menu wszystkich gości od razu. Bez przedrukowywania czegokolwiek.',
          },
          {
            tytul: 'Kody QR drukujesz sam',
            opis: 'Panel generuje arkusz do wydrukowania na zwykłej drukarce. Bez zamawiania i czekania.',
          },
        ],
        akcja: 'cennik',
        ctaEtykieta: 'Zobacz cennik',
      },
      {
        id: 'bary',
        nazwa: 'Bary i puby',
        kogo: 'Głośne wieczory, dużo dokładek, rachunki dzielone na końcu.',
        obiekcja: {
          pytanie: 'U mnie wieczorem nikt nie będzie się bawił w telefon.',
          odpowiedz:
            'Zwykle jest odwrotnie: przy głośnej muzyce przekrzykiwanie zamówienia to największa uciążliwość wieczoru. Kolejna kolejka idzie jednym stuknięciem, a kelner nie musi wracać po nic dwa razy.',
        },
        korzysci: [
          {
            tytul: 'Dokładka bez szukania obsługi',
            opis: 'To samo, co ostatnio, jednym stuknięciem — a wezwanie kelnera zajmuje jedno kliknięcie i widać, że kelner już idzie.',
          },
          {
            tytul: 'Rachunek dzieli się sam',
            opis: 'Na koniec wieczoru każdy widzi, co zamawiał. Podział po pozycjach, po osobach albo po równo — bez liczenia na serwetce.',
          },
          {
            tytul: 'Limit otwartego rachunku',
            opis: 'Ustawiasz kwotę, po której stolik musi się rozliczyć, zanim zamówi więcej. Wieczór nie kończy się niespodzianką.',
          },
        ],
        akcja: 'demo',
        ctaEtykieta: 'Zobacz to oczami gościa',
      },
      {
        id: 'hotele',
        nazwa: 'Hotele',
        kogo: 'Śniadania, restauracja hotelowa, goście mówiący w kilku językach.',
        obiekcja: {
          pytanie: 'Połowa moich gości nie mówi po polsku.',
          odpowiedz:
            'Menu prowadzisz w kilku językach naraz, a gość dostaje swój po ustawieniu telefonu. Brak tłumaczenia nigdy nie daje pustego ekranu — pokazujemy wtedy wersję w języku domyślnym lokalu.',
        },
        korzysci: [
          {
            tytul: 'Menu wielojęzyczne bez osobnych kart',
            opis: 'Jedna karta, kilka wersji językowych. Zmiana ceny w jednym miejscu przechodzi na wszystkie języki.',
          },
          {
            tytul: 'Alergeny i składy przy każdej pozycji',
            opis: 'Gość sprawdza je sam, bez pytania obsługi i bez tłumaczenia przez recepcję.',
          },
          {
            tytul: 'Kody QR wszędzie tam, gdzie jest stolik',
            opis: 'Restauracja, lobby, taras. Każdy stolik ma własny kod, więc zamówienie od razu wiadomo, dokąd zanieść.',
          },
        ],
        akcja: 'prezentacja',
        ctaEtykieta: 'Umów prezentację',
      },
      {
        id: 'sieci',
        nazwa: 'Sieci i food courty',
        kogo: 'Kilka lokali pod jedną marką, wspólne raportowanie, własne procedury.',
        obiekcja: {
          pytanie: 'Mamy własny system POS i procedury, których nie będziemy zmieniać.',
          odpowiedz:
            'Rozmawiamy o tym przed wdrożeniem, nie po. Wdrożenia dla sieci prowadzimy indywidualnie — z integracją po Waszej stronie, wspólnym cennikiem i osobnym opiekunem. Plan Enterprise jest wyceniany do zakresu.',
        },
        korzysci: [
          {
            tytul: 'Wdrożenie prowadzone przez człowieka',
            opis: 'Wprowadzenie karty, wydruk i montaż kodów, szkolenie obsługi. Nie zostawiamy sieci z panelem i instrukcją.',
          },
          {
            tytul: 'Jedna karta, wiele lokali',
            opis: 'Zakres i sposób podziału ustalamy przy wdrożeniu — inaczej wygląda to w food courcie, a inaczej w sieci z jednym menu na wszystkie punkty.',
          },
          {
            tytul: 'Rozmowa przed podpisem',
            opis: 'Pokazujemy panel na żywo i przechodzimy przez Wasz scenariusz, zanim cokolwiek zamawiacie.',
          },
        ],
        akcja: 'prezentacja',
        ctaEtykieta: 'Umów prezentację',
      },
    ],
    band: {
      naglowek: 'Nie ma tu Twojego lokalu?',
      tresc: 'Napisz, jak u Ciebie wygląda przyjmowanie zamówień. Powiemy wprost, czy kelbroo coś zmieni, czy nie warto.',
      napisz: 'Napisz do nas',
      zacznij: 'Zacznij za darmo',
      drobne: '14 dni planu Pro bez opłat i bez podawania karty',
    },
  },
  rejestracjaStrona: {
    naglowek: 'Załóż konto',
    lede: '14 dni planu Pro bez opłat i bez podawania karty. Konto zakładasz dla jednego lokalu — kolejne dodasz później.',
  },
  rejestracjaForm: {
    nazwaLokalu: 'Nazwa lokalu',
    imie: 'Imię i nazwisko',
    nip: 'NIP',
    nipPodpowiedz: 'Dziesięć cyfr. Usługa jest wyłącznie dla firm.',
    email: 'E-mail',
    haslo: 'Hasło',
    hasloPodpowiedz: 'Co najmniej {min} znaków.',
    bledy: {
      nazwaLokalu: 'Podaj nazwę lokalu.',
      imie: 'Podaj imię i nazwisko.',
      email: 'To nie wygląda na poprawny adres e-mail.',
      haslo: 'Hasło musi mieć co najmniej {min} znaków.',
      nip: 'Sprawdź numer NIP — te cyfry się nie zgadzają.',
    },
    zgodaRegulamin: 'Akceptuję {link} usługi kelbroo.',
    zgodaPrywatnosc: 'Zapoznałem się z {link}.',
    zakladam: 'Zakładam konto…',
    zacznij: 'Zacznij 14 dni za darmo',
    bladOgolny: 'Nie udało się założyć konta. Spróbuj ponownie.',
    sukcesTytul: 'Sprawdź skrzynkę',
    sukcesKonto: 'Konto dla „{nazwa}” jest założone. Wysłaliśmy wiadomość na adres:',
    sukcesKlik: 'Kliknij w odnośnik z wiadomości, żeby potwierdzić adres i wejść do panelu.',
    sukcesSpam: 'Wiadomość nie dotarła? Sprawdź spam albo napisz na kontakt@kelbroo.com.',
  },
  potwierdzenie: {
    sprawdzam: 'Sprawdzam odnośnik…',
    bladNiekompletny: 'Ten odnośnik jest niekompletny.',
    bladOgolny: 'Nie udało się potwierdzić.',
    gotoweTytul: 'Adres potwierdzony',
    gotoweTresc: 'Możesz zalogować się do panelu i dodać pierwsze pozycje karty.',
    doPanelu: 'Przejdź do panelu',
    nieudaneTytul: 'Nie udało się potwierdzić',
    ponowioneInfo: 'Jeśli konto z tym adresem istnieje, nowy odnośnik już do niego poszedł.',
    etykietaPonow: 'Wyślemy nowy odnośnik',
    placeholderEmail: 'adres e-mail konta',
    wyslijPonownie: 'Wyślij ponownie',
  },
  zgoda: {
    tytul: 'Statystyki odwiedzin.',
    tresc:
      'Chcemy wiedzieć, które części tej strony są czytane — pomaga nam to ją poprawiać. Bez Twojej zgody nie uruchamiamy żadnego skryptu analitycznego.',
    drobne:
      'Dotyczy wyłącznie tej strony. Aplikacja dla gości nie ma analityki — i mieć nie będzie.',
    tak: 'Zgadzam się',
    nie: 'Nie zgadzam się',
    wyslane: 'Szczegóły w polityce prywatności.',
  },
  cennik: {
    eyebrow: 'Cennik',
    naglowek: 'Stały abonament. Zero prowizji od zamówień.',
    lede: 'Płacisz za lokal, nie za obrót. Ceny netto — do zapłaty doliczamy VAT.',
    miesiecznie: 'Miesięcznie',
    rocznie: 'Rocznie −17%',
    zaMiesiac: '/ mies.',
    rozliczenieMiesieczne: 'rozliczenie miesięczne',
    rozliczenieRoczne: '{kwota} rocznie',
    naZawsze: 'na zawsze za darmo',
    wycena: 'wycena indywidualna',
    najlepszy: 'Najczęściej wybierany',
    oszczednoscMiesiecznie: 'Przy płatności rocznej oszczędzasz 17% — dwa miesiące gratis.',
    oszczednoscRocznie: 'Rozliczenie roczne — dwa miesiące gratis w cenie.',
    notatki: [
      { tytul: 'Rabaty dla sieci:', tresc: '3–9 lokali −15%, 10+ lokali −25%' },
      { tytul: 'Dodatki:', tresc: '+10 stolików 49 zł · dodatkowy język 39 zł' },
      { tytul: 'Do wszystkich cen', tresc: 'doliczamy VAT' },
    ],
    walutaUwaga: '',
    plany: [
      {
        id: 'menu',
        dlaKogo: 'Cyfrowa karta z kodem QR, bez zamawiania',
        cechy: ['Kody QR bez limitu', '1 język, do 10 pozycji', 'Aktualizacja karty w minutę'],
        cta: 'Załóż konto',
      },
      {
        id: 'starter',
        dlaKogo: 'Kawiarnia, mały lokal, food truck',
        cechy: [
          'Do 12 stolików, 2 języki, 50 pozycji',
          'Zamawianie do stolika, płatność u kelnera',
          'Ekran kuchni i panel kelnera',
          'Podział „każdy za siebie”',
          '3 konta personelu',
        ],
        cta: 'Wybierz Starter',
      },
      {
        id: 'pro',
        dlaKogo: 'Restauracja z pełną obsługą kelnerską',
        cechy: [
          'Do 40 stolików, 6 języków, karta bez limitu',
          'Zdjęcia dań w karcie',
          'Podział rachunku po pozycjach i grupami',
          'Oceny dań i feedback do managera',
          'Analityka i eksport raportów do CSV',
          'Konta personelu bez limitu',
          'Wsparcie w 4 godziny',
        ],
        cta: 'Testuj 14 dni',
      },
      {
        id: 'enterprise',
        dlaKogo: 'Sieć restauracji, hotel, food court',
        cechy: [
          'Wiele lokali, bez limitów',
          'Integracja z kasą fiskalną i POS',
          'Własna domena i branding',
          'Opiekun klienta i SLA 99,9%',
        ],
        cta: 'Porozmawiajmy',
      },
    ],
  },
};
