'use client';

import { useCallback, useEffect, useState } from 'react';
import { GuestMark } from '@kelbroo/ui/guest-mark';
import { StaffShell } from '@/components/StaffShell';
import {
  addOrderItems,
  changeOrderItemQuantity,
  fetchOrderHistory,
  fetchOrderingMenu,
  fetchOrderingTables,
  money,
  placeOrderForGuest,
  removeOrderItem,
  type OrderEventView,
  type OrderingMenu,
  type OrderingTable,
  type StaffOrderDetail,
} from '@/lib/api';

export default function OrderPage() {
  return <StaffShell>{() => <WaiterOrdering />}</StaffShell>;
}

type Cart = Record<string, number>;

function WaiterOrdering() {
  const [tables, setTables] = useState<OrderingTable[] | null>(null);
  const [menu, setMenu] = useState<OrderingMenu | null>(null);
  const [table, setTable] = useState<OrderingTable | null>(null);
  const [participantId, setParticipantId] = useState<string>('');
  const [cart, setCart] = useState<Cart>({});
  const [order, setOrder] = useState<StaffOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadTables = useCallback(async () => {
    try {
      setTables(await fetchOrderingTables());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać stolików.');
    }
  }, []);

  useEffect(() => {
    void loadTables();
    fetchOrderingMenu()
      .then(setMenu)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać karty.'),
      );
  }, [loadTables]);

  const run = async (action: () => Promise<StaffOrderDetail>) => {
    setError(null);
    setBusy(true);
    try {
      setOrder(await action());
      await loadTables();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setOrder(null);
    setTable(null);
    setParticipantId('');
    setCart({});
  };

  if (error && !tables) return <p className="text-[var(--orange)]">{error}</p>;
  if (!tables || !menu) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  if (order) {
    return (
      <PlacedOrder order={order} menu={menu} busy={busy} error={error} onRun={run} onDone={reset} />
    );
  }

  if (!table) {
    return (
      <div className="max-w-3xl">
        {error && <p className="mb-3 text-[var(--orange)]">{error}</p>}
        <h1 className="font-[family-name:var(--font-display)] text-xl font-bold">
          Dla którego stolika?
        </h1>
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {tables.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                onClick={() => setTable(candidate)}
                className="min-h-20 w-full rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-3 text-left"
              >
                <span className="mono block font-semibold">{candidate.label}</span>
                <span className="block text-sm text-[var(--muted)]">
                  {candidate.openSession
                    ? `rachunek ${money(candidate.openSession.totalCents, 'PLN')}`
                    : 'wolny — otworzy wizytę'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const total = Object.entries(cart).reduce((sum, [id, quantity]) => {
    const item = menu.categories.flatMap((c) => c.items).find((i) => i.id === id);
    return sum + (item ? item.priceCents * quantity : 0);
  }, 0);

  return (
    <div className="max-w-3xl">
      {error && <p className="mb-3 text-[var(--orange)]">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-bold">{table.label}</h1>
        <button type="button" onClick={reset} className="text-sm text-[var(--muted)] underline">
          zmień stolik
        </button>
      </div>

      {table.openSession && table.openSession.participants.length > 0 && (
        <fieldset className="mt-4">
          {/*
            Przyciski, nie lista rozwijana: kelner szuka wzrokiem znaku, który
            gość właśnie mu nazwał („czerwona gwiazdka"), a nie nicku na liście.
            Znak jest widoczny bez rozwijania czegokolwiek.
          */}
          <legend className="text-sm font-semibold">Dla kogo</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setParticipantId('')}
              aria-pressed={participantId === ''}
              className={`min-h-12 rounded-[var(--radius-control)] border px-4 text-sm font-semibold ${
                participantId === ''
                  ? 'border-[var(--teal)] bg-[var(--teal-wash)] text-[var(--teal)]'
                  : 'border-[var(--line)] text-[var(--muted)]'
              }`}
            >
              {/* Bez wskazania gościa pozycja zostaje na rachunku stolika bez adresata. */}
              Cały stolik
            </button>

            {table.openSession.participants.map((participant) => (
              <button
                key={participant.id}
                type="button"
                onClick={() => setParticipantId(participant.id)}
                aria-pressed={participantId === participant.id}
                className={`flex min-h-12 items-center gap-2 rounded-[var(--radius-control)] border px-4 text-sm font-semibold ${
                  participantId === participant.id
                    ? 'border-[var(--teal)] bg-[var(--teal-wash)] text-[var(--teal)]'
                    : 'border-[var(--line)]'
                }`}
              >
                <GuestMark symbol={participant.symbol} color={participant.color} />
                {participant.displayName}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <ul className="mt-5 flex flex-col gap-4">
        {menu.categories.map((category) => (
          <li key={category.id}>
            <h2 className="mono text-sm font-semibold text-[var(--muted)]">{category.name}</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {category.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{item.name}</span>
                    <span className="mono text-sm text-[var(--muted)]">
                      {money(item.priceCents, menu.currency)}
                      {!item.isAvailable && ' · niedostępne'}
                    </span>
                  </span>
                  <Stepper
                    value={cart[item.id] ?? 0}
                    disabled={!item.isAvailable}
                    onChange={(quantity) =>
                      setCart((current) => {
                        const next = { ...current };
                        if (quantity <= 0) delete next[item.id];
                        else next[item.id] = quantity;
                        return next;
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t border-[var(--line)] bg-[var(--surface)] py-3">
        <span className="mono flex-1 font-semibold">{money(total, menu.currency)}</span>
        <button
          type="button"
          disabled={busy || Object.keys(cart).length === 0}
          onClick={() =>
            void run(() =>
              placeOrderForGuest({
                tableId: table.id,
                ...(participantId ? { forParticipantId: participantId } : {}),
                items: Object.entries(cart).map(([menuItemId, quantity]) => ({
                  menuItemId,
                  quantity,
                })),
              }),
            )
          }
          className="min-h-12 rounded-[var(--radius-control)] bg-[var(--orange)] px-6 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Wysyłam…' : 'Złóż zamówienie'}
        </button>
      </div>
    </div>
  );
}

function PlacedOrder({
  order,
  menu,
  busy,
  error,
  onRun,
  onDone,
}: {
  order: StaffOrderDetail;
  menu: OrderingMenu;
  busy: boolean;
  error: string | null;
  onRun: (action: () => Promise<StaffOrderDetail>) => Promise<void>;
  onDone: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState<OrderEventView[] | null>(null);

  const editable = order.status !== 'served' && order.status !== 'closed';

  return (
    <div className="max-w-3xl">
      {error && <p className="mb-3 text-[var(--orange)]">{error}</p>}

      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-bold">
          Zamówienie #{order.orderNumber}
        </h1>
        <span className="mono text-sm text-[var(--muted)]">
          {order.tableLabel} · {order.status}
        </span>
      </div>

      <p className="mt-1 text-sm text-[var(--muted)]">
        Złożone przez obsługę ({order.placedByStaffName}) — poszło do kuchni bez kolejki
        potwierdzeń.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {order.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{item.name}</span>
              <span className="block text-sm text-[var(--muted)]">
                <Attribution item={item} />
              </span>
            </span>
            <span className="mono text-sm">{money(item.lineTotalCents, order.currency)}</span>
            {editable && (
              <>
                <Stepper
                  value={item.quantity}
                  onChange={(quantity) =>
                    void onRun(() => changeOrderItemQuantity(order.id, item.id, quantity))
                  }
                  min={1}
                />
                <button
                  type="button"
                  disabled={busy || order.items.length === 1}
                  onClick={() => void onRun(() => removeOrderItem(order.id, item.id))}
                  className="min-h-11 px-3 text-sm text-[var(--orange)] underline disabled:opacity-40"
                >
                  Usuń
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <p className="mono mt-4 text-lg font-semibold">
        {money(order.totalCents, order.currency)}
        <span className="ml-2 text-sm font-normal text-[var(--muted)]">
          w tym VAT {money(order.vatCents, order.currency)}
        </span>
      </p>

      {editable && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setAdding((current) => !current)}
            className="min-h-12 rounded-[var(--radius-control)] border border-[var(--line)] px-4 font-semibold"
          >
            {adding ? 'Zamknij kartę' : 'Dołóż pozycję'}
          </button>

          {adding && (
            <ul className="mt-3 flex flex-col gap-1">
              {menu.categories.flatMap((category) =>
                category.items
                  .filter((item) => item.isAvailable)
                  .map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-2"
                    >
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      <span className="mono text-sm text-[var(--muted)]">
                        {money(item.priceCents, menu.currency)}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void onRun(() =>
                            addOrderItems(order.id, [{ menuItemId: item.id, quantity: 1 }]),
                          )
                        }
                        className="min-h-11 rounded-[var(--radius-control)] bg-[var(--teal)] px-4 text-sm font-semibold text-white"
                      >
                        Dodaj
                      </button>
                    </li>
                  )),
              )}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            if (history) setHistory(null);
            else void fetchOrderHistory(order.id).then(setHistory);
          }}
          className="text-sm text-[var(--muted)] underline"
        >
          {history ? 'Ukryj historię' : 'Pokaż historię zmian'}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-[var(--teal)] underline">
          Nowe zamówienie
        </button>
      </div>

      {history && (
        <ol className="mono mt-3 flex flex-col gap-1 text-sm text-[var(--muted)]">
          {history.map((event) => (
            <li key={event.id}>
              {new Date(event.at).toLocaleTimeString('pl-PL')} ·{' '}
              {EVENT_LABEL[event.type] ?? event.type}
              {event.actorName && ` · ${event.actorName}`}
              {event.reason && ` · ${event.reason}`}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  created: 'utworzone',
  item_added: 'dodano pozycję',
  item_removed: 'usunięto pozycję',
  quantity_changed: 'zmieniono ilość',
  confirmed: 'potwierdzone',
  rejected: 'odrzucone',
  status_changed: 'zmiana statusu',
  canceled: 'anulowane',
};

/** Kto dodał, dla kogo, kto ostatnio zmienił — to zwykle trzy różne osoby. */
function Attribution({ item }: { item: StaffOrderDetail['items'][number] }) {
  const parts = [
    item.addedByStaff
      ? `dodane przez obsługę${item.addedByName ? ` (${item.addedByName})` : ''}`
      : 'dodane przez gościa',
    item.forGuestName ? `dla: ${item.forGuestName}` : null,
    item.lastEditedByName ? `zmienione przez ${item.lastEditedByName}` : null,
  ].filter(Boolean);
  return <>{parts.join(' · ')}</>;
}

function Stepper({
  value,
  onChange,
  disabled = false,
  min = 0,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
}) {
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        aria-label="Mniej"
        className="mono min-h-11 min-w-11 rounded-[var(--radius-control)] border border-[var(--line)] disabled:opacity-40"
      >
        −
      </button>
      <span className="mono min-w-8 text-center font-semibold">{value}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        aria-label="Więcej"
        className="mono min-h-11 min-w-11 rounded-[var(--radius-control)] border border-[var(--line)] disabled:opacity-40"
      >
        +
      </button>
    </span>
  );
}
