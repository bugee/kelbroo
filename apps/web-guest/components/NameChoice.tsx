'use client';

import { useState } from 'react';
import { setMyName } from '@/lib/api';

/** Pamięć „nie chcę zmieniać" — na urządzeniu, bo to wygoda, nie stan wizyty. */
const kluczPominiecia = (participantId: string) => `kelbroo.nick.${participantId}`;

function juzPominiete(participantId: string): boolean {
  try {
    return localStorage.getItem(kluczPominiecia(participantId)) === '1';
  } catch {
    // Tryb prywatny albo zablokowane dane witryny — wtedy propozycja po prostu
    // wraca po odświeżeniu. Nic się nie psuje.
    return false;
  }
}

/**
 * Jednorazowa propozycja własnej nazwy.
 *
 * Domyślnie nick jest losowany, bo gość siada do stolika, żeby zamówić, a nie
 * wypełnić formularz. Ale nick jest zarazem podpisem pod pozycjami wspólnego
 * rachunku, więc komuś, kto dzieli stolik z pięcioma osobami, „Wesoły Borsuk"
 * bywa za mało.
 *
 * Stąd propozycja **obok menu, a nie przed nim** — nie blokuje zamawiania,
 * znika po pierwszej decyzji i nie wraca. Zmiana jest możliwa raz: nazwa
 * widnieje już przy zamówieniach, które inni zdążyli zobaczyć.
 */
export function NameChoice({
  participantId,
  displayName,
  qrToken,
  onSaved,
}: {
  participantId: string;
  displayName: string;
  qrToken: string;
  onSaved: () => void | Promise<void>;
}) {
  const [ukryte, setUkryte] = useState(() => juzPominiete(participantId));
  const [otwarte, setOtwarte] = useState(false);
  const [nazwa, setNazwa] = useState(displayName);
  const [zapisywanie, setZapisywanie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  if (ukryte) return null;

  const pomin = () => {
    setUkryte(true);
    try {
      localStorage.setItem(kluczPominiecia(participantId), '1');
    } catch {
      /* brak pamięci podręcznej nie jest powodem, żeby nie schować propozycji */
    }
  };

  const zapisz = async (zdarzenie: React.FormEvent<HTMLFormElement>) => {
    zdarzenie.preventDefault();
    setZapisywanie(true);
    setBlad(null);
    try {
      await setMyName(qrToken, nazwa);
      pomin();
      await onSaved();
    } catch (przyczyna) {
      setBlad(przyczyna instanceof Error ? przyczyna.message : 'Nie udało się zapisać nazwy.');
    } finally {
      setZapisywanie(false);
    }
  };

  return (
    <section className="mx-4 mt-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-3 text-sm">
      {!otwarte ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[var(--muted)]">
            Nazywamy Cię <strong className="text-[var(--ink)]">{displayName}</strong>.
          </p>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setOtwarte(true)}
              className="mono min-h-9 rounded-[var(--radius-control)] bg-[var(--teal-wash)] px-3 text-xs font-semibold text-[var(--teal)]"
            >
              Zmień
            </button>
            <button
              type="button"
              onClick={pomin}
              aria-label="Zostaw wylosowaną nazwę"
              className="mono min-h-9 px-2 text-xs text-[var(--muted)]"
            >
              OK
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={(zdarzenie) => void zapisz(zdarzenie)}>
          <label className="block">
            <span className="font-semibold">Jak mamy Cię nazywać?</span>
            <input
              value={nazwa}
              onChange={(zdarzenie) => setNazwa(zdarzenie.target.value)}
              autoFocus
              maxLength={24}
              required
              className="mono mt-1 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line-strong)] bg-[var(--surface)] px-3"
            />
          </label>

          <p className="mt-1 text-xs text-[var(--muted)]">
            Zobaczą ją inni przy stoliku i obsługa. Ustawiasz ją raz na tę wizytę.
          </p>

          {blad && (
            <p role="alert" className="mt-2 text-xs text-[var(--orange)]">
              {blad}
            </p>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={zapisywanie}
              className="mono min-h-10 flex-1 rounded-[var(--radius-control)] bg-[var(--teal)] text-xs font-semibold text-white disabled:opacity-50"
            >
              {zapisywanie ? 'Zapisuję…' : 'Zapisz'}
            </button>
            <button
              type="button"
              onClick={pomin}
              className="mono min-h-10 px-3 text-xs text-[var(--muted)]"
            >
              Zostaw {displayName}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
