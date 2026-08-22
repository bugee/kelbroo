'use client';

import { useCallback, useState } from 'react';
import { StaffShell } from '@/components/StaffShell';
import { useLiveData } from '@/components/useLiveData';
import { advanceOrder, fetchKitchen, minutesSince, type StaffOrder } from '@/lib/api';

/** Kolumny KDS odpowiadają statusom za bramką `confirmed`. */
const COLUMNS: {
  status: string;
  title: string;
  next?: 'preparing' | 'ready' | 'served';
  cta?: string;
}[] = [
  { status: 'confirmed', title: 'Nowe', next: 'preparing', cta: 'Start' },
  { status: 'preparing', title: 'W przygotowaniu', next: 'ready', cta: 'Gotowe' },
  { status: 'ready', title: 'Do wydania', next: 'served', cta: 'Wydane' },
];

export default function KdsPage() {
  return <StaffShell>{() => <Board />}</StaffShell>;
}

function Board() {
  const load = useCallback(() => fetchKitchen(), []);
  const { data: orders, error, refresh } = useLiveData(load, 10_000);
  const [busy, setBusy] = useState<string | null>(null);

  if (error) return <p className="text-[var(--orange)]">{error}</p>;
  if (!orders) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  const advance = async (order: StaffOrder, to: 'preparing' | 'ready' | 'served') => {
    setBusy(order.id);
    try {
      await advanceOrder(order.id, to);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {COLUMNS.map((column) => {
        const inColumn = orders.filter((order) => order.status === column.status);
        return (
          <section key={column.status}>
            <h2 className="mono flex items-baseline justify-between px-1 text-sm uppercase tracking-wide text-[var(--muted)]">
              {column.title}
              <span>{inColumn.length}</span>
            </h2>

            <div className="mt-2 flex flex-col gap-2">
              {inColumn.map((order) => {
                const waiting = minutesSince(order.confirmedAt ?? order.createdAt);
                return (
                  <article
                    key={order.id}
                    /* Bon kuchenny wygląda jak papier, nie jak ekran —
                       to język, który personel już zna. */
                    className="rounded-[var(--radius-card)] border border-[var(--paper-line)] bg-[var(--paper)] p-4"
                  >
                    <header className="flex items-baseline justify-between">
                      <span className="mono text-xl font-semibold">#{order.orderNumber}</span>
                      <span className="mono text-sm">{order.tableLabel}</span>
                    </header>

                    <p
                      className={`mono mt-1 text-xs ${
                        waiting >= 20 ? 'font-semibold text-[var(--orange)]' : 'text-[var(--muted)]'
                      }`}
                    >
                      {waiting} min
                    </p>

                    <ul className="mt-3 space-y-1.5">
                      {order.items.map((item) => (
                        <li key={item.id} className="leading-tight">
                          <span className="mono text-lg font-semibold">{item.quantity}× </span>
                          <span className="font-semibold">{item.name}</span>
                          {item.modifiers.length > 0 && (
                            <span className="block pl-7 text-sm text-[var(--ink-2)]">
                              + {item.modifiers.join(', ')}
                            </span>
                          )}
                          {item.note && (
                            <span className="block pl-7 text-sm font-semibold text-[var(--orange)]">
                              {item.note}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {order.guestNote && (
                      <p className="mt-2 border-t border-dashed border-[var(--paper-line)] pt-2 text-sm">
                        {order.guestNote}
                      </p>
                    )}

                    {column.next && (
                      <button
                        type="button"
                        disabled={busy === order.id}
                        onClick={() => void advance(order, column.next!)}
                        className="mt-4 min-h-14 w-full rounded-[var(--radius-control)] bg-[var(--teal)] font-semibold text-white disabled:opacity-50"
                      >
                        {column.cta}
                      </button>
                    )}
                  </article>
                );
              })}

              {inColumn.length === 0 && (
                <p className="mono px-1 py-6 text-center text-xs text-[var(--muted)]">—</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
