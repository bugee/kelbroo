'use client';

import { useCallback, useEffect, useState } from 'react';
import Script from 'next/script';

const GA_ID = 'G-95ZTN8BFXJ';
const KLUCZ = 'kelbroo.zgoda.analityka';

/**
 * ⚠️ TYMCZASOWE — do usunięcia po weryfikacji usługi w Google.
 *
 * Google przy zakładaniu usługi GA4 sprawdza, czy znacznik jest obecny na
 * stronie, i nie klika przy tym w żaden baner. Dopóki ta stała jest `true`,
 * analityka rusza **bez zgody**, a baner się nie pokazuje.
 *
 * **Baner znika razem z bramką i to jest celowe.** Baner, który pyta o zgodę,
 * a potem jej nie respektuje, jest gorszy od jego braku: mówi odwiedzającemu
 * nieprawdę i sam w sobie jest naruszeniem, przed którym miał chronić.
 *
 * **Ten stan ma trwać godziny, nie tygodnie.** Przez ten czas strona produktowa
 * zbiera statystyki bez zgody, a polityka prywatności §3 mówi, że nie używamy
 * narzędzi śledzących. Przywrócenie: `false` i tyle. Zadanie zapisane
 * w docs/todo.md, żeby nie zostało tu na stałe.
 */
const POMIN_ZGODE = true;

/** Zdarzenie, którym stopka otwiera baner ponownie. */
export const ZDARZENIE_USTAWIENIA = 'kelbroo:ustawienia-prywatnosci';

type Zgoda = 'tak' | 'nie' | null;

function odczytaj(): Zgoda {
  try {
    const zapisana = localStorage.getItem(KLUCZ);
    return zapisana === 'tak' || zapisana === 'nie' ? zapisana : null;
  } catch {
    // Okno prywatne albo zablokowane dane witryny. Brak pamięci znaczy brak
    // zgody — pytamy ponownie, zamiast zakładać cokolwiek.
    return null;
  }
}

/**
 * Analityka strony produktowej, uruchamiana **dopiero po zgodzie**.
 *
 * Dwie rzeczy są tu celowe i warto je znać przed zmianą.
 *
 * **Bez zgody nie ładujemy żadnego skryptu** — nie samo blokowanie ciasteczek
 * przez tryb zgody Google'a, tylko brak skryptu w ogóle. Tryb zgody i tak
 * wysyłałby bezciasteczkowe sygnały do Google'a, a to wciąż jest wysyłanie
 * danych o kimś, kto się na nic nie zgodził. Przy produkcie, który obiecuje
 * gościom brak śledzenia, drobiazgowość jest tu na miejscu.
 *
 * **Tylko strona produktowa.** Panele i aplikacja gościa nie mają analityki
 * i mieć nie będą: polityka prywatności obiecuje gościowi jeden techniczny
 * token i żadnych narzędzi śledzących.
 *
 * Ładujemy wyłącznie w produkcji — inaczej `next dev` i testy e2e dopisywałyby
 * się do statystyk, a fałszywe dane są gorsze niż ich brak.
 */
export function Analytics() {
  const [zgoda, setZgoda] = useState<Zgoda>(null);
  const [wczytane, setWczytane] = useState(false);

  useEffect(() => {
    setZgoda(odczytaj());
    setWczytane(true);
  }, []);

  useEffect(() => {
    const otworz = () => setZgoda(null);
    window.addEventListener(ZDARZENIE_USTAWIENIA, otworz);
    return () => window.removeEventListener(ZDARZENIE_USTAWIENIA, otworz);
  }, []);

  const zdecyduj = useCallback((wybor: 'tak' | 'nie') => {
    try {
      localStorage.setItem(KLUCZ, wybor);
    } catch {
      // Brak pamięci nie może zablokować decyzji — zadziała na tę wizytę.
    }
    setZgoda(wybor);
  }, []);

  // Do pierwszego odczytu pamięci nie pokazujemy niczego. Baner mignięty
  // i zniknięty komuś, kto już zdecydował, jest gorszy od banera z opóźnieniem.
  if (!wczytane) return null;

  // Poza produkcją nie ładujemy nigdy — `next dev` i testy e2e nie mają czego
  // dopisywać do statystyk. Weryfikacji Google to nie przeszkadza, bo ona
  // odbywa się na żywej stronie.
  const analitykaWlaczona =
    process.env.NODE_ENV === 'production' && (POMIN_ZGODE || zgoda === 'tak');

  return (
    <>
      {analitykaWlaczona && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
          </Script>
        </>
      )}

      {!POMIN_ZGODE && zgoda === null && (
        <div className="zgoda" role="dialog" aria-label="Zgoda na analitykę">
          <div className="zgoda-tresc">
            <p>
              <strong>Statystyki odwiedzin.</strong> Chcemy wiedzieć, które części tej strony są
              czytane — pomaga nam to ją poprawiać. Bez Twojej zgody nie uruchamiamy żadnego skryptu
              analitycznego.
            </p>
            <p className="zgoda-drobne">
              Dotyczy wyłącznie tej strony. <strong>Aplikacja dla gości nie ma analityki</strong> —
              i mieć nie będzie. Szczegóły w <a href="/prywatnosc">polityce prywatności</a>.
            </p>
          </div>
          <div className="zgoda-akcje">
            <button type="button" className="btn btn-ghost" onClick={() => zdecyduj('nie')}>
              Nie zgadzam się
            </button>
            <button type="button" className="btn btn-primary" onClick={() => zdecyduj('tak')}>
              Zgadzam się
            </button>
          </div>
        </div>
      )}
    </>
  );
}
