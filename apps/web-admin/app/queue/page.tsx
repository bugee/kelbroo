'use client';

import { useCallback, useState } from 'react';
import { GuestMark } from '@kelbroo/ui/guest-mark';
import { StaffShell } from '@/components/StaffShell';
import { useLiveData } from '@/components/useLiveData';
import {
  acknowledgeCall,
  confirmOrder,
  decidePendingGuest,
  fetchPendingGuests,
  fetchQueue,
  fetchWaiterCalls,
  minutesSince,
  money,
  PAYMENT_LABEL,
  SPLIT_LABEL,
  rejectOrder,
  resolveCall,
  openTable,
  type WaiterCall,
} from '@/lib/api';

export default function QueuePage() {
  return <StaffShell>{() => <Queue />}</StaffShell>;
}

function Queue() {
  const load = useCallback(() => fetchQueue(), []);
  const { data: orders, error, refresh } = useLiveData(load);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, action: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await action();
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (error) return <p className="text-[var(--orange)]">{error}</p>;
  if (!orders) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  if (orders.length === 0) {
    return (
      <>
        <WaitingGuests />
        <Calls />
        <p className="mt-12 text-center text-[var(--muted)]">
          Brak zamówień czekających na potwierdzenie.
        </p>
      </>
    );
  }

  return (
    <>
      <WaitingGuests />
      <Calls />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => (
          <article
            key={order.id}
            className="flex flex-col rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
          >
            <header className="flex items-baseline justify-between">
              <span className="mono text-lg font-semibold">#{order.orderNumber}</span>
              <span className="mono text-sm">{order.tableLabel}</span>
            </header>

            <p className="mt-1 flex items-center gap-2 text-sm text-[var(--muted)]">
              {/* Kelner podchodzi do stolika i szuka gościa po znaku, który ten
                  mu nazwał — kolorowa kropka bez kształtu tego nie da. */}
              {order.guestSymbol && order.guestColor && (
                <GuestMark symbol={order.guestSymbol} color={order.guestColor} size={16} />
              )}
              {order.guestName ?? 'Gość'} · przed {minutesSince(order.createdAt)} min
            </p>

            <ul className="mt-3 flex-1 space-y-1">
              {order.items.map((item) => (
                <li key={item.id} className="text-sm">
                  <span className="mono font-semibold">{item.quantity}× </span>
                  {item.name}
                  {item.addedByStaff && (
                    <span className="mono ml-2 rounded-[var(--radius-control)] bg-[var(--teal-wash)] px-2 text-xs text-[var(--teal)]">
                      obsługa
                    </span>
                  )}
                  {item.modifiers.length > 0 && (
                    <span className="text-[var(--muted)]"> · {item.modifiers.join(', ')}</span>
                  )}
                  {item.note && (
                    <span className="block pl-6 italic text-[var(--orange)]">{item.note}</span>
                  )}
                </li>
              ))}
            </ul>

            {order.guestNote && (
              <p className="mt-2 rounded-[var(--radius-control)] bg-[var(--orange-wash)] p-2 text-sm">
                {order.guestNote}
              </p>
            )}

            <p className="mono mt-3 text-right font-semibold">
              {money(order.totalCents, order.currency)}
            </p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy === order.id}
                onClick={() =>
                  void act(order.id, async () => {
                    // Odrzucenie zawsze z powodem — trafia do historii zamówienia.
                    const reason = window.prompt('Powód odrzucenia:');
                    if (reason) await rejectOrder(order.id, reason);
                  })
                }
                className="min-h-12 flex-1 rounded-[var(--radius-control)] border border-[var(--line)] text-sm font-semibold text-[var(--muted)]"
              >
                Odrzuć
              </button>
              <button
                type="button"
                disabled={busy === order.id}
                onClick={() => void act(order.id, () => confirmOrder(order.id))}
                className="min-h-12 flex-[2] rounded-[var(--radius-control)] bg-[var(--orange)] font-semibold text-white disabled:opacity-50"
              >
                Potwierdź
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

/**
 * Goście czekający na wpuszczenie do stolika.
 *
 * Nad wezwaniami, bo taki gość nie może zrobić nic — nawet obejrzeć rachunku —
 * dopóki ktoś nie kliknie. Decyzja należy do hosta, ale host bywa zajęty
 * jedzeniem albo w ogóle nie zauważył, że ktoś czeka.
 */
function WaitingGuests() {
  const load = useCallback(() => fetchPendingGuests(), []);
  const { data: guests, refresh } = useLiveData(load);
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (
    sessionId: string,
    participantId: string,
    decision: 'approve' | 'reject',
  ) => {
    setBusy(participantId);
    try {
      await decidePendingGuest(sessionId, participantId, decision);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (!guests || guests.length === 0) return null;

  return (
    <ul className="mb-4 flex flex-col gap-2">
      {guests.map((guest) => (
        <li
          key={guest.id}
          className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--teal)] bg-[var(--teal-wash)] p-3"
        >
          <GuestMark symbol={guest.symbol} color={guest.color} size={24} />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {guest.tableLabel} · czeka na wpuszczenie do stolika
            </span>
            <span className="mono text-sm text-[var(--muted)]">
              {guest.displayName} · {minutesSince(guest.joinedAt)} min
            </span>
          </span>

          <button
            type="button"
            disabled={busy === guest.id}
            onClick={() => void decide(guest.sessionId, guest.id, 'approve')}
            className="min-h-11 rounded-[var(--radius-control)] bg-[var(--orange)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Wpuść
          </button>
          <button
            type="button"
            disabled={busy === guest.id}
            onClick={() => void decide(guest.sessionId, guest.id, 'reject')}
            className="mono min-h-11 px-3 text-xs text-[var(--muted)] disabled:opacity-50"
          >
            To nie u nas
          </button>
        </li>
      ))}
    </ul>
  );
}

const REASON_LABEL: Record<WaiterCall['reason'], string> = {
  help: 'Woła kelnera',
  bill: 'Prosi o rachunek',
  water: 'Prosi o wodę',
  open_table: 'Prosi o otwarcie stolika',
  other: 'Zgłoszenie',
};

/**
 * Wezwania od gości. Nad kolejką zamówień, bo gość przy stoliku czeka
 * na kogoś, a nie na jedzenie — i widzi, ile to trwa.
 */
function Calls() {
  const load = useCallback(() => fetchWaiterCalls(), []);
  const { data: calls, refresh } = useLiveData(load);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, action: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await action();
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (!calls || calls.length === 0) return null;

  return (
    <ul className="mb-4 flex flex-col gap-2">
      {calls.map((call) => (
        <li
          key={call.id}
          className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--orange)] bg-[var(--orange-wash)] p-3"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {call.tableLabel} · {REASON_LABEL[call.reason]}
            </span>
            <span className="mono text-sm text-[var(--muted)]">
              czeka {minutesSince(call.createdAt)} min
              {call.acknowledgedBy && ` · idzie ${call.acknowledgedBy}`}
            </span>

            {/*
              Deklaracja gościa w osobnym wierszu, nie doklejona do czasu
              oczekiwania: to jedyna informacja na tym ekranie, na podstawie
              której kelner decyduje, co ze sobą zabrać. Doklejona do „czeka
              3 min" ginie w szarym ciągu.
            */}
            {call.paymentPreference && (
              <span className="mono block text-sm font-semibold text-[var(--ink)]">
                {SPLIT_LABEL[call.splitMode ?? 'none']}
                {' · '}
                {PAYMENT_LABEL[call.paymentPreference]}
                {call.invoiceRequested && ' · faktura VAT'}
              </span>
            )}
          </span>

          {/* Otwarcie stolika zdejmuje blokadę i zamyka samo zgłoszenie —
              dwie akcje w jednym kliknięciu, bo to jedna decyzja. */}
          {call.reason === 'open_table' && (
            <button
              type="button"
              disabled={busy === call.id}
              onClick={() => void act(call.id, () => openTable(call.tableId))}
              className="min-h-11 rounded-[var(--radius-control)] bg-[var(--teal)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Otwórz stolik
            </button>
          )}

          {call.status === 'open' && call.reason !== 'open_table' && (
            <button
              type="button"
              disabled={busy === call.id}
              onClick={() => void act(call.id, () => acknowledgeCall(call.id))}
              className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line)] px-4 text-sm font-semibold disabled:opacity-50"
            >
              Idę
            </button>
          )}
          <button
            type="button"
            disabled={busy === call.id}
            onClick={() => void act(call.id, () => resolveCall(call.id))}
            className="min-h-11 rounded-[var(--radius-control)] bg-[var(--orange)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Załatwione
          </button>
        </li>
      ))}
    </ul>
  );
}
