import { LOCALES, LOCALE_NAMES, localePath, type Dictionary, type Locale } from '@kelbroo/i18n';

/**
 * Przełącznik języka.
 *
 * **Zwykłe odnośniki, nie lista rozwijana i nie JavaScript.** Wyszukiwarka ma je
 * przejść, a odwiedzający ma móc otworzyć wersję w nowej karcie. Prowadzą do tej
 * samej strony w innym języku, a nie na stronę główną — inaczej czytający cennik
 * po angielsku wracałby na początek.
 *
 * Skróty zamiast pełnych nazw: pasek nawigacji ma na telefonie miejsce na trzy
 * znaki, nie na „Deutsch". Pełna nazwa idzie w `title` i w nazwie dostępnej.
 */
export function LanguageSwitcher({
  dict,
  locale,
  sciezka,
}: {
  dict: Dictionary;
  locale: Locale;
  sciezka: string;
}) {
  return (
    <div className="lang" role="group" aria-label={dict.nav.jezyk}>
      {LOCALES.map((kod) => (
        <a
          key={kod}
          href={localePath(kod, sciezka)}
          hrefLang={kod}
          title={LOCALE_NAMES[kod]}
          aria-label={LOCALE_NAMES[kod]}
          aria-current={kod === locale ? 'true' : undefined}
          className={kod === locale ? 'lang-on' : undefined}
        >
          {kod.toUpperCase()}
        </a>
      ))}
    </div>
  );
}
