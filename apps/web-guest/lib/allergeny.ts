/**
 * Zdanie, które gość widzi przy daniu bez wpisanych alergenów.
 *
 * **Nie milczymy.** Puste pole w panelu nie znaczy „to danie nie ma alergenów",
 * tylko „nikt ich tu nie wpisał" — a gość z uczuleniem, który nie widzi nic,
 * ma prawo odczytać to jako brak alergenów. Dlatego zamiast pustego miejsca
 * stoi tam odesłanie do obsługi.
 *
 * Aplikacja gościa nie jest tłumaczona (CLAUDE.md) i to jest **jedyny wyjątek**:
 * karta bywa prowadzona w kilku językach, a informacja o alergenach ma trafić
 * do kogoś, kto w razie uczulenia musi ją zrozumieć. Jedno zdanie na język jest
 * tańsze niż tłumaczenie całej aplikacji i rozwiązuje właśnie ten przypadek.
 *
 * Języki lokal wpisuje sam, dowolnym kodem, więc listy nie da się domknąć.
 * Brakujący kod schodzi na angielski — dla gościa czytającego kartę w języku,
 * którego tu nie ma, angielski jest bliżej niż polski.
 */
const ODESLANIE: Record<string, string> = {
  pl: 'Listę alergenów tego dania poda obsługa — zapytaj kelnera.',
  en: 'Ask our staff for this dish’s allergen list.',
  de: 'Die Allergenliste zu diesem Gericht nennt Ihnen unser Personal — fragen Sie bitte nach.',
  es: 'Pregunta al personal por la lista de alérgenos de este plato.',
  fr: 'Demandez au personnel la liste des allergènes de ce plat.',
  it: 'Chiedi al personale l’elenco degli allergeni di questo piatto.',
  uk: 'Перелік алергенів цієї страви підкаже персонал — запитайте офіціанта.',
  cs: 'Seznam alergenů k tomuto jídlu vám sdělí obsluha — zeptejte se.',
  sk: 'Zoznam alergénov k tomuto jedlu vám povie obsluha — opýtajte sa.',
};

/** Etykieta listy alergenów, w tym samym języku co odesłanie. */
const ETYKIETA: Record<string, string> = {
  pl: 'Alergeny',
  en: 'Allergens',
  de: 'Allergene',
  es: 'Alérgenos',
  fr: 'Allergènes',
  it: 'Allergeni',
  uk: 'Алергени',
  cs: 'Alergeny',
  sk: 'Alergény',
};

const wJezyku = (slownik: Record<string, string>, locale: string): string =>
  slownik[locale] ?? slownik[locale.split('-')[0] ?? ''] ?? slownik.en!;

export const odeslanieDoObslugi = (locale: string): string => wJezyku(ODESLANIE, locale);
export const etykietaAlergenow = (locale: string): string => wJezyku(ETYKIETA, locale);
