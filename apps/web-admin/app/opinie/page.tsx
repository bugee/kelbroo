'use client';

import { useCallback, useEffect, useState } from 'react';
import { StaffShell } from '@/components/StaffShell';
import { fetchReviews, markReviewRead, type GuestReview } from '@/lib/api';

export default function ReviewsPage() {
  return <StaffShell>{() => <Reviews />}</StaffShell>;
}

const CEL: Record<string, string> = {
  dish: 'o daniu',
  kitchen: 'o jedzeniu',
  service: 'o obsłudze',
  manager: 'do managera',
};

/**
 * Opinie gości.
 *
 * Ten ekran jest drugą połową mechanizmu, którego pierwsza połowa stoi
 * u gościa: niezadowolony ma powiedzieć restauracji, zanim powie internetowi.
 * Jeśli nikt tego nie czyta, cała funkcja jest pozorna — stąd nieprzeczytane
 * na górze i wyraźne odhaczanie, a nie zwykła lista chronologiczna.
 */
function Reviews() {
  const [opinie, setOpinie] = useState<GuestReview[] | null>(null);
  const [blad, setBlad] = useState<string | null>(null);

  const odswiez = useCallback(async () => {
    try {
      setOpinie(await fetchReviews());
      setBlad(null);
    } catch (cause) {
      setBlad(cause instanceof Error ? cause.message : 'Nie udało się wczytać opinii.');
    }
  }, []);

  useEffect(() => {
    void odswiez();
  }, [odswiez]);

  if (blad) {
    return (
      <p role="alert" className="text-sm text-[var(--orange)]">
        {blad}
      </p>
    );
  }
  if (!opinie) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  if (opinie.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Opinie gości</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Nikt jeszcze nie ocenił wizyty. Gość dostaje pytanie po wydaniu dania, na ekranie
          rachunku.
        </p>
      </div>
    );
  }

  const nieprzeczytane = opinie.filter((opinia) => !opinia.isRead).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-baseline gap-x-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Opinie gości</h1>
        <span className="mono text-sm text-[var(--muted)]">
          {nieprzeczytane > 0 ? `${nieprzeczytane} nieprzeczytanych` : 'wszystko przeczytane'}
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {opinie.map((opinia) => (
          <li
            key={opinia.id}
            className={`rounded-[var(--radius-card)] border p-4 ${
              opinia.isRead
                ? 'border-[var(--line)] opacity-70'
                : 'border-[var(--line-strong)] bg-[var(--surface)]'
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {/* Ocena jako gwiazdki, nie liczba: „2/5" trzeba przeliczyć,
                  a dwie gwiazdki widać. */}
              <span
                aria-label={`${opinia.rating} z 5`}
                className={opinia.rating <= 2 ? 'text-[var(--orange)]' : 'text-[var(--teal)]'}
              >
                {'★'.repeat(opinia.rating)}
                <span className="text-[var(--line-strong)]">{'★'.repeat(5 - opinia.rating)}</span>
              </span>
              <span className="mono text-xs text-[var(--muted)]">
                {CEL[opinia.target] ?? opinia.target}
                {opinia.dishName && ` · ${opinia.dishName}`}
              </span>
              <span className="mono ml-auto text-xs text-[var(--muted)]">
                {opinia.tableLabel && `${opinia.tableLabel} · `}
                {new Date(opinia.createdAt).toLocaleDateString('pl-PL')}
              </span>
            </div>

            {opinia.comment && <p className="mt-2 text-sm">{opinia.comment}</p>}

            {!opinia.isRead && (
              <button
                type="button"
                onClick={() => void markReviewRead(opinia.id).then(odswiez)}
                className="mono mt-3 min-h-9 rounded-[var(--radius-control)] bg-[var(--teal-wash)] px-3 text-xs font-semibold text-[var(--teal)]"
              >
                Przeczytane
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
