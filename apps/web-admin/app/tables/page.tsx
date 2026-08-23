'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { GuestMark } from '@kelbroo/ui/guest-mark';
import { StaffShell } from '@/components/StaffShell';
import { useLiveData } from '@/components/useLiveData';
import {
  blockTable,
  fetchSessions,
  minutesSince,
  money,
  decidePendingGuest,
  openTable,
  removeParticipant,
  resetTable,
  settleSession,
  type StaffFloorTable,
} from '@/lib/api';

export default function TablesPage() {
  return <StaffShell>{() => <Room />}</StaffShell>;
}

function Room() {
  const load = useCallback(() => fetchSessions(), []);
  const { data: tables, error, refresh } = useLiveData(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  if (error) return <p className="text-[var(--orange)]">{error}</p>;
  if (!tables) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  const settle = async (
    table: StaffFloorTable,
    session: NonNullable<StaffFloorTable['session']>,
    method: 'cash' | 'card_terminal',
  ) => act(table.tableId, () => settleSession(session.id, method, session.dueCents));

  const act = async (klucz: string, action: () => Promise<unknown>) => {
    setBusy(klucz);
    setFailure(null);
    try {
      await action();
      await refresh();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'Nie udało się wykonać akcji.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      {failure && <p className="mb-3 text-[var(--orange)]">{failure}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => {
          const session = table.session;
          const zajety = busy === table.tableId;

          return (
            <article
              key={table.tableId}
              className={`flex flex-col rounded-[var(--radius-card)] border p-4 ${
                session
                  ? 'border-[var(--line)] bg-[var(--surface)]'
                  : 'border-dashed border-[var(--line)] bg-[var(--surface-2)]'
              }`}
            >
              <header className="flex items-baseline justify-between">
                <span className="font-[family-name:var(--font-display)] text-lg font-bold">
                  {table.tableLabel}
                </span>
                <span className="mono text-sm text-[var(--muted)]">
                  {session ? `#${session.number}` : 'wolny'}
                </span>
              </header>

              <p className="mono mt-1 text-xs text-[var(--muted)]">
                {table.zone ?? 'Sala'}
                {session
                  ? ` · otwarty ${minutesSince(session.openedAt)} min · ${session.orderCount} zam.`
                  : table.blockedUntil
                    ? ' · zablokowany'
                    : ' · bez gości'}
              </p>

              {session ? (
                <>
                  <ul className="mt-3 flex flex-wrap gap-1">
                    {session.participants.map((participant) => (
                      <li
                        key={participant.id}
                        className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs ${
                          participant.approved
                            ? 'bg-[var(--surface-2)]'
                            : 'bg-[var(--orange-wash)] opacity-80'
                        }`}
                      >
                        {/* Ten sam znak, który gość widzi u siebie i wypowie kelnerowi. */}
                        <GuestMark
                          symbol={participant.symbol}
                          color={participant.color}
                          size={14}
                        />
                        {participant.displayName}
                        {participant.isHost && <span className="text-[var(--muted)]">·host</span>}
                        {/* Czeka, aż host go wpuści. Kelner stoi przy stoliku i widzi,
                            kto przy nim siedzi, więc może zdecydować zamiast hosta. */}
                        {!participant.approved && (
                          <button
                            type="button"
                            disabled={zajety}
                            onClick={() =>
                              void act(table.tableId, () =>
                                decidePendingGuest(session.id, participant.id, 'approve'),
                              )
                            }
                            className="mono rounded-full bg-[var(--orange)] px-2 py-0.5 text-[10px] text-white"
                          >
                            wpuść
                          </button>
                        )}
                        {/* Ktoś kliknął kod przez przypadek i wyszedł. Jego pozycje
                            na rachunku zostają — znika tylko z listy wizyty. */}
                        <button
                          type="button"
                          aria-label={`Usuń ${participant.displayName} ze stolika`}
                          disabled={zajety}
                          onClick={() =>
                            void act(table.tableId, () =>
                              removeParticipant(session.id, participant.id),
                            )
                          }
                          className="ml-0.5 px-1 text-[var(--muted)]"
                        >
                          ×
                        </button>
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
                        disabled={zajety}
                        onClick={() => void settle(table, session, 'cash')}
                        className="min-h-12 flex-1 rounded-[var(--radius-control)] border border-[var(--line)] text-sm font-semibold disabled:opacity-50"
                      >
                        Gotówka
                      </button>
                      <button
                        type="button"
                        disabled={zajety}
                        onClick={() => void settle(table, session, 'card_terminal')}
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

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={zajety}
                      onClick={() => void act(table.tableId, () => blockTable(table.tableId))}
                      className="min-h-11 flex-1 text-sm text-[var(--muted)] underline disabled:opacity-50"
                    >
                      Zablokuj na 2 min
                    </button>
                    {/* Goście zeskanowali kod i zrezygnowali przy kelnerze. */}
                    <button
                      type="button"
                      disabled={zajety}
                      onClick={() => {
                        const reason = window.prompt('Dlaczego sprzątasz stolik?');
                        if (!reason?.trim()) return;
                        void act(table.tableId, () => resetTable(table.tableId, reason));
                      }}
                      className="min-h-11 flex-1 text-sm text-[var(--orange)] underline disabled:opacity-50"
                    >
                      Sprzątnij stolik
                    </button>
                  </div>

                  {/* Fiskalizacja dzieje się na kasie lokalu — tu zapisujemy wyłącznie
                      ewidencję do rozliczenia zmiany. */}
                  <p className="mono mt-2 text-[10px] leading-tight text-[var(--muted)]">
                    Paragon fiskalny wystawia kasa lokalu
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 flex-1 text-sm text-[var(--muted)]">
                    {table.blockedUntil
                      ? `Zamknięty dla gości jeszcze przez ${minutesLeft(table.blockedUntil)} min.`
                      : 'Nikt jeszcze nie zeskanował kodu przy tym stoliku.'}
                  </p>

                  {/*
                    Jedna decyzja, więc jeden przycisk: zdejmuje blokadę i zakłada
                    wizytę. Bez tego przy włączonej aktywacji przez obsługę gość
                    utykał na „poproś obsługę", a obsługa nie miała czym otworzyć.
                  */}
                  <button
                    type="button"
                    disabled={zajety}
                    onClick={() => void act(table.tableId, () => openTable(table.tableId))}
                    className="mt-3 min-h-12 rounded-[var(--radius-control)] bg-[var(--orange)] font-semibold text-white disabled:opacity-50"
                  >
                    Otwórz stolik
                  </button>
                </>
              )}
            </article>
          );
        })}

        {tables.length === 0 && (
          <p className="col-span-full mt-12 text-center text-[var(--muted)]">
            Ten lokal nie ma jeszcze żadnego stolika.
          </p>
        )}
      </div>
    </>
  );
}

/** Ile minut zostało blokady — zaokrąglone w górę, bo „0 min" myli. */
function minutesLeft(until: string): number {
  return Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 60_000));
}
