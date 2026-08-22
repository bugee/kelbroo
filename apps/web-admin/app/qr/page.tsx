'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { StaffShell } from '@/components/StaffShell';
import {
  createTable,
  fetchTables,
  guestUrlFor,
  regenerateQr,
  setTableActive,
  type AdminTable,
  type AdminTables,
} from '@/lib/api';

export default function QrPage() {
  return <StaffShell>{() => <Tables />}</StaffShell>;
}

function Tables() {
  const [data, setData] = useState<AdminTables | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const loaded = await fetchTables();
      setData(loaded);
      setError(null);

      // Kody generujemy w przeglądarce: nie ma potrzeby wystawiać obrazków
      // pod adresami, które musiałyby być chronione tokenem.
      const rendered = await Promise.all(
        loaded.tables.map(
          async (table) =>
            [
              table.id,
              await QRCode.toString(guestUrlFor(table.qrToken), {
                type: 'svg',
                margin: 0,
                errorCorrectionLevel: 'M',
              }),
            ] as const,
        ),
      );
      setCodes(Object.fromEntries(rendered));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać stolików.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Operacja się nie powiodła.');
    }
  };

  if (error && !data) return <p className="text-[var(--orange)]">{error}</p>;
  if (!data) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  return (
    <>
      {error && <p className="mb-3 text-[var(--orange)] print:hidden">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() =>
            void run(async () => {
              const label = window.prompt('Nazwa stolika, np. „Stolik 12":');
              if (!label) return;
              const zone = window.prompt('Strefa (opcjonalnie), np. „Taras":') ?? undefined;
              await createTable({ label, zone: zone || undefined });
            })
          }
          className="min-h-11 rounded-[var(--radius-control)] bg-[var(--teal)] px-4 text-sm font-semibold text-white"
        >
          Nowy stolik
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line)] px-4 text-sm font-semibold"
        >
          Drukuj arkusz
        </button>

        <span className="mono ml-auto text-xs text-[var(--muted)]">
          aktywnych {data.activeCount} z {data.tableLimit} w planie
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-6">
        {data.tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            svg={codes[table.id]}
            onRegenerate={() =>
              void run(async () => {
                const confirmed = window.confirm(
                  `Nowy kod dla „${table.label}" unieważni wydrukowaną naklejkę. Goście, którzy już zeskanowali, zamawiają dalej bez przeszkód. Kontynuować?`,
                );
                if (confirmed) await regenerateQr(table.id);
              })
            }
            onToggleActive={() => void run(() => setTableActive(table.id, !table.isActive))}
          />
        ))}
      </div>
    </>
  );
}

function TableCard({
  table,
  svg,
  onRegenerate,
  onToggleActive,
}: {
  table: AdminTable;
  svg: string | undefined;
  onRegenerate: () => void;
  onToggleActive: () => void;
}) {
  return (
    <article
      className={`flex break-inside-avoid flex-col items-center rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 text-center ${
        table.isActive ? '' : 'opacity-50'
      }`}
    >
      {/* Kod drukuje się na białym tle niezależnie od motywu panelu —
          czytniki telefonów wymagają kontrastu ciemny-na-jasnym. */}
      <div
        className="w-40 bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg ?? '' }}
      />

      <h2 className="mt-3 font-[family-name:var(--font-display)] text-lg font-bold">
        {table.label}
      </h2>
      <p className="mono text-xs text-[var(--muted)]">
        {table.zone ?? 'Sala'}
        {table.seats ? ` · ${table.seats} os.` : ''} · wydruk v{table.qrVersion}
      </p>

      <p className="mono mt-2 text-[10px] leading-tight text-[var(--muted)] print:text-[8px]">
        Zeskanuj i zamów
      </p>

      <div className="mt-3 flex gap-2 print:hidden">
        <button
          type="button"
          onClick={onRegenerate}
          className="mono min-h-11 px-2 text-xs text-[var(--muted)]"
        >
          nowy kod
        </button>
        <button
          type="button"
          onClick={onToggleActive}
          className="mono min-h-11 px-2 text-xs text-[var(--muted)]"
        >
          {table.isActive ? 'wyłącz' : 'włącz'}
        </button>
      </div>
    </article>
  );
}
