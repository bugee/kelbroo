'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { StaffShell } from '@/components/StaffShell';
import {
  fetchBillingOrders,
  fetchInvoiceDetails,
  fetchPlans,
  fetchSubscription,
  money,
  startCheckout,
  type BillingOrder,
  type BillingPeriod,
  type InvoiceDetails,
  type PlanCatalog,
  type PlanOffer,
  type SubscriptionState,
} from '@/lib/api';

export default function BillingPage() {
  return (
    <StaffShell>
      {(staff) =>
        staff.role === 'owner' ? (
          <Billing />
        ) : (
          // Abonament to zobowiązanie firmy, nie ustawienie lokalu.
          <p className="text-sm text-[var(--muted)]">
            Abonament prowadzi właściciel konta. Poproś go o opłacenie, albo napisz na
            kontakt@kelbroo.com.
          </p>
        )
      }
    </StaffShell>
  );
}

const OKRESY: { id: BillingPeriod; label: string; hint: string }[] = [
  { id: 'month', label: 'Miesięcznie', hint: 'Płacisz co miesiąc' },
  { id: 'year', label: 'Rocznie', hint: 'Dwa miesiące taniej' },
];

function Billing() {
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [period, setPeriod] = useState<BillingPeriod>('month');
  const [plan, setPlan] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [katalog, abonament, historia, nabywca] = await Promise.all([
        fetchPlans(),
        fetchSubscription(),
        fetchBillingOrders(),
        fetchInvoiceDetails(),
      ]);
      setCatalog(katalog);
      setState(abonament);
      setOrders(historia);
      setPlan((current) => current ?? abonament.plan ?? 'pro');
      // Dane do faktury podpowiadamy z tego, co już wiemy z rejestracji —
      // przepisywanie NIP-u drugi raz to najkrótsza droga do literówki.
      setInvoice((current) => current ?? nabywca);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać cennika.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !catalog) {
    return (
      <p role="alert" className="text-sm text-[var(--orange)]">
        {error}
      </p>
    );
  }

  if (!catalog || !invoice) {
    return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;
  }

  const dostepne = catalog.plans.filter((oferta) => oferta.prices[period] !== null);
  const wybrany = dostepne.find((oferta) => oferta.id === plan) ?? dostepne[0];

  const zaplac = async (zdarzenie: React.FormEvent<HTMLFormElement>) => {
    zdarzenie.preventDefault();
    if (!wybrany) return;
    setBusy(true);
    setError(null);
    try {
      const { redirectUri } = await startCheckout(wybrany.id, period, invoice);
      // Stąd wychodzimy z aplikacji. Wracamy na /abonament/wynik, ale zakup
      // potwierdza dopiero powiadomienie operatora, nie ten powrót.
      window.location.href = redirectUri;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się rozpocząć płatności.');
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Abonament</h1>

      {state && <Stan stan={state} />}

      {!catalog.enabled && (
        <p
          role="alert"
          className="mono mt-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--teal-wash)] p-4 text-sm"
        >
          Płatności online nie są jeszcze uruchomione. Napisz na kontakt@kelbroo.com — przedłużymy
          abonament ręcznie.
        </p>
      )}

      <form onSubmit={(zdarzenie) => void zaplac(zdarzenie)} className="mt-6">
        <fieldset disabled={!catalog.enabled || busy} className="disabled:opacity-60">
          <legend className="sr-only">Wybór planu i okresu</legend>

          <div className="mb-4 flex gap-2" role="group" aria-label="Okres rozliczeniowy">
            {OKRESY.map((okres) => (
              <button
                key={okres.id}
                type="button"
                aria-pressed={period === okres.id}
                onClick={() => setPeriod(okres.id)}
                className={`mono min-h-11 flex-1 rounded-[var(--radius-control)] border px-4 text-sm font-semibold ${
                  period === okres.id
                    ? 'border-[var(--teal)] bg-[var(--teal-wash)] text-[var(--teal)]'
                    : 'border-[var(--line)] text-[var(--muted)]'
                }`}
              >
                {okres.label}
                <span className="mono ml-2 text-xs font-normal">{okres.hint}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {dostepne.map((oferta) => (
              <PlanCard
                key={oferta.id}
                oferta={oferta}
                period={period}
                wybrany={wybrany?.id === oferta.id}
                onSelect={() => setPlan(oferta.id)}
              />
            ))}
          </div>

          <FakturaForm dane={invoice} onChange={setInvoice} />

          {wybrany && (
            <Podsumowanie oferta={wybrany} period={period} vat={catalog.vatRatePercent} />
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-[var(--orange)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mono mt-4 min-h-12 w-full rounded-[var(--radius-control)] bg-[var(--orange)] font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Przekierowuję do PayU…' : 'Zapłać przez PayU'}
          </button>
          <p className="mt-2 text-center text-xs text-[var(--muted)]">
            Płatność obsługuje PayU. Fakturę VAT wyślemy na podany adres.
          </p>
        </fieldset>
      </form>

      <Historia orders={orders} />
    </div>
  );
}

function Stan({ stan }: { stan: SubscriptionState }) {
  const doKiedy = stan.currentPeriodEnd
    ? new Date(stan.currentPeriodEnd).toLocaleDateString('pl-PL')
    : null;

  return (
    <p className="mono mt-2 text-sm text-[var(--muted)]">
      {stan.active ? (
        <>
          {stan.trial ? 'Okres próbny' : 'Opłacone'} do <strong>{doKiedy ?? 'odwołania'}</strong>
          {stan.daysLeft !== null && ` · ${stan.daysLeft} dni`}
        </>
      ) : (
        <span className="text-[var(--orange)]">
          Abonament wygasł{doKiedy ? ` ${doKiedy}` : ''} — nowe zamówienia są wstrzymane.
        </span>
      )}
    </p>
  );
}

function PlanCard({
  oferta,
  period,
  wybrany,
  onSelect,
}: {
  oferta: PlanOffer;
  period: BillingPeriod;
  wybrany: boolean;
  onSelect: () => void;
}) {
  const cena = oferta.prices[period]!;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={wybrany}
      className={`rounded-[var(--radius-card)] border p-4 text-left ${
        wybrany ? 'border-[var(--teal)] bg-[var(--teal-wash)]' : 'border-[var(--line)]'
      }`}
    >
      <span className="font-[family-name:var(--font-display)] text-lg font-bold">
        {oferta.name}
      </span>
      <span className="mono mt-1 block text-xl font-bold">
        {money(cena.netCents, 'PLN')}
        <span className="text-sm font-normal text-[var(--muted)]">
          {' '}
          netto / {period === 'year' ? 'rok' : 'mies.'}
        </span>
      </span>
      <span className="mono mt-2 block text-xs text-[var(--muted)]">
        do {oferta.limits.tableLimit} stolików · {oferta.limits.languageLimit} języków
      </span>
    </button>
  );
}

function Podsumowanie({
  oferta,
  period,
  vat,
}: {
  oferta: PlanOffer;
  period: BillingPeriod;
  vat: number;
}) {
  const cena = oferta.prices[period]!;

  return (
    <dl className="mono mt-4 rounded-[var(--radius-card)] border border-[var(--line)] p-4 text-sm">
      <Wiersz nazwa={`${oferta.name} — ${period === 'year' ? 'rok' : 'miesiąc'}`}>
        {money(cena.netCents, 'PLN')}
      </Wiersz>
      <Wiersz nazwa={`VAT ${vat}%`}>{money(cena.vatCents, 'PLN')}</Wiersz>
      <div className="mt-2 flex justify-between border-t border-[var(--line)] pt-2 font-bold">
        <dt>Do zapłaty</dt>
        <dd>{money(cena.grossCents, 'PLN')}</dd>
      </div>
    </dl>
  );
}

function Wiersz({ nazwa, children }: { nazwa: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between py-0.5">
      <dt className="text-[var(--muted)]">{nazwa}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Dane nabywcy.
 *
 * Zbierane tu, a nie przy rejestracji: formularz wejścia na okres próbny ma być
 * krótki. Adres staje się obowiązkowy dopiero przy sprzedaży, bo faktura VAT
 * bez adresu nabywcy nie jest fakturą.
 */
/**
 * Wygląd pola formularza.
 *
 * Ramka i tło **nie są ozdobnikiem**: pole bez nich zlewa się z kartą i nie widać,
 * gdzie w ogóle można pisać. Tło `--surface` odcina się od `--ground` karty w obu
 * motywach, a `--line-strong` jest jedyną obwódką czytelną i na jasnym, i na ciemnym.
 */
const POLE =
  'min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line-strong)] ' +
  'bg-[var(--surface)] px-3 text-[var(--ink)] ' +
  'focus:border-[var(--teal)] focus:outline-2 focus:outline-offset-0 focus:outline-[var(--teal)]';

function FakturaForm({
  dane,
  onChange,
}: {
  dane: InvoiceDetails;
  onChange: (dane: InvoiceDetails) => void;
}) {
  const pole = (klucz: keyof InvoiceDetails) => ({
    value: dane[klucz],
    onChange: (zdarzenie: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...dane, [klucz]: zdarzenie.target.value }),
    className: POLE,
  });

  return (
    <section className="mt-4 rounded-[var(--radius-card)] border border-[var(--line)] p-4">
      <h2 className="mb-3 font-semibold">Dane do faktury</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Pole label="NIP">
          <input {...pole('nip')} required inputMode="numeric" className={`mono ${POLE}`} />
        </Pole>
        <Pole label="E-mail do faktur">
          <input {...pole('billingEmail')} type="email" required />
        </Pole>
        <Pole label="Ulica i numer" szeroko>
          <input {...pole('address')} required />
        </Pole>
        <Pole label="Kod pocztowy">
          <input {...pole('postalCode')} required placeholder="00-000" className={`mono ${POLE}`} />
        </Pole>
        <Pole label="Miejscowość">
          <input {...pole('city')} required />
        </Pole>
      </div>
    </section>
  );
}

function Pole({
  label,
  children,
  szeroko,
}: {
  label: string;
  children: React.ReactNode;
  szeroko?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${szeroko ? 'sm:col-span-2' : ''}`}>
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}

const STATUS_LABEL: Record<BillingOrder['status'], string> = {
  new: 'rozpoczęta',
  pending: 'w trakcie',
  completed: 'opłacona',
  canceled: 'nieudana',
};

function Historia({ orders }: { orders: BillingOrder[] }) {
  if (orders.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-2 font-semibold">Historia płatności</h2>
      <table className="mono w-full text-sm">
        <thead className="text-left text-[var(--muted)]">
          <tr>
            <th className="py-1 font-normal">Data</th>
            <th className="py-1 font-normal">Plan</th>
            <th className="py-1 text-right font-normal">Brutto</th>
            <th className="py-1 text-right font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((zamowienie) => (
            <tr key={zamowienie.id} className="border-t border-[var(--line)]">
              <td className="py-1.5">
                {new Date(zamowienie.createdAt).toLocaleDateString('pl-PL')}
              </td>
              <td className="py-1.5 uppercase">
                {zamowienie.plan} · {zamowienie.period === 'year' ? 'rok' : 'mies.'}
              </td>
              <td className="py-1.5 text-right">
                {money(zamowienie.grossCents, zamowienie.currency)}
              </td>
              <td
                className={`py-1.5 text-right ${
                  zamowienie.status === 'completed' ? 'text-[var(--teal)]' : 'text-[var(--muted)]'
                }`}
              >
                {STATUS_LABEL[zamowienie.status]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Faktury VAT wysyłamy na adres podany wyżej.{' '}
        <Link href="/settings" className="underline">
          Ustawienia lokalu
        </Link>
      </p>
    </section>
  );
}
