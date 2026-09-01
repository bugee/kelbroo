/**
 * Kształt słownika strony produktowej.
 *
 * Jeden typ dla wszystkich języków: brakujące zdanie jest wtedy **błędem
 * kompilacji**, a nie pustym miejscem odkrytym przez odwiedzającego. To ta sama
 * zasada, którą trzyma się menu gościa — z tą różnicą, że tam brak tłumaczenia
 * ma fallback na język lokalu, a tutaj nie ma czego podstawić: strona sprzedaje.
 */

export interface Krok {
  krok: string;
  tytul: string;
  tresc: string;
}

export interface Funkcja {
  tytul: string;
  tresc: string;
}

export interface Pytanie {
  pytanie: string;
  odpowiedz: string;
}

export interface Segment {
  id: 'restauracje' | 'kawiarnie' | 'bary' | 'hotele' | 'sieci';
  nazwa: string;
  /** Zdanie, które ma w kimś kliknąć: „to jest o mnie". */
  kogo: string;
  /** Najczęstsza obiekcja tego segmentu, nazwana wprost. */
  obiekcja: { pytanie: string; odpowiedz: string };
  korzysci: { tytul: string; opis: string }[];
  /** Dokąd prowadzi przycisk — adres składa strona, nie słownik. */
  akcja: 'demo' | 'cennik' | 'prezentacja';
  ctaEtykieta: string;
}

export interface Dictionary {
  meta: {
    tytul: string;
    opis: string;
    ogOpis: string;
  };
  nav: {
    jak: string;
    modele: string;
    funkcje: string;
    cennik: string;
    faq: string;
    zaloguj: string;
    wyprobuj: string;
    stronaGlowna: string;
    jezyk: string;
    /** Etykiety przełącznika palety — czytnik ekranu i dymek. */
    trybCiemny: string;
    trybJasny: string;
  };
  hero: {
    eyebrow: string;
    naglowekPrzed: string;
    naglowekAkcent: string;
    lede: string;
    ctaGlowne: string;
    ctaDrugie: string;
    notatkaMocna: string;
    notatka: string;
    scenaOpis: string;
  };
  /** Makieta telefonu i bonu w hero. Tłumaczona, bo inaczej nic nie pokazuje. */
  makieta: {
    lokal: string;
    stolik: string;
    dania: { nazwa: string; opis: string; cena: string }[];
    zamawiam: string;
    waluta: string;
    bon: string;
    godzina: string;
    stolikBon: string;
    bezCebulki: string;
    poz: string;
    /** Pieczątka na bonie: „poszło na kuchnię". */
    stempel: string;
  };
  /** Nazwy segmentów — używane w stopce i na stronie „dla kogo". */
  segmenty: {
    restauracje: string;
    kawiarnie: string;
    bary: string;
    hotele: string;
    sieci: string;
  };
  statystyki: { liczba: string; opis: string }[];
  kroki: {
    eyebrow: string;
    naglowek: string;
    lede: string;
    pozycje: Krok[];
  };
  modele: {
    eyebrow: string;
    naglowek: string;
    lede: string;
    kartaTag: string;
    kartaTytul: string;
    kartaLede: string;
    zalety: string[];
    przygotowujemy: string;
  };
  podzial: {
    eyebrow: string;
    naglowek: string;
    lede: string;
    zestawienie: string;
    ctaFunkcje: string;
    rachunekTytul: string;
    rachunekPodpis: string;
    goscie: { nick: string; dania: string; kwota: string }[];
    razem: string;
    razemKwota: string;
  };
  funkcje: {
    eyebrow: string;
    naglowek: string;
    pozycje: Funkcja[];
  };
  demo: {
    naglowek: string;
    lede: string;
    drugi: string;
    kodPodpis: string;
    kodPodpisStuknij: string;
    zastrzezenie: string;
    stolikTytul: string;
    pokazPanel: string;
  };
  faq: {
    eyebrow: string;
    naglowek: string;
    pozycje: Pytanie[];
  };
  kontakt: {
    naglowek: string;
    lede: string;
    formularzTytul: string;
    prezentacja: string;
  };
  /** Formularz kontaktowy — na stronie głównej i pod „umów prezentację". */
  formularz: {
    sprawa: string;
    celPytanie: string;
    celPrezentacja: string;
    imie: string;
    lokal: string;
    email: string;
    telefon: string;
    nieobowiazkowo: string;
    kiedy: string;
    kiedyPodpowiedz: string;
    wiadomosc: string;
    placeholderPrezentacja: string;
    placeholderPytanie: string;
    pulapka: string;
    wysylam: string;
    umowPrezentacje: string;
    wyslijWiadomosc: string;
    zgodaAdres: string;
    politykaLink: string;
    wyslaneTytul: string;
    wyslaneTresc: string;
    bladOgolny: string;
  };
  finalCta: {
    naglowek: string;
    lede: string;
    przycisk: string;
    notatka: string;
  };
  stopka: {
    opis: string;
    produkt: string;
    dlaKogo: string;
    firma: string;
    prawne: string;
    regulamin: string;
    prywatnosc: string;
    rodo: string;
    statystyki: string;
    pomoc: string;
    kontakt: string;
    daneFirmy: string;
    demoMenu: string;
    platnoscUKelnera: string;
    prawa: string;
    warunki: string;
  };
  /** Tytuły i opisy podstron — jeden komplet na język. */
  strony: {
    dlaKogo: { tytul: string; opis: string };
    rejestracja: { tytul: string; opis: string };
    potwierdz: { tytul: string };
    regulamin: { tytul: string; opis: string };
    prywatnosc: { tytul: string; opis: string };
  };
  /** Strona „Dla kogo jest kelbroo". */
  dlaKogo: {
    naglowek: string;
    lede: string;
    nawigacja: string;
    /** Cudzysłów w danym języku: polski „…", angielski "…", hiszpański «…». */
    cudzyslow: [string, string];
    segmenty: Segment[];
    band: {
      naglowek: string;
      tresc: string;
      napisz: string;
      zacznij: string;
      drobne: string;
    };
  };
  /** Strona zakładania konta. Sam formularz siedzi w `rejestracjaForm`. */
  rejestracjaStrona: {
    naglowek: string;
    lede: string;
  };
  /** Formularz zakładania konta. */
  rejestracjaForm: {
    nazwaLokalu: string;
    imie: string;
    nip: string;
    nipPodpowiedz: string;
    email: string;
    haslo: string;
    /** Szablon ze znacznikiem `{min}`. */
    hasloPodpowiedz: string;
    bledy: {
      nazwaLokalu: string;
      imie: string;
      email: string;
      haslo: string;
      nip: string;
    };
    /** Zdanie zgody z odnośnikiem w środku — `{link}` zastępuje nazwę dokumentu. */
    zgodaRegulamin: string;
    zgodaPrywatnosc: string;
    zakladam: string;
    zacznij: string;
    bladOgolny: string;
    sukcesTytul: string;
    /** Szablon ze znacznikiem `{nazwa}`. */
    sukcesKonto: string;
    sukcesKlik: string;
    sukcesSpam: string;
  };
  /** Ekran, na który prowadzi odnośnik z wiadomości potwierdzającej. */
  potwierdzenie: {
    sprawdzam: string;
    bladNiekompletny: string;
    bladOgolny: string;
    gotoweTytul: string;
    gotoweTresc: string;
    doPanelu: string;
    nieudaneTytul: string;
    ponowioneInfo: string;
    etykietaPonow: string;
    placeholderEmail: string;
    wyslijPonownie: string;
  };
  zgoda: {
    tytul: string;
    tresc: string;
    drobne: string;
    tak: string;
    nie: string;
    wyslane: string;
  };
  cennik: {
    eyebrow: string;
    naglowek: string;
    lede: string;
    miesiecznie: string;
    rocznie: string;
    zaMiesiac: string;
    rozliczenieMiesieczne: string;
    /** Szablon ze znacznikiem `{kwota}` — podstawia `wstaw`. */
    rozliczenieRoczne: string;
    naZawsze: string;
    wycena: string;
    najlepszy: string;
    oszczednoscMiesiecznie: string;
    oszczednoscRocznie: string;
    notatki: { tytul: string; tresc: string }[];
    /** Zdanie o walucie rozliczenia — puste dla polskiej wersji. */
    walutaUwaga: string;
    plany: {
      id: 'menu' | 'starter' | 'pro' | 'enterprise';
      dlaKogo: string;
      cechy: string[];
      cta: string;
    }[];
  };
}
