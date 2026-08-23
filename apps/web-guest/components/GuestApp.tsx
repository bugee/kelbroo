'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  callWaiter,
  cancelWaiter,
  connectVisit,
  decidePendingGuest,
  fetchPendingGuests,
  enterTable,
  forgetVisit,
  fetchActiveCalls,
  fetchOrders,
  formatMoney,
  lineTotal,
  requestBill,
  requestTableOpen,
  submitOrder,
  type ActiveCall,
  type BillRequestResult,
  type CartLine,
  type Dish,
  type GuestSplitMode,
  type PaymentPreference,
  type PendingGuest,
  type SessionOrders,
  type TableEntry,
} from '@/lib/api';
import { guestStatusLabel } from '@kelbroo/types';
import { ThemeToggle } from '@kelbroo/ui/theme';
import { GuestMark } from '@kelbroo/ui/guest-mark';
import { DishSheet } from './DishSheet';

type View = 'menu' | 'cart' | 'status';


export function GuestApp({ qrToken }: { qrToken: string }) {
  const [entry, setEntry] = useState<TableEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('menu');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [openDish, setOpenDish] = useState<Dish | null>(null);
  const [orders, setOrders] = useState<SessionOrders | null>(null);
  // Licznik zmian z kanału wizyty. Przycisk kelnera nasłuchuje go bez własnego
  // połączenia — jedno gniazdo na kartę, tak jak w panelu.
  const [callTick, setCallTick] = useState(0);
  const [sending, setSending] = useState(false);
  // Kolejka wpuszczania widoczna wyłącznie u hosta — serwer i tak odsyła innym pustą listę.
  const [pending, setPending] = useState<PendingGuest[]>([]);

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

  const refreshPending = useCallback(async () => {
    try {
      setPending(await fetchPendingGuests(qrToken));
    } catch {
      /* brak kolejki znaczy tyle, że nie ma kogo wpuszczać */
    }
  }, [qrToken]);

  useEffect(() => {
    if (!entry?.participant.isHost) return;
    void refreshPending();
  }, [entry?.participant.isHost, refreshPending]);

  /**
   * Status zamówienia zmienia się na ekranie gościa sam, gdy kuchnia go przestawi.
   *
   * Hook stoi TU, a nie niżej: pod spodem są wczesne `return` dla błędu i dla
   * jeszcze niewczytanej wizyty. Wywołanie po nich zmieniałoby liczbę hooków
   * między renderami i wywracało cały ekran (React #310).
   *
   * Zależy od `entry.participant.id`, bo `connectVisit` czyta token gościa
   * z pamięci przeglądarki, a ten zapisuje się dopiero z odpowiedzią na skan —
   * czyli po pierwszym przebiegu efektów. Bez tej zależności gość przy pierwszym
   * skanie nie dostawał gniazda w ogóle i żył wyłącznie odpytywaniem co 10 s.
   */
  useEffect(() => {
    if (!entry?.participant.id) return;

    const channel = connectVisit(qrToken, (kind) => {
      if (kind === 'orders') void refreshOrders();
      // Wpuszczenie zmienia uprawnienia, nie dane na ekranie — trzeba wczytać
      // wizytę od nowa, żeby gość dostał menu bez odświeżania strony.
      else if (kind === 'access') {
        void load();
        // Kolejkę wpuszczania ma tylko host. Serwer i tak odsyła innym pustą
        // listę, ale przy stoliku na kilka telefonów to kilka żądań na każde
        // zdarzenie — bez powodu i akurat w chwili, gdy dzieje się najwięcej.
        if (entry?.participant.isHost) void refreshPending();
      } else setCallTick((tick) => tick + 1);
    });
    return () => channel?.close();
  }, [
    qrToken,
    entry?.participant.id,
    entry?.participant.isHost,
    refreshOrders,
    refreshPending,
    load,
  ]);

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

  // Zablokowany stolik: gość nie dostaje menu z banerem, tylko jedno wyjście.
  // Pokazanie karty sugerowałoby, że da się zamówić, a nie da.
  if (entry.session.blockedReason === 'table_blocked') {
    return <BlockedTable qrToken={qrToken} tableLabel={entry.table.label} onOpened={load} />;
  }

  if (entry.session.blockedReason === 'visit_finished') {
    return <FinishedVisit qrToken={qrToken} />;
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
          <span className="mono flex shrink-0 items-center gap-2 text-xs text-[var(--muted)]">
            {entry.table.label} · #{entry.session.number}
            <TableRoster participants={entry.participants} meId={entry.participant.id} />
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          {/*
            Sam kształt w kolorze — gość widzi go i nazywa własnymi słowami.
            Podpis „żółty samochodzik" byłby dopisywaniem oczywistości pod obrazkiem;
            nazwa zostaje w `aria-label`, dla czytników ekranu.
          */}
          <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <GuestMark
              symbol={entry.participant.symbol}
              color={entry.participant.color}
              size={22}
            />
            {entry.participant.displayName}
            {/* Host płaci domyślnie i do niego trafia nierozdzielony grosz przy
                podziale — powinien o tym wiedzieć, zanim przyjdzie rachunek. */}
            {entry.participant.isHost && (
              <span className="mono rounded-full bg-[var(--teal-wash)] px-2 py-0.5 text-[10px] text-[var(--teal)]">
                host
              </span>
            )}
          </span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
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
        <div className="m-4 rounded-[var(--radius-control)] bg-[var(--orange-wash)] p-4 text-sm">
          {entry.session.blockedReason === 'awaiting_staff_activation' ? (
            <>
              <p>Stolik czeka na otwarcie przez obsługę — menu możesz przeglądać już teraz.</p>
              {/* Zgłoszenie idzie do tej samej kolejki co wołanie kelnera, więc
                  gość nie musi nikogo szukać wzrokiem po sali. */}
              <AskToOpen qrToken={qrToken} onOpened={load} />
            </>
          ) : entry.session.blockedReason === 'awaiting_host_approval' ? (
            <p>
              Osoba, która otworzyła stolik, musi Cię wpuścić. Pokaż jej swój znak z góry ekranu —
              menu możesz przeglądać już teraz.
            </p>
          ) : (
            <p>Zamawianie jest chwilowo niedostępne. Poproś obsługę.</p>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <PendingGuests
          guests={pending}
          onDecide={async (id, decision) => {
            await decidePendingGuest(qrToken, id, decision);
            await refreshPending();
          }}
        />
      )}

      {view === 'menu' && <MenuView entry={entry} onPick={setOpenDish} canOrder={canOrder} />}
      {view === 'cart' && (
        <CartView
          cart={cart}
          currency={currency}
          onRemove={(index) => setCart((c) => c.filter((_, i) => i !== index))}
        />
      )}
      {view === 'status' && <StatusView orders={orders} currency={currency} qrToken={qrToken} />}

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
            <CallWaiterButton qrToken={qrToken} tick={callTick} />
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

function StatusView({
  orders,
  currency,
  qrToken,
}: {
  orders: SessionOrders | null;
  currency: string;
  qrToken: string;
}) {
  if (!orders || orders.orders.length === 0) {
    return (
      <Centered>
        <p className="text-[var(--muted)]">Nie masz jeszcze żadnych zamówień.</p>
        <BillRequest qrToken={qrToken} currency={currency} />
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
                {guestStatusLabel(order.status)}
              </span>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    {/* Rachunek stolika jest wspólny, więc każda pozycja niesie znak
                        swojego właściciela — bez tego nie da się jej nikomu przypisać
                        przy dzieleniu rachunku. */}
                    {item.forParticipant && (
                      <GuestMark
                        symbol={item.forParticipant.symbol}
                        color={item.forParticipant.color}
                        size={16}
                      />
                    )}
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

      <BillRequest qrToken={qrToken} currency={currency} />
    </main>
  );
}

const PAYMENT_OPTIONS = ['card', 'cash', 'mixed'] as const;

const PAYMENT_LABEL: Record<PaymentPreference, string> = {
  card: 'Kartą',
  cash: 'Gotówką',
  mixed: 'Karta i gotówka',
};

const SPLIT_LABEL: Record<GuestSplitMode, string> = {
  none: 'Jeden rachunek',
  per_person: 'Każdy za siebie',
  equal: 'Po równo',
};

/**
 * Prośba o rachunek z wyborem podziału.
 *
 * Wybór trafia do rachunku wizyty od razu, ale zamknąć go może wyłącznie kelner —
 * gość nigdy nie oznacza wizyty jako zapłaconej.
 */
function BillRequest({ qrToken, currency }: { qrToken: string; currency: string }) {
  const [step, setStep] = useState<'closed' | 'split' | 'payment' | 'invoice'>('closed');
  const [splitMode, setSplitMode] = useState<GuestSplitMode>('none');
  const [payment, setPayment] = useState<PaymentPreference>('card');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BillRequestResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const ask = async (invoiceRequested: boolean) => {
    setBusy(true);
    setFailure(null);
    try {
      setResult(await requestBill(qrToken, splitMode, payment, invoiceRequested));
      setStep('closed');
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'Nie udało się poprosić o rachunek.');
      setStep('closed');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <section className="mt-6 rounded-[var(--radius-card)] border border-[var(--teal)] bg-[var(--teal-wash)] p-4">
        <p className="font-semibold text-[var(--teal)]">Kelner już wie — zaraz podejdzie.</p>
        <p className="mono mt-1 text-sm text-[var(--muted)]">
          {PAYMENT_LABEL[result.payment]}
          {result.invoiceRequested ? ' · faktura VAT' : ''}
        </p>
        {result.groups.length > 0 && (
          <ul className="mono mt-2 flex flex-col gap-1 text-sm">
            {result.groups.map((group, index) => (
              <li key={index} className="flex justify-between gap-3">
                <span>{group.members.join(', ') || group.label}</span>
                <span>{formatMoney(group.totalCents, currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (step === 'closed') {
    return (
      <section className="mt-6">
        {failure && <p className="mb-2 text-sm text-[var(--orange)]">{failure}</p>}
        <button
          type="button"
          onClick={() => setStep('split')}
          className="min-h-12 w-full rounded-[var(--radius-control)] bg-[var(--orange)] px-4 font-semibold text-white"
        >
          Poproś o rachunek
        </button>
      </section>
    );
  }

  /**
   * Trzy pytania, każde na osobnym ekranie.
   *
   * Razem byłyby formularzem do wypełnienia przy stole. Osobno to trzy stuknięcia,
   * z których każde od razu przesuwa dalej — i widać, ile jeszcze zostało.
   */
  return (
    <section className="mt-6 rounded-[var(--radius-card)] border border-[var(--line)] p-4">
      {step === 'split' && (
        <Question
          title="Jak chcecie zapłacić?"
          options={(Object.keys(SPLIT_LABEL) as GuestSplitMode[]).map((mode) => ({
            key: mode,
            label: SPLIT_LABEL[mode],
            onPick: () => {
              setSplitMode(mode);
              // „Karta i gotówka" ma sens wyłącznie przy dzielonym rachunku;
              // przy jednym trzeba cofnąć ewentualny wcześniejszy wybór.
              if (mode === 'none' && payment === 'mixed') setPayment('card');
              setStep('payment');
            },
          }))}
          onCancel={() => setStep('closed')}
        />
      )}

      {step === 'payment' && (
        <Question
          title="Czym zapłacicie?"
          options={PAYMENT_OPTIONS.filter(
            (option) => option !== 'mixed' || splitMode !== 'none',
          ).map((option) => ({
            key: option,
            label: PAYMENT_LABEL[option],
            onPick: () => {
              setPayment(option);
              setStep('invoice');
            },
          }))}
          onCancel={() => setStep('split')}
          cancelLabel="Wstecz"
        />
      )}

      {step === 'invoice' && (
        <Question
          title="Potrzebna faktura VAT?"
          hint="Dane firmy podacie kelnerowi przy stoliku."
          busy={busy}
          options={[
            { key: 'no', label: 'Nie, dziękuję', onPick: () => void ask(false) },
            { key: 'yes', label: 'Tak, poproszę fakturę', onPick: () => void ask(true) },
          ]}
          onCancel={() => setStep('payment')}
          cancelLabel="Wstecz"
        />
      )}
    </section>
  );
}

/** Jedno pytanie: tytuł i lista odpowiedzi, każda jednym stuknięciem. */
function Question({
  title,
  hint,
  options,
  onCancel,
  cancelLabel = 'Jeszcze nie',
  busy = false,
}: {
  title: string;
  hint?: string;
  options: { key: string; label: string; onPick: () => void }[];
  onCancel: () => void;
  cancelLabel?: string;
  busy?: boolean;
}) {
  return (
    <>
      <p className="text-sm font-semibold">{title}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
      <div className="mt-3 flex flex-col gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            disabled={busy}
            onClick={option.onPick}
            className="min-h-12 rounded-[var(--radius-control)] border border-[var(--line)] px-4 font-semibold disabled:opacity-50"
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="mt-3 min-h-11 text-sm text-[var(--muted)] underline"
      >
        {cancelLabel}
      </button>
    </>
  );
}

/**
 * Wezwanie kelnera.
 *
 * Stan pochodzi z serwera, nie z timera: „wysłane" znaczy, że zgłoszenie leży
 * w kolejce obsługi, a „kelner idzie" pojawia się dopiero, gdy ktoś je przyjął.
 * Przycisk, który sam po chwili wraca do punktu wyjścia, kłamałby dwa razy —
 * najpierw obiecując, że ktoś idzie, potem gubiąc trwające zgłoszenie.
 */
function CallWaiterButton({ qrToken, tick }: { qrToken: string; tick: number }) {
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const calls = await fetchActiveCalls(qrToken);
      setCall(calls.find((entry) => entry.reason === 'help') ?? null);
    } catch {
      // Utrata sieci nie może skasować widocznego stanu — zostawiamy ostatni znany.
    }
  }, [qrToken]);

  // Stan początkowy przy wejściu, a potem po każdym zdarzeniu z kanału wizyty.
  // `tick` rośnie, gdy kelner przyjmie albo zamknie zgłoszenie — polling zniknął
  // razem z podłączeniem realtime.
  useEffect(() => {
    void refresh();
  }, [refresh, tick]);

  const idzie = call?.status === 'acknowledged';
  /** Wysłane, ale jeszcze nieprzyjęte — jedyny stan, z którego da się wycofać. */
  const doWycofania = call !== null && !idzie;

  const send = async () => {
    setSending(true);
    setFailed(false);
    try {
      setCall(await callWaiter(qrToken, 'help'));
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  /**
   * Wycofanie zgłoszenia. Ten sam przycisk, bo to ta sama decyzja — „chcę
   * kelnera" i „jednak nie" — a przy stoliku liczy się jedno stuknięcie.
   */
  const cancel = async () => {
    setSending(true);
    setFailed(false);
    try {
      await cancelWaiter(qrToken);
      setCall(null);
    } catch {
      // Najczęstszy powód odmowy: kelner właśnie przyjął zgłoszenie. Stan
      // z serwera jest wtedy prawdziwszy niż nasz, więc go dociągamy.
      await refresh();
    } finally {
      setSending(false);
    }
  };

  const label = sending
    ? 'Wysyłam…'
    : failed
      ? 'Spróbuj jeszcze raz'
      : idzie
        ? 'Kelner idzie'
        : call
          ? 'Kelner — wysłane'
          : 'Kelner';

  return (
    <button
      type="button"
      // Blokujemy wyłącznie „Kelner idzie": zgłoszenia, po które ktoś już
      // wstał od baru, gość nie może cofnąć.
      disabled={sending || idzie}
      onClick={() => void (doWycofania ? cancel() : send())}
      // Bez `aria-label`: nadpisałby nazwę przycisku i czytnik ekranu mówiłby coś
      // innego, niż widać na nim napisane. Podpowiedź idzie tytułem, który dokłada
      // się do nazwy, zamiast ją zastępować.
      title={doWycofania ? 'Stuknij ponownie, żeby wycofać' : undefined}
      className={`mono min-h-12 shrink-0 rounded-[var(--radius-control)] border px-3 text-sm font-semibold disabled:opacity-100 ${
        idzie ? 'border-[var(--teal)] bg-[var(--teal-wash)] text-[var(--teal)]' : 'border-[var(--line)]'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Skład stolika: ile osób i kto.
 *
 * Rachunek jest wspólny, więc gość musi wiedzieć, z kim go dzieli — także
 * z kimś, kto jeszcze nic nie zamówił i nie pojawia się przy żadnej pozycji.
 *
 * Siebie na liście nie ma: własny znak stoi w nagłówku obok, a powtórzenie go
 * tutaj kazałoby gościowi szukać, który z nich jest jego.
 */
function TableRoster({
  participants,
  meId,
}: {
  participants: TableEntry['participants'];
  meId: string;
}) {
  const [open, setOpen] = useState(false);
  const pozostali = participants.filter((p) => p.id !== meId);

  /**
   * Zamknięcie kliknięciem obok i klawiszem Escape.
   *
   * Hook stoi PRZED wczesnym `return` poniżej — po nim liczba hooków zmieniałaby
   * się między renderami i wywracała cały ekran (React #310, już raz tu było).
   */
  useEffect(() => {
    if (!open) return;
    const zamknij = () => setOpen(false);
    const naKlawisz = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    // `click` bąbelkuje z przycisku, więc bez opóźnienia zamknęlibyśmy listę
    // tym samym stuknięciem, które ją otworzyło.
    const timer = setTimeout(() => document.addEventListener('click', zamknij), 0);
    document.addEventListener('keydown', naKlawisz);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', zamknij);
      document.removeEventListener('keydown', naKlawisz);
    };
  }, [open]);

  // Sam przy stoliku: licznik pokazywałby jedynkę i nie otwierał niczego.
  if (participants.length < 2) return null;

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen((czy) => !czy)}
        aria-expanded={open}
        aria-label={`Przy stoliku: ${participants.length}`}
        className="mono flex min-h-8 items-center gap-1 rounded-full border border-[var(--line)] px-2 py-0.5 text-[var(--muted)]"
      >
        <PeopleIcon />
        {participants.length}
      </button>

      {open && (
        <div
          className="absolute right-0 z-30 mt-2 w-56 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-lg"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-label="Przy stoliku"
        >
          <p className="text-xs font-semibold text-[var(--ink)]">Przy stoliku</p>
          <ul className="mt-2 flex flex-col gap-2">
            {pozostali.map((osoba) => (
              <li key={osoba.id} className="flex items-center gap-2 text-xs">
                <GuestMark symbol={osoba.symbol} color={osoba.color} size={18} />
                <span className="truncate">{osoba.displayName}</span>
                {osoba.isHost && (
                  <span className="mono ml-auto shrink-0 rounded-full bg-[var(--teal-wash)] px-2 py-0.5 text-[10px] text-[var(--teal)]">
                    host
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}

/** Dwie sylwetki — ikona grupy, bez podpisu. Nazwę niesie `aria-label` przycisku. */
function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm0 1.6c-3 0-6 1.5-6 3.4V19h12v-3c0-1.9-3-3.4-6-3.4z" />
      <path d="M16.5 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 1.4c-.6 0-1.2.07-1.75.2 1.35.85 2.25 2 2.25 3.4V19H22v-2.7c0-1.7-2.6-3-5.5-3z" />
    </svg>
  );
}

/**
 * Kolejka wpuszczania u hosta.
 *
 * Kod QR leży na stoliku na widoku — przy stoliku pod oknem odczyta go ktoś
 * z chodnika. Host jest jedyną osobą, która wie, kto naprawdę siedzi przy stole,
 * więc rozpoznaje czekających po znaku, nie po nicku.
 */
function PendingGuests({
  guests,
  onDecide,
}: {
  guests: PendingGuest[];
  onDecide: (id: string, decision: 'approve' | 'reject') => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setBusy(id);
    try {
      await onDecide(id, decision);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="m-4 rounded-[var(--radius-card)] border border-[var(--teal)] bg-[var(--teal-wash)] p-4">
      <h2 className="text-sm">
        {guests.length === 1 ? 'Ktoś chce dołączyć do stolika' : 'Chętni do stolika'}
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {guests.map((guest) => (
          <li key={guest.id} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm">
              <GuestMark symbol={guest.symbol} color={guest.color} size={24} />
              {guest.displayName}
            </span>
            <span className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busy === guest.id}
                onClick={() => void decide(guest.id, 'approve')}
                className="rounded-[var(--radius-control)] bg-[var(--orange)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Wpuść
              </button>
              <button
                type="button"
                disabled={busy === guest.id}
                onClick={() => void decide(guest.id, 'reject')}
                className="mono rounded-[var(--radius-control)] px-3 py-1.5 text-xs text-[var(--muted)] disabled:opacity-50"
              >
                To nie u nas
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Prośba o otwarcie stolika.
 *
 * Zgłoszenie trafia do tej samej kolejki co wołanie kelnera — widzą je kelner,
 * manager i właściciel, a otwarcie jest jednym kliknięciem po ich stronie.
 * Gość nie ma potem nic odświeżać: `onOpened` odpytuje serwer, aż stolik puści.
 */
function AskToOpen({ qrToken, onOpened }: { qrToken: string; onOpened: () => void }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const ask = async () => {
    setState('sending');
    try {
      await requestTableOpen(qrToken);
      setState('sent');
    } catch {
      setState('failed');
    }
  };

  // Gość przy zablokowanym stoliku nie ma sesji, więc nie ma też kanału realtime —
  // pokój wizyty wyprowadzamy z tokenu, a tokenu tu jeszcze nie ma. Zostaje
  // odpytywanie; to jedyne miejsce w aplikacji gościa, gdzie jest konieczne.
  useEffect(() => {
    const timer = setInterval(onOpened, 5_000);
    return () => clearInterval(timer);
  }, [onOpened]);

  if (state === 'sent') {
    return (
      <p className="mono mt-4 text-sm text-[var(--teal)]">
        Obsługa już wie. Stolik otworzy się tutaj sam.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={state === 'sending'}
        onClick={() => void ask()}
        className="mt-4 min-h-14 w-full rounded-[var(--radius-control)] bg-[var(--orange)] px-6 font-semibold text-white disabled:opacity-50"
      >
        {state === 'sending' ? 'Wysyłam…' : 'Poproś o otwarcie stolika'}
      </button>

      {state === 'failed' && (
        <p className="mt-3 text-sm text-[var(--orange)]">
          Nie udało się wysłać. Spróbuj jeszcze raz albo poproś obsługę bezpośrednio.
        </p>
      )}
    </>
  );
}

function BlockedTable({
  qrToken,
  tableLabel,
  onOpened,
}: {
  qrToken: string;
  tableLabel: string;
  onOpened: () => void;
}) {
  return (
    <Centered>
      <h1 className="text-xl">{tableLabel}</h1>
      <p className="mt-2 text-[var(--muted)]">
        Stolik czeka na przygotowanie. Obsługa otworzy go za chwilę.
      </p>
      <AskToOpen qrToken={qrToken} onOpened={onOpened} />
    </Centered>
  );
}

/**
 * Rachunek tej wizyty jest rozliczony.
 *
 * Odświeżenie strony po zapłaceniu zakładało wcześniej nową wizytę z nowym
 * uczestnikiem — gość, który właśnie zapłacił, stawał się kolejnym gościem
 * przy kolejnym rachunku. Nową wizytę otwiera się tu świadomie, nie przypadkiem.
 */
function FinishedVisit({ qrToken }: { qrToken: string }) {
  return (
    <Centered>
      <h1 className="text-xl">Rachunek rozliczony</h1>
      <p className="mt-2 text-[var(--muted)]">Dziękujemy za wizytę.</p>
      <button
        type="button"
        onClick={() => {
          forgetVisit(qrToken);
          window.location.reload();
        }}
        className="mt-6 min-h-12 text-sm text-[var(--teal)] underline"
      >
        Zaczynamy od nowa przy tym stoliku
      </button>
    </Centered>
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
