'use client';

import { useCallback, useEffect, useState } from 'react';
import { StaffShell } from '@/components/StaffShell';
import { fetchRestaurant, money, updateRestaurant, type RestaurantSettings } from '@/lib/api';

export default function SettingsPage() {
  return <StaffShell>{() => <Settings />}</StaffShell>;
}

function Settings() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSettings(await fetchRestaurant());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać ustawień.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async (payload: Partial<RestaurantSettings>) => {
    setError(null);
    setNotice(null);
    try {
      const result = await updateRestaurant(payload);
      if (result.removedLocales.length > 0) {
        setNotice(
          `Usunięto języki: ${result.removedLocales.join(', ')}. Tłumaczenia w nich zostają w bazie, ale nikt ich nie zobaczy.`,
        );
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać.');
    }
  };

  if (error && !settings) return <p className="text-[var(--orange)]">{error}</p>;
  if (!settings) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  return (
    <div className="max-w-2xl">
      {error && <p className="mb-3 text-[var(--orange)]">{error}</p>}
      {notice && (
        <p className="mb-3 rounded-[var(--radius-control)] bg-[var(--orange-wash)] p-3 text-sm">
          {notice}
        </p>
      )}

      <Card title="Lokal">
        <Row label="Nazwa">
          <TextInput
            value={settings.name}
            onCommit={(value) => void save({ name: value })}
            className="w-full"
          />
        </Row>
        <Row label="Adres">
          <TextInput
            value={settings.address ?? ''}
            onCommit={(value) => void save({ address: value })}
            className="w-full"
          />
        </Row>
        <Row label="Waluta">
          <span className="mono">{settings.currency}</span>
        </Row>
        <Row label="Strefa czasowa">
          <span className="mono">{settings.timezone}</span>
        </Row>
      </Card>

      <Card title="Zamawianie">
        <Row label="Tryb">
          {/* Jedyny dostępny tryb etapu 1 — płatności online jeszcze nie ma,
              więc pole jest informacyjne, nie wyborem. */}
          <span className="mono">
            płatność u kelnera
            <span className="ml-2 text-xs text-[var(--muted)]">
              płatności online w przygotowaniu
            </span>
          </span>
        </Row>

        <Toggle
          label="Kelner potwierdza zamówienia"
          hint="Zamówienie czeka na potwierdzenie przy stoliku, zanim trafi do kuchni. Zalecane bez płatności z góry."
          checked={settings.requireStaffConfirmation}
          onChange={(value) => void save({ requireStaffConfirmation: value })}
        />

        <Toggle
          label="Obsługa otwiera stolik"
          hint="Gość po skanie widzi menu, ale nie może zamówić, dopóki kelner nie otworzy wizyty."
          checked={settings.tableActivationRequired}
          onChange={(value) => void save({ tableActivationRequired: value })}
        />

        <Row label="Minimalne zamówienie">
          <MoneyInput
            cents={settings.minOrderCents}
            currency={settings.currency}
            onCommit={(cents) => void save({ minOrderCents: cents })}
          />
        </Row>

        <Row label="Limit otwartego rachunku">
          <MoneyInput
            cents={settings.openBillLimitCents ?? 0}
            currency={settings.currency}
            onCommit={(cents) => void save({ openBillLimitCents: cents })}
          />
        </Row>

        <Row label="Doba biznesowa zaczyna się o">
          <TextInput
            value={String(settings.businessDayStartHour)}
            onCommit={(value) => void save({ businessDayStartHour: Number(value) })}
            className="mono w-20"
          />
        </Row>
      </Card>

      <Card title="Języki">
        <Row label="Domyślny">
          <span className="mono">{settings.defaultLocale}</span>
        </Row>
        <Row label="Obsługiwane">
          <TextInput
            value={settings.supportedLocales.join(', ')}
            onCommit={(value) =>
              void save({
                supportedLocales: value
                  .split(',')
                  .map((entry) => entry.trim())
                  .filter(Boolean),
              })
            }
            className="mono w-full"
          />
        </Row>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Brak tłumaczenia w danym języku oznacza fallback na język domyślny, nigdy pusty ekran.
        </p>
      </Card>

      {settings.subscription && (
        <Card title="Abonament">
          <Row label="Plan">
            <span className="mono uppercase">{settings.subscription.plan}</span>
          </Row>
          <Row label="Status">
            <span className="mono">{settings.subscription.status}</span>
          </Row>
          <Row label="Limity">
            <span className="mono">
              {settings.subscription.tableLimit} stolików · {settings.subscription.languageLimit}{' '}
              języków
            </span>
          </Row>
        </Card>
      )}

      <Card title="Fiskalizacja">
        <Row label="Tryb">
          <span className="mono">poza kelbroo</span>
        </Row>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Paragony wystawia kasa lokalu. kelbroo zapisuje płatności wyłącznie ewidencyjnie, do
          raportów i rozliczenia zmiany.
        </p>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 className="text-base">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] py-2 last:border-0">
      <span className="w-56 shrink-0 text-sm text-[var(--muted)]">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 border-b border-[var(--line)] py-3 last:border-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-5"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-[var(--muted)]">{hint}</span>
      </span>
    </label>
  );
}

/** Zapis dopiero po opuszczeniu pola — inaczej każda litera to żądanie. */
function TextInput({
  value,
  onCommit,
  className = '',
}: {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      className={`min-h-11 rounded-[var(--radius-control)] border border-[var(--line)] px-3 ${className}`}
    />
  );
}

function MoneyInput({
  cents,
  currency,
  onCommit,
}: {
  cents: number;
  currency: string;
  onCommit: (cents: number) => void;
}) {
  const [draft, setDraft] = useState((cents / 100).toFixed(2));
  useEffect(() => setDraft((cents / 100).toFixed(2)), [cents]);

  return (
    <span className="flex items-center gap-2">
      <input
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          // Grosze liczone z tekstu, nigdy przez mnożenie liczby zmiennoprzecinkowej.
          const parsed = Math.round(Number(draft.replace(',', '.')) * 100);
          if (Number.isFinite(parsed) && parsed !== cents) onCommit(parsed);
        }}
        className="mono min-h-11 w-28 rounded-[var(--radius-control)] border border-[var(--line)] px-3"
      />
      <span className="mono text-xs text-[var(--muted)]">{money(cents, currency)}</span>
    </span>
  );
}
