'use client';

import { useEffect, useState } from 'react';
import type { Dictionary } from '@kelbroo/i18n';
import { KLUCZ_MOTYWU } from './ThemeScript';

/**
 * Przełącznik palety na stronie produktowej.
 *
 * Bliźniak `ThemeToggle` z `packages/ui`, a nie ten sam komponent: tamten jest
 * ubrany w klasy Tailwinda, a strona produktowa stoi na własnym arkuszu
 * (`landing.css`) i nie zależy od `@kelbroo/ui`. Wciągnięcie tamtego pakietu
 * po jeden przycisk oznaczałoby Tailwinda w statycznej stronie i zmianę
 * obrazu w Dockerze — więcej niż warte są cztery wspólne linie.
 *
 * **Trzy stany, nie dwa.** Brak zapisanego wyboru znaczy „jak w systemie":
 * paletę wybiera wtedy `prefers-color-scheme` z arkusza. Dopiero kliknięcie
 * zapisuje decyzję, a ta wygrywa z systemem w obie strony.
 */
type Motyw = 'light' | 'dark';

function zapisany(): Motyw | null {
  try {
    const wartosc = localStorage.getItem(KLUCZ_MOTYWU);
    return wartosc === 'dark' || wartosc === 'light' ? wartosc : null;
  } catch {
    // Prywatne okno albo zablokowane dane witryny — działamy bez zapamiętywania.
    return null;
  }
}

const systemowy = (): Motyw =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const SLONCE = (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>
);

const KSIEZYC = <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />;

export function ThemeToggle({ dict }: { dict: Dictionary }) {
  // Serwer nie zna ani wyboru zapisanego w przeglądarce, ani ustawienia
  // systemu, więc do czasu montażu rysujemy przycisk bez ikony — inaczej React
  // zgłosiłby niezgodność hydratacji, a ikona i tak mrugnęłaby na złą.
  const [motyw, setMotyw] = useState<Motyw | null>(null);

  useEffect(() => {
    setMotyw(zapisany() ?? systemowy());

    // Dopóki wybór nie jest zapisany, paleta chodzi za systemem — a więc ikona
    // też musi. Bez tego ktoś przełącza motyw w systemie, strona zmienia kolory,
    // a przycisk dalej pokazuje poprzedni stan i proponuje to, co już widać.
    const zapytanie = window.matchMedia('(prefers-color-scheme: dark)');
    const nasluch = () => {
      if (zapisany() === null) setMotyw(systemowy());
    };
    zapytanie.addEventListener('change', nasluch);
    return () => zapytanie.removeEventListener('change', nasluch);
  }, []);

  const nastepny: Motyw = motyw === 'dark' ? 'light' : 'dark';
  const etykieta = nastepny === 'dark' ? dict.nav.trybCiemny : dict.nav.trybJasny;

  return (
    <button
      type="button"
      className="theme-btn"
      onClick={() => {
        document.documentElement.setAttribute('data-theme', nastepny);
        try {
          localStorage.setItem(KLUCZ_MOTYWU, nastepny);
        } catch {
          /* wybór przepadnie po przeładowaniu, ale strona przełączy się teraz */
        }
        setMotyw(nastepny);
      }}
      aria-label={etykieta}
      title={etykieta}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {motyw === null ? null : motyw === 'dark' ? SLONCE : KSIEZYC}
      </svg>
    </button>
  );
}
