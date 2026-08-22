'use client';

/**
 * Przełącznik palety.
 *
 * Motywem domyślnym jest jasny (packages/config/tailwind/theme.css) — ciemny
 * włącza się atrybutem `data-theme="dark"` na elemencie html. Wybór jest
 * lokalny dla urządzenia: kelner woli ciemny na tablecie w kuchni, a gość
 * ustawia po swojemu na własnym telefonie.
 */
import { useEffect, useState } from 'react';
import { THEME_STORAGE_KEY as STORAGE_KEY } from './theme-script';

export type Theme = 'light' | 'dark';

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    // Prywatne okno albo zablokowane dane witryny — działamy bez zapamiętywania.
    return null;
  }
}

function apply(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* wybór przepadnie po przeładowaniu, ale interfejs zadziała */
  }
}

const SUN = (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>
);

const MOON = <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />;

export function ThemeToggle({ className = '' }: { className?: string }) {
  // Serwer nie zna wyboru zapisanego w przeglądarce, więc do czasu montażu
  // renderujemy przycisk bez ikony — inaczej React zgłosiłby niezgodność
  // hydratacji, a ikona i tak mrugnęłaby na złą.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : (readStored() ?? 'light'));
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => {
        apply(next);
        setTheme(next);
      }}
      aria-label={next === 'dark' ? 'Włącz tryb ciemny' : 'Włącz tryb jasny'}
      title={next === 'dark' ? 'Tryb ciemny' : 'Tryb jasny'}
      className={`inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted)] ${className}`}
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
        aria-hidden
      >
        {theme === null ? null : theme === 'dark' ? SUN : MOON}
      </svg>
    </button>
  );
}
