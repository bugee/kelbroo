'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { StaffShell } from '@/components/StaffShell';
import { useLiveData } from '@/components/useLiveData';
import { fetchSessions, minutesSince, money, settleSession, type StaffSession } from '@/lib/api';

export default function TablesPage() {
  return <StaffShell>{() => <Room />}</StaffShell>;
}

function Room() {
  const load = useCallback(() => fetchSessions(), []);
  const { data: sessions, error, refresh } = useLiveData(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  if (error) return <p className="text-[var(--orange)]">{error}</p>;
  if (!sessions) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  const settle = async (session: StaffSession, method: 'cash' | 'card_terminal') => {
    setBusy(session.id);
    setFailure(null);
    try {
      await settleSession(session.id, method, session.dueCents);
      await refresh();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'Rozliczenie się nie powiodło.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {failure && <p className="mb-3 text-[var(--orange)]">{failure}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => (
          <article
            key={session.id}
            className="flex flex-col rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
          >
            <header className="flex items-baseline justify-between">
              <span className="font-[family-name:var(--font-display)] text-lg font-bold">
                {session.tableLabel}
              </span>
              <span className="mono text-sm text-[var(--muted)]">#{session.number}</span>
            </header>

            <p className="mono mt-1 text-xs text-[var(--muted)]">
              {session.zone ?? 'Sala'} · otwarty {minutesSince(session.openedAt)} min ·{' '}
              {session.orderCount} zam.
            </p>

            <ul className="mt-3 flex flex-wrap gap-1">
              {session.participants.map((participant) => (
                <li
                  key={participant.id}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2 py-1 text-xs"
                >
                  <span
                    className="inline-block size-3 rounded-full"
                    style={{ background: participant.color }}
                    aria-hidden
                  />
                  {participant.displayName}
                  {participant.isHost && <span className="text-[var(--muted)]">·host</span>}
                </li>
              ))}
            </ul>

            <p className="mono mt-4 flex items-baseline justify-between text-lg font-semibold">
              <span className="text-sm font-normal text-[var(--muted)]">Do zapłaty</span>
              {money(session.dueCents, session.currency)}
            </p>

            {session.dueCents > 0 && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy === session.id}
                  onClick={() => void settle(session, 'cash')}
                  className="min-h-12 flex-1 rounded-[var(--radius-control)] border border-[var(--line)] text-sm font-semibold disabled:opacity-50"
                >
                  Gotówka
                </button>
                <button
                  type="button"
                  disabled={busy === session.id}
                  onClick={() => void settle(session, 'card_terminal')}
                  className="min-h-12 flex-1 rounded-[var(--radius-control)] border border-[var(--line)] text-sm font-semibold disabled:opacity-50"
                >
                  Terminal
                </button>
              </div>
            )}

            {session.participants.length > 1 && (
              <Link
                href={`/tables/${session.id}`}
                className="mt-2 text-center text-sm text-[var(--teal)] underline"
              >
                Podziel rachunek
              </Link>
            )}

            {/* Fiskalizacja dzieje się na kasie lokalu — tu zapisujemy wyłącznie
                ewidencję do rozliczenia zmiany. */}
            <p className="mono mt-2 text-[10px] leading-tight text-[var(--muted)]">
              Paragon fiskalny wystawia kasa lokalu
            </p>
          </article>
        ))}

        {sessions.length === 0 && (
          <p className="col-span-full mt-12 text-center text-[var(--muted)]">
            Żaden stolik nie ma otwartego rachunku.
          </p>
        )}
      </div>
    </>
  );
}
