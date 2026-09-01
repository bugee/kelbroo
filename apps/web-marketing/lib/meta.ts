import type { Metadata } from 'next';
import { DEFAULT_LOCALE, LOCALES, LOCALE_TAGS, localePath, type Locale } from '@kelbroo/i18n';

/**
 * Odnośniki `hreflang` dla jednej strony we wszystkich językach.
 *
 * `sciezka` podajemy **bez przedrostka języka** — taką, jaka stoi w polskiej
 * wersji. Adres kanoniczny wskazuje na bieżący język, a `x-default` na polski,
 * bo to on siedzi w korzeniu i to on trafił do wysłanych wiadomości.
 *
 * Bez tego cztery wersje tej samej strony konkurują ze sobą w wyszukiwarce
 * zamiast się uzupełniać.
 */
export function alternatywy(locale: Locale, sciezka: string): Metadata['alternates'] {
  return {
    canonical: localePath(locale, sciezka),
    languages: {
      ...Object.fromEntries(LOCALES.map((kod) => [LOCALE_TAGS[kod], localePath(kod, sciezka)])),
      'x-default': localePath(DEFAULT_LOCALE, sciezka),
    },
  };
}
