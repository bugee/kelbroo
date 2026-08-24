'use client';

import { use, useCallback, useState } from 'react';
import Link from 'next/link';
import { guestStatusLabel } from '@kelbroo/types';
import { GuestMark } from '@kelbroo/ui/guest-mark';
import { StaffShell } from '@/components/StaffShell';
import { useLiveData } from '@/components/useLiveData';
import { fetchSessionItems, money, type SessionItem } from '@/lib/api';

type Widok = 'guest' | 'category';

export default function SessionOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <StaffShell>{() => <Podglad sessionId={id} />}</StaffShell>;
}

/**
 * Podgląd zamówień jednego stolika.
 *
 * Dwa widoki tych samych pozycji, bo kelner dostaje dwa rodzaje pytań. „Co
 * u mnie z zupą?" pyta konkretny gość — wtedy liczy się podział po ludziach.
 * „Ile jeszcze zup?" pada przy przekazywaniu zmiany — wtedy liczy się karta.
 */
function Podglad({ sessionId }: { sessionId: string }) {
  const load = useCallback(() => fetchSessionItems(sessionId), [sessionId]);
  const { data, error } = useLiveData(load);
  const [widok, setWidok] = useState<Widok>('guest');

  if (error) return <p className="text-[var(--orange)]">{error}</p>;
  if (!data) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  const suma = data.items.reduce((acc, item) => acc + item.unitPriceCents * item.quantity, 0);

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-bold">
          {data.tableLabel}
          <span className="mono ml-2 text-sm font-normal text-[var(--muted)]">#{data.number}</span>
        </h1>
        <Link href="/tables" className="text-sm text-[var(--teal)] underline">
          wróć na salę
        </Link>
      </div>

      <div className="mt-4 flex gap-2" role="tablist">
        {(
          [
            ['guest', 'Po gościach'],
            ['category', 'Po kategoriach'],
          ] as const
        ).map(([klucz, etykieta]) => (
          <button
            key={klucz}
            type="button"
            role="tab"
            aria-selected={widok === klucz}
            onClick={() => setWidok(klucz)}
            className={`min-h-11 rounded-[var(--radius-control)] px-4 text-sm font-semibold ${
              widok === klucz
                ? 'bg-[var(--teal-wash)] text-[var(--teal)]'
                : 'border border-[var(--line)] text-[var(--muted)]'
            }`}
          >
            {etykieta}
          </button>
        ))}
      </div>

      {data.items.length === 0 ? (
        <p className="mt-12 text-center text-[var(--muted)]">
          Przy tym stoliku nie ma jeszcze żadnego zamówienia.
        </p>
      ) : (
        <>
          {widok === 'guest' ? (
            <PoGosciach items={data.items} currency={data.currency} />
          ) : (
            <PoKategoriach items={data.items} currency={data.currency} />
          )}

          <p className="mono mt-6 flex items-baseline justify-between border-t border-[var(--line)] pt-3 text-lg font-semibold">
            <span className="text-sm font-normal text-[var(--muted)]">Razem</span>
            {money(suma, data.currency)}
          </p>
        </>
      )}
    </div>
  );
}

/** Kto co zamówił. Pozycje bez wskazanego gościa idą na koniec, jako wspólne. */
function PoGosciach({ items, currency }: { items: SessionItem[]; currency: string }) {
  const grupy = new Map<
    string,
    { naglowek: SessionItem['forParticipant']; items: SessionItem[] }
  >();

  for (const item of items) {
    const klucz = item.forParticipant?.id ?? '';
    const grupa = grupy.get(klucz) ?? { naglowek: item.forParticipant, items: [] };
    grupa.items.push(item);
    grupy.set(klucz, grupa);
  }

  // Wspólne na koniec: to reszta, a nie czyjeś zamówienie.
  const kolejnosc = [...grupy.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : 0));

  return (
    <div className="mt-4 flex flex-col gap-4">
      {kolejnosc.map(([klucz, grupa]) => (
        <section key={klucz || 'wspolne'}>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {grupa.naglowek ? (
              <>
                <GuestMark symbol={grupa.naglowek.symbol} color={grupa.naglowek.color} size={18} />
                {grupa.naglowek.displayName}
              </>
            ) : (
              <span className="text-[var(--muted)]">Bez wskazanego gościa</span>
            )}
            <span className="mono ml-auto text-xs font-normal text-[var(--muted)]">
              {money(
                grupa.items.reduce((acc, i) => acc + i.unitPriceCents * i.quantity, 0),
                currency,
              )}
            </span>
          </h2>
          <Lista items={grupa.items} currency={currency} />
        </section>
      ))}
    </div>
  );
}

/** Karta od góry: kategoria, w niej danie, a pod nim jego stany. */
function PoKategoriach({ items, currency }: { items: SessionItem[]; currency: string }) {
  const kategorie = new Map<string, { nazwa: string; kolejnosc: number; items: SessionItem[] }>();

  for (const item of items) {
    const klucz = item.categoryId ?? '';
    const grupa = kategorie.get(klucz) ?? {
      nazwa: item.categoryName ?? 'Poza kartą',
      kolejnosc: item.categorySortOrder,
      items: [],
    };
    grupa.items.push(item);
    kategorie.set(klucz, grupa);
  }

  const posortowane = [...kategorie.values()].sort((a, b) => a.kolejnosc - b.kolejnosc);

  return (
    <div className="mt-4 flex flex-col gap-4">
      {posortowane.map((kategoria) => (
        <section key={kategoria.nazwa}>
          <h2 className="flex items-baseline justify-between text-sm font-semibold">
            {kategoria.nazwa}
            <span className="mono text-xs font-normal text-[var(--muted)]">
              {kategoria.items.reduce((acc, i) => acc + i.quantity, 0)} szt.
            </span>
          </h2>
          <DaniaWKategorii items={kategoria.items} currency={currency} />
        </section>
      ))}
    </div>
  );
}

/**
 * Drugi poziom grupowania: danie, a pod nim jego pozycje.
 *
 * Nagłówek podaje łączną liczbę sztuk, bo o to pyta kuchnia i zmiana. Rozbicie
 * zostaje pod spodem, bo trzy zupy mogą być w trzech różnych stanach.
 */
function DaniaWKategorii({ items, currency }: { items: SessionItem[]; currency: string }) {
  const dania = new Map<string, SessionItem[]>();
  for (const item of items) {
    dania.set(item.name, [...(dania.get(item.name) ?? []), item]);
  }

  return (
    <div className="mt-2 flex flex-col gap-3">
      {[...dania.entries()].map(([nazwa, pozycje]) => (
        <div key={nazwa}>
          <p className="mono text-sm">
            {pozycje.reduce((acc, i) => acc + i.quantity, 0)}× {nazwa}
          </p>
          <Lista items={pozycje} currency={currency} bezNazwy />
        </div>
      ))}
    </div>
  );
}

/** Pozycje ze statusem — tym samym, który gość widzi u siebie na telefonie. */
function Lista({
  items,
  currency,
  bezNazwy = false,
}: {
  items: SessionItem[];
  currency: string;
  bezNazwy?: boolean;
}) {
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-baseline justify-between gap-3 rounded-[var(--radius-control)] bg-[var(--surface-2)] px-3 py-2 text-sm"
        >
          <span className="min-w-0">
            <span className="mono">{item.quantity}× </span>
            {bezNazwy ? (
              <span className="mono text-xs text-[var(--muted)]">
                #{item.orderNumber}
                {item.forParticipant ? ` · ${item.forParticipant.displayName}` : ''}
              </span>
            ) : (
              item.name
            )}
            {item.addedByStaff && (
              <span className="mono ml-2 text-xs text-[var(--muted)]">obsługa</span>
            )}
          </span>
          <span className="flex shrink-0 items-baseline gap-3">
            <span className="mono text-xs text-[var(--teal)]">{guestStatusLabel(item.status)}</span>
            <span className="mono">{money(item.unitPriceCents * item.quantity, currency)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
