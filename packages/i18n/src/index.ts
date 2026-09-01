export * from './locales';
export * from './wstaw';
export type { Dictionary, Funkcja, Krok, Pytanie, Segment } from './dictionary';

import type { Dictionary } from './dictionary';
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales';
import { pl } from './pl';
import { en } from './en';
import { de } from './de';
import { es } from './es';

const SLOWNIKI: Record<Locale, Dictionary> = { pl, en, de, es };

/**
 * Słownik dla języka.
 *
 * Nieznany kod schodzi na polski zamiast wywracać stronę — adres wpisany ręcznie
 * albo stary odnośnik ma pokazać treść, a nie błąd.
 */
export function dictionary(locale: string): Dictionary {
  return SLOWNIKI[isLocale(locale) ? locale : DEFAULT_LOCALE];
}
