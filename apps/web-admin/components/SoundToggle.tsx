'use client';

import { useEffect, useState } from 'react';
import { setSoundEnabled } from '@/lib/api';
import { odblokujDzwiek, stanDzwieku } from '@/lib/sound';

/**
 * Dzwonek w nagłówku: włącza i wyłącza sygnał przy nowej pracy.
 *
 * Ma trzy stany, nie dwa, i ten trzeci jest tu najważniejszy. Przeglądarka nie
 * zagra, dopóki ktoś nie stuknie w ekran — więc dźwięk włączony na koncie może
 * być mimo to niemy po włączeniu tabletu rano. Zamiast milczeć i udawać, że
 * działa, przycisk mówi wtedy **„stuknij, aby włączyć dźwięk"**.
 *
 * Wymóg zapisany w docs/02 §4: panel ma wymusić tę jedną interakcję na starcie
 * zmiany, bo inaczej pierwsze zamówienie przechodzi bez sygnału.
 */
export function SoundToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const [gotowy, setGotowy] = useState(true);
  const [zapisuje, setZapisuje] = useState(false);

  // Stan silnika audio sprawdzamy po zamontowaniu (na serwerze nie istnieje)
  // i po każdym stuknięciu w ekran — to ono go odblokowuje.
  useEffect(() => {
    const odswiez = () => setGotowy(stanDzwieku() !== 'blocked');
    odswiez();

    const naDotyk = () => {
      void odblokujDzwiek().then(odswiez);
    };
    window.addEventListener('pointerdown', naDotyk);
    window.addEventListener('keydown', naDotyk);
    return () => {
      window.removeEventListener('pointerdown', naDotyk);
      window.removeEventListener('keydown', naDotyk);
    };
  }, []);

  const przelacz = async () => {
    const nowy = !enabled;
    setZapisuje(true);
    // Kliknięcie w dzwonek jest interakcją, więc od razu próbujemy odblokować —
    // gest i zgoda w jednym ruchu.
    if (nowy) setGotowy(await odblokujDzwiek());
    try {
      await setSoundEnabled(nowy);
      onChange(nowy);
    } catch {
      // Nieudany zapis nie może zostawić przycisku w stanie, którego nie ma
      // na koncie — zostawiamy poprzedni i pozwalamy spróbować ponownie.
    } finally {
      setZapisuje(false);
    }
  };

  const wymagaStuknięcia = enabled && !gotowy;
  const opis = !enabled
    ? 'Dźwięk wyłączony — włącz sygnał przy nowej pracy'
    : wymagaStuknięcia
      ? 'Dźwięk włączony, ale przeglądarka czeka na stuknięcie w ekran'
      : 'Dźwięk włączony — wyłącz sygnał przy nowej pracy';

  return (
    <button
      type="button"
      onClick={() => void przelacz()}
      disabled={zapisuje}
      aria-pressed={enabled}
      aria-label={opis}
      title={opis}
      className={`relative min-h-11 min-w-11 rounded-[var(--radius-control)] px-2 disabled:opacity-50 ${
        enabled ? 'text-[var(--teal)]' : 'text-[var(--muted)]'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mx-auto"
      >
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        {/* Przekreślenie zamiast innej ikony: ten sam kształt w dwóch stanach
            czyta się szybciej niż dwa różne dzwonki. */}
        {!enabled && <path d="M3 3l18 18" />}
      </svg>

      {/* Kropka znaczy „włączony, ale jeszcze niemy". Bez niej obsługa byłaby
          przekonana, że usłyszy sygnał, którego nie usłyszy. */}
      {wymagaStuknięcia && (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--orange)]"
        />
      )}
    </button>
  );
}
