/**
 * Spis artykułów bazy wiedzy.
 *
 * Kolejność jest ułożona ręcznie, nie alfabetycznie: baza wiedzy czytana od góry
 * ma prowadzić od założenia konta do pierwszego zamówienia, a dopiero potem
 * rozgałęziać się na tematy szczegółowe.
 *
 * Tytuły i opisy stoją tutaj, a nie w plikach markdown, bo spis musi je znać
 * bez czytania i parsowania sześciu plików przy każdym budowaniu strony.
 */
export interface Artykul {
  slug: string;
  tytul: string;
  /** Jedno zdanie na kafelku spisu — po czym poznać, że to ten artykuł. */
  opis: string;
}

export const ARTYKULY: Artykul[] = [
  {
    slug: 'pierwsze-kroki',
    tytul: 'Pierwsze kroki',
    opis: 'Od założenia konta do pierwszego zamówienia ze stolika — sześć kroków na jeden dzień.',
  },
  {
    slug: 'menu',
    tytul: 'Karta menu',
    opis: 'Kategorie i dania, „skończyło się" kontra wycofanie z karty, ceny, VAT, języki i alergeny.',
  },
  {
    slug: 'stoliki-i-kody-qr',
    tytul: 'Stoliki i kody QR',
    opis: 'Dodawanie stolików, wydruk arkusza, wymiana kodu i podgląd menu oczami gościa.',
  },
  {
    slug: 'obsluga-zamowien',
    tytul: 'Obsługa zamówień na zmianie',
    opis: 'Trzy ekrany pracy: Powiadomienia, Kuchnia i Sala — co robi każdy z nich.',
  },
  {
    slug: 'zespol',
    tytul: 'Konta pracowników',
    opis: 'Cztery role i ich zakresy, zakładanie kont, odejście pracownika, reset hasła.',
  },
  {
    slug: 'abonament',
    tytul: 'Abonament i faktury',
    opis: 'Okres próbny, zakup, faktury VAT i co dokładnie dzieje się po wygaśnięciu.',
  },
];

export const znajdzArtykul = (slug: string): Artykul | undefined =>
  ARTYKULY.find((artykul) => artykul.slug === slug);
