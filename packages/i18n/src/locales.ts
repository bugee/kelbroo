/**
 * Języki strony produktowej.
 *
 * **Polski nie ma przedrostka w adresie** i to jest decyzja, nie przeoczenie:
 * `kelbroo.com/regulamin` widnieje w wysłanych wiadomościach, w dokumentach
 * prawnych i w zgodach, na które klienci już się zgodzili. Przeniesienie go
 * pod `/pl/regulamin` zerwałoby te odnośniki.
 *
 * Panel obsługi i aplikacja gościa **nie są tu objęte** — te tłumaczą się
 * inaczej: menu przez treść w bazie, panel na razie wcale.
 */
export const LOCALES = ['pl', 'en', 'de', 'es'] as const;

export type Locale = (typeof LOCALES)[number];

/** Domyślny język. Serwowany z korzenia, bez przedrostka. */
export const DEFAULT_LOCALE: Locale = 'pl';

/** Języki, które dostają własny przedrostek w adresie. */
export const PREFIXED_LOCALES = LOCALES.filter(
  (locale): locale is Exclude<Locale, 'pl'> => locale !== DEFAULT_LOCALE,
);

/** Nazwa języka w nim samym — tak, jak szuka go czytający. */
export const LOCALE_NAMES: Record<Locale, string> = {
  pl: 'Polski',
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
};

/** Kod dla `<html lang>` i `hreflang`. */
export const LOCALE_TAGS: Record<Locale, string> = {
  pl: 'pl-PL',
  en: 'en',
  de: 'de',
  es: 'es',
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Adres tej samej strony w innym języku.
 *
 * `sciezka` jest **bez przedrostka języka** — taka, jaka stoi w polskiej wersji.
 */
export function localePath(locale: Locale, sciezka: string): string {
  const czysta = sciezka === '/' ? '' : sciezka;
  return locale === DEFAULT_LOCALE ? czysta || '/' : `/${locale}${czysta}`;
}
