'use client';

import { useCallback, useState } from 'react';
import { StaffShell } from '@/components/StaffShell';
import { useLiveData } from '@/components/useLiveData';
import { fetchSalesReport, money, type SalesReport } from '@/lib/api';

/**
 * Okresy do wyboru. Trzy, nie dziesięć.
 *
 * „Dziś" odpowiada na pytanie zadawane w trakcie zmiany, „7 dni" na pytanie
 * z poniedziałkowego poranka, „30 dni" na rozmowę o tym, co zamawiać.
 * Każdy kolejny wariant to decyzja do podjęcia przed obejrzeniem liczby.
 */
const OKRESY = [
  { dni: 1, label: 'Dziś' },
  { dni: 7, label: '7 dni' },
  { dni: 30, label: '30 dni' },
];

export default function ReportsPage() {
  return <StaffShell>{() => <Raport />}</StaffShell>;
}

function Raport() {
  const [dni, setDni] = useState(7);
  const load = useCallback(() => fetchSalesReport(dni), [dni]);
  // Raport nie jest ekranem serwisu — odświeżanie co 15 sekund byłoby ruchem
  // bez powodu. Pięć minut wystarcza, żeby liczba z dziś była aktualna.
  const { data: raport, error } = useLiveData(load, 300_000);

  if (error) return <p className="text-[var(--orange)]">{error}</p>;
  if (!raport) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-bold">Sprzedaż</h1>
        <div className="flex gap-1">
          {OKRESY.map((okres) => (
            <button
              key={okres.dni}
              type="button"
              onClick={() => setDni(okres.dni)}
              aria-pressed={dni === okres.dni}
              className={`mono min-h-11 rounded-[var(--radius-control)] px-3 text-sm font-semibold ${
                dni === okres.dni
                  ? 'bg-[var(--teal-wash)] text-[var(--teal)]'
                  : 'text-[var(--muted)]'
              }`}
            >
              {okres.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mono mt-1 text-xs text-[var(--muted)]">
        Doba biznesowa {raport.od} — {raport.do}. Liczymy zamówienia przyjęte; odrzucone i anulowane
        nie wchodzą.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Kafel
          etykieta="Sprzedaż"
          wartosc={money(raport.razem.sprzedazCents, raport.currency)}
          mocny
        />
        <Kafel etykieta="Zamówienia" wartosc={String(raport.razem.zamowien)} />
        <Kafel
          etykieta="Średnie zamówienie"
          wartosc={money(raport.razem.sredniRachunekCents, raport.currency)}
        />
      </div>

      {raport.dni.length > 1 && (
        <Sekcja tytul="Dzień po dniu">
          <Slupki
            pozycje={raport.dni.map((dzien) => ({
              klucz: dzien.data,
              etykieta: dzien.data.slice(5),
              wartosc: dzien.sprzedazCents,
              opis: money(dzien.sprzedazCents, raport.currency),
            }))}
          />
        </Sekcja>
      )}

      <Sekcja tytul="Co się sprzedaje">
        {raport.dania.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Brak zamówień w tym okresie.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {raport.dania.map((danie) => (
              <li
                key={danie.nazwa}
                className="flex items-baseline justify-between gap-3 rounded-[var(--radius-control)] px-3 py-2 odd:bg-[var(--surface-2)]"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{danie.nazwa}</span>
                <span className="mono text-xs text-[var(--muted)]">{danie.sztuk} szt.</span>
                <span className="mono text-sm font-semibold">
                  {money(danie.sprzedazCents, raport.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Sekcja>

      {raport.martwe.length > 0 && (
        <Sekcja tytul="Nikt tego nie zamówił">
          {/* Nie „najgorzej sprzedające się", tylko **zero sprzedaży**. To jest
              lista do rozmowy o karcie, a nie ranking od dołu. */}
          <p className="mb-2 text-xs text-[var(--muted)]">
            Pozycje w karcie bez ani jednego zamówienia w tym okresie.
          </p>
          <ul className="flex flex-wrap gap-2">
            {raport.martwe.map((pozycja) => (
              <li
                key={pozycja.nazwa}
                className="mono rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs"
              >
                {pozycja.nazwa}
              </li>
            ))}
          </ul>
        </Sekcja>
      )}

      <Sekcja tytul="O której zamawiają">
        <Slupki
          pozycje={raport.godziny.map((wpis) => ({
            klucz: String(wpis.godzina),
            etykieta: String(wpis.godzina),
            wartosc: wpis.zamowien,
            opis: `${wpis.zamowien} zam.`,
          }))}
        />
      </Sekcja>
    </div>
  );
}

function Kafel({
  etykieta,
  wartosc,
  mocny = false,
}: {
  etykieta: string;
  wartosc: string;
  mocny?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="mono text-xs text-[var(--muted)]">{etykieta}</p>
      <p className={`mono mt-1 font-bold ${mocny ? 'text-2xl text-[var(--teal)]' : 'text-xl'}`}>
        {wartosc}
      </p>
    </div>
  );
}

function Sekcja({ tytul, children }: { tytul: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 font-[family-name:var(--font-display)] font-bold">{tytul}</h2>
      {children}
    </section>
  );
}

/**
 * Słupki bez biblioteki wykresów.
 *
 * Dwa wykresy słupkowe nie są warte dwustu kilobajtów w przeglądarce tabletu,
 * który i tak pracuje na wi-fi lokalu. Wysokość liczymy względem największej
 * wartości; przy samych zerach nie rysujemy nic, bo pusty wykres z podziałką
 * wygląda jak awaria.
 */
function Slupki({
  pozycje,
}: {
  pozycje: { klucz: string; etykieta: string; wartosc: number; opis: string }[];
}) {
  const max = Math.max(...pozycje.map((pozycja) => pozycja.wartosc), 0);
  if (max === 0) {
    return <p className="text-sm text-[var(--muted)]">Brak danych w tym okresie.</p>;
  }

  return (
    <ul className="flex items-end gap-1 overflow-x-auto pb-1">
      {pozycje.map((pozycja) => (
        <li key={pozycja.klucz} className="flex min-w-8 flex-1 flex-col items-center gap-1">
          <span
            title={pozycja.opis}
            aria-label={`${pozycja.etykieta}: ${pozycja.opis}`}
            className="w-full rounded-t bg-[var(--teal)]"
            style={{ height: `${Math.max(2, Math.round((pozycja.wartosc / max) * 96))}px` }}
          />
          <span className="mono text-[10px] text-[var(--muted)]">{pozycja.etykieta}</span>
        </li>
      ))}
    </ul>
  );
}
