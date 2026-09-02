'use client';

import { useState } from 'react';

export interface DaneStolika {
  label: string;
  zone?: string;
  seats?: number;
}

/**
 * Formularz opisu stolika: numer, strefa, liczba miejsc.
 *
 * Jeden komponent na zakładanie i na poprawianie, bo to te same trzy pola.
 * Zastępuje łańcuszek `window.prompt`, którym zakładało się stolik wcześniej —
 * prompt nie umie pokazać błędu z serwera i nie zapamiętuje wpisanego numeru,
 * gdy okaże się zajęty.
 *
 * Numer jest wymagany, reszta nie: lokal bez podziału na strefy nie ma czego
 * wpisać, a liczba miejsc bywa nieznana przy pierwszym wprowadzaniu sali.
 */
export function TableFields({
  poczatkowe,
  zapisz,
  anuluj,
  etykietaZapisu,
}: {
  poczatkowe?: { label: string; zone: string | null; seats: number | null };
  zapisz: (dane: DaneStolika) => Promise<void>;
  anuluj: () => void;
  etykietaZapisu: string;
}) {
  const [label, setLabel] = useState(poczatkowe?.label ?? '');
  const [zone, setZone] = useState(poczatkowe?.zone ?? '');
  const [seats, setSeats] = useState(poczatkowe?.seats ? String(poczatkowe.seats) : '');
  const [pracuje, setPracuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  const wyslij = async (zdarzenie: React.FormEvent<HTMLFormElement>) => {
    zdarzenie.preventDefault();
    const numer = label.trim();
    if (!numer) {
      setBlad('Numer stolika jest wymagany.');
      return;
    }

    setPracuje(true);
    setBlad(null);
    try {
      await zapisz({
        label: numer,
        // Puste pole znaczy „bez strefy" — pomijamy je, zamiast wysyłać `''`.
        zone: zone.trim() || undefined,
        seats: seats.trim() ? Number(seats) : undefined,
      });
    } catch (przyczyna) {
      // Błąd zostaje **w formularzu**, z wpisanymi wartościami: najczęstszy to
      // zajęty numer, a wtedy poprawia się jedno pole, nie wpisuje wszystko od nowa.
      setBlad(przyczyna instanceof Error ? przyczyna.message : 'Nie udało się zapisać.');
      setPracuje(false);
    }
  };

  return (
    <form onSubmit={(zdarzenie) => void wyslij(zdarzenie)} className="mt-3 w-full text-left">
      <Pole etykieta="Numer stolika" wartosc={label} ustaw={setLabel} placeholder="Stolik 12" />
      <Pole etykieta="Strefa" wartosc={zone} ustaw={setZone} placeholder="Taras" />
      <Pole
        etykieta="Miejsca"
        wartosc={seats}
        ustaw={setSeats}
        placeholder="4"
        inputMode="numeric"
      />

      {blad && (
        <p role="alert" className="mt-2 text-xs text-[var(--orange)]">
          {blad}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={anuluj}
          className="mono min-h-11 flex-1 rounded-[var(--radius-control)] border border-[var(--line)] text-xs"
        >
          Anuluj
        </button>
        <button
          type="submit"
          disabled={pracuje}
          className="mono min-h-11 flex-[2] rounded-[var(--radius-control)] bg-[var(--teal)] text-xs font-semibold text-white disabled:opacity-50"
        >
          {pracuje ? 'Zapisuję…' : etykietaZapisu}
        </button>
      </div>
    </form>
  );
}

function Pole({
  etykieta,
  wartosc,
  ustaw,
  placeholder,
  inputMode,
}: {
  etykieta: string;
  wartosc: string;
  ustaw: (wartosc: string) => void;
  placeholder: string;
  inputMode?: 'numeric';
}) {
  return (
    <label className="mt-2 block">
      <span className="mono block text-[10px] uppercase text-[var(--muted)]">{etykieta}</span>
      <input
        value={wartosc}
        onChange={(zdarzenie) => ustaw(zdarzenie.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-0.5 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
      />
    </label>
  );
}
