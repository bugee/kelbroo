'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  enterTable,
  fetchOrders,
  formatMoney,
  lineTotal,
  submitOrder,
  type CartLine,
  type Dish,
  type SessionOrders,
  type TableEntry,
} from '@/lib/api';
import { DishSheet } from './DishSheet';

type View = 'menu' | 'cart' | 'status';

/** Etykiety statusów po polsku — gość nie ma widzieć nazw z bazy. */
const STATUS_LABEL: Record<string, string> = {
  submitted: 'Wysłane',
  awaiting_confirmation: 'Czeka na potwierdzenie obsługi',
  confirmed: 'Przyjęte',
  preparing: 'W przygotowaniu',
  ready: 'Gotowe',
  served: 'Wydane',
  closed: 'Rozliczone',
  rejected: 'Odrzucone',
  canceled: 'Anulowane',
};

export function GuestApp({ qrToken }: { qrToken: string }) {
  const [entry, setEntry] = useState<TableEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('menu');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [openDish, setOpenDish] = useState<Dish | null>(null);
  const [orders, setOrders] = useState<SessionOrders | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(
    async (lang?: string) => {
      try {
        setEntry(await enterTable(qrToken, lang));
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać menu.');
      }
    },
    [qrToken],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refreshOrders = useCallback(async () => {
    try {
      setOrders(await fetchOrders(qrToken));
    } catch {
      /* ekran statusu może chwilowo nie mieć danych */
    }
  }, [qrToken]);

  // Do czasu WebSocketów odświeżamy status cyklicznie. Wi-fi w lokalach bywa
  // słabe, więc i tak potrzebny będzie fallback na polling.
  useEffect(() => {
    if (view !== 'status') return;
    void refreshOrders();
    const timer = setInterval(() => void refreshOrders(), 10_000);
    return () => clearInterval(timer);
  }, [view, refreshOrders]);

  if (error) {
    return (
      <Centered>
        <h1 className="text-xl">Nie można otworzyć menu</h1>
        <p className="mt-2 text-[var(--muted)]">{error}</p>
      </Centered>
    );
  }

  if (!entry) {
    return (
      <Centered>
        <p className="mono text-sm text-[var(--muted)]">Wczytuję menu…</p>
      </Centered>
    );
  }

  const currency = entry.restaurant.currency;
  const cartTotal = cart.reduce((sum, line) => sum + lineTotal(line), 0);
  const canOrder = entry.session.orderingEnabled;

  const send = async () => {
    setSending(true);
    try {
      await submitOrder(qrToken, cart);
      setCart([]);
      setView('status');
      await refreshOrders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się złożyć zamówienia.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg pb-28">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="truncate text-lg">{entry.restaurant.name}</h1>
          <span className="mono shrink-0 text-xs text-[var(--muted)]">
            {entry.table.label} · #{entry.session.number}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span
              className="inline-block size-5 rounded-full"
              style={{ background: entry.participant.color }}
              aria-hidden
            />
            {entry.participant.displayName}
          </span>
          <div className="flex gap-1">
            {entry.restaurant.supportedLocales.map((locale) => (
              <button
                key={locale}
                type="button"
                onClick={() => void load(locale)}
                aria-pressed={entry.restaurant.locale === locale}
                className={`mono rounded px-2 py-1 text-xs uppercase ${
                  entry.restaurant.locale === locale
                    ? 'bg-[var(--teal-wash)] text-[var(--teal)]'
                    : 'text-[var(--muted)]'
                }`}
              >
                {locale}
              </button>
            ))}
          </div>
        </div>
      </header>

      {!canOrder && (
        <p className="m-4 rounded-[var(--radius-control)] bg-[var(--orange-wash)] p-4 text-sm">
          {entry.session.blockedReason === 'awaiting_staff_activation'
            ? 'Poproś obsługę o otwarcie stolika — menu możesz przeglądać już teraz.'
            : 'Zamawianie jest chwilowo niedostępne. Poproś obsługę.'}
        </p>
      )}

      {view === 'menu' && <MenuView entry={entry} onPick={setOpenDish} canOrder={canOrder} />}
      {view === 'cart' && (
        <CartView
          cart={cart}
          currency={currency}
          onRemove={(index) => setCart((c) => c.filter((_, i) => i !== index))}
        />
      )}
      {view === 'status' && <StatusView orders={orders} currency={currency} />}

      {openDish && (
        <DishSheet
          dish={openDish}
          onClose={() => setOpenDish(null)}
          onAdd={(line) => {
            setCart((c) => [...c, line]);
            setOpenDish(null);
          }}
        />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-[var(--line)] bg-[var(--surface)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {view === 'cart' && cart.length > 0 ? (
          <button
            type="button"
            disabled={sending || !canOrder}
            onClick={() => void send()}
            className="flex min-h-14 w-full items-center justify-between rounded-[var(--radius-control)] bg-[var(--orange)] px-5 font-semibold text-white disabled:opacity-50"
          >
            {/* W trybie pay_at_table aplikacja nie zawiera żadnej ścieżki
                płatności — przycisk brzmi „Zamawiam", nie „Zamawiam i płacę". */}
            <span>{sending ? 'Wysyłam…' : 'Zamawiam'}</span>
            <span className="mono">{formatMoney(cartTotal, currency)}</span>
          </button>
        ) : (
          <div className="flex gap-2">
            <TabButton active={view === 'menu'} onClick={() => setView('menu')}>
              Menu
            </TabButton>
            <TabButton active={view === 'cart'} onClick={() => setView('cart')}>
              Koszyk{cart.length > 0 ? ` · ${formatMoney(cartTotal, currency)}` : ''}
            </TabButton>
            <TabButton active={view === 'status'} onClick={() => setView('status')}>
              Zamówienia
            </TabButton>
          </div>
        )}
      </nav>
    </div>
  );
}

function MenuView({
  entry,
  onPick,
  canOrder,
}: {
  entry: TableEntry;
  onPick: (dish: Dish) => void;
  canOrder: boolean;
}) {
  return (
    <main className="px-4">
      {entry.menu.map((category) => (
        <section key={category.id} className="mt-6">
          <h2 className="text-base">{category.name}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {category.items.map((dish) => (
              <li key={dish.id}>
                <button
                  type="button"
                  disabled={!dish.isAvailable || !canOrder}
                  onClick={() => onPick(dish)}
                  className="flex w-full items-start justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 text-left disabled:opacity-45"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{dish.name}</span>
                    {dish.description && (
                      <span className="mt-0.5 block text-sm text-[var(--muted)]">
                        {dish.description}
                      </span>
                    )}
                    {!dish.isAvailable && (
                      <span className="mono mt-1 block text-xs text-[var(--orange)]">
                        Chwilowo niedostępne
                      </span>
                    )}
                    {dish.dietaryTags.length > 0 && (
                      <span className="mono mt-1 block text-xs text-[var(--muted)]">
                        {dish.dietaryTags.join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="mono shrink-0 font-semibold">
                    {formatMoney(dish.priceCents, dish.currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

function CartView({
  cart,
  currency,
  onRemove,
}: {
  cart: CartLine[];
  currency: string;
  onRemove: (index: number) => void;
}) {
  if (cart.length === 0) {
    return (
      <Centered>
        <p className="text-[var(--muted)]">Koszyk jest pusty.</p>
      </Centered>
    );
  }

  return (
    <main className="px-4 pt-4">
      <h2 className="text-base">Koszyk</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {cart.map((line, index) => (
          <li
            key={`${line.dish.id}-${index}`}
            className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <span>
                <span className="mono">{line.quantity}× </span>
                <span className="font-semibold">{line.dish.name}</span>
              </span>
              <span className="mono shrink-0">{formatMoney(lineTotal(line), currency)}</span>
            </div>
            {line.modifiers.length > 0 && (
              <p className="mt-1 text-sm text-[var(--muted)]">
                {line.modifiers.map((m) => m.name).join(' + ')}
              </p>
            )}
            {line.note && <p className="mt-1 text-sm italic text-[var(--muted)]">{line.note}</p>}
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="mt-2 min-h-9 text-sm text-[var(--muted)] underline"
            >
              Usuń
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

function StatusView({ orders, currency }: { orders: SessionOrders | null; currency: string }) {
  if (!orders || orders.orders.length === 0) {
    return (
      <Centered>
        <p className="text-[var(--muted)]">Nie masz jeszcze żadnych zamówień.</p>
      </Centered>
    );
  }

  return (
    <main className="px-4 pt-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base">Rachunek stolika</h2>
        <span className="mono font-semibold">
          {formatMoney(orders.session.totalCents, currency)}
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {orders.orders.map((order) => (
          <li
            key={order.id}
            className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper)] p-4"
          >
            <div className="flex items-baseline justify-between">
              <span className="mono text-sm">#{order.orderNumber}</span>
              <span className="mono text-xs text-[var(--teal)]">
                {STATUS_LABEL[order.status] ?? order.status}
              </span>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 text-sm">
                  <span>
                    <span className="mono">{item.quantity}× </span>
                    {item.name}
                    {/* Gość musi widzieć, że coś na jego rachunku pojawiło się
                        nie z jego ręki — inaczej rachunek jest nieweryfikowalny. */}
                    {item.addedByStaff && (
                      <span className="mono ml-2 text-xs text-[var(--muted)]">
                        dodane przez obsługę
                      </span>
                    )}
                  </span>
                  <span className="mono shrink-0">
                    {formatMoney(item.unitPriceCents * item.quantity, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-12 flex-1 rounded-[var(--radius-control)] px-3 text-sm font-semibold ${
        active ? 'bg-[var(--teal-wash)] text-[var(--teal)]' : 'text-[var(--muted)]'
      }`}
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-8 text-center">
      {children}
    </main>
  );
}
