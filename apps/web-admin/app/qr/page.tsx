'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { StaffShell } from '@/components/StaffShell';
import { TableFields, type DaneStolika } from '@/components/TableFields';
import { FORMATY, QrPrintSheet, type FormatWydruku } from '@/components/QrPrintSheet';
import {
  createTable,
  fetchTables,
  guestUrlFor,
  regenerateQr,
  setTableActive,
  updateTable,
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
  // `null` — nic nie edytujemy, `'nowy'` — zakładamy stolik, id — poprawiamy ten.
  const [edytowany, setEdytowany] = useState<string | null>(null);
  const [format, setFormat] = useState<FormatWydruku>('a6');
  // Okno drukowania otwieramy dopiero, gdy klasa formatu jest w DOM — inaczej
  // pierwszy wydruk po zmianie formatu wyszedłby w poprzednim układzie.
  const [doDruku, setDoDruku] = useState(false);

  useEffect(() => {
    if (!doDruku) return;
    setDoDruku(false);
    window.print();
  }, [doDruku]);

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

  /**
   * Zapis z formularza. Błąd **wraca do formularza**, a nie na górę ekranu:
   * najczęstszy to zajęty numer, a poprawia się go w polu, które właśnie widać.
   */
  const zapisz = async (akcja: () => Promise<unknown>) => {
    await akcja();
    setEdytowany(null);
    setError(null);
    await refresh();
  };

  if (error && !data) return <p className="text-[var(--orange)]">{error}</p>;
  if (!data) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  return (
    <>
      {error && <p className="mb-3 text-[var(--orange)] print:hidden">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => setEdytowany('nowy')}
          className="min-h-11 rounded-[var(--radius-control)] bg-[var(--teal)] px-4 text-sm font-semibold text-white"
        >
          Nowy stolik
        </button>

        {/* Format jest częścią decyzji „drukuję", nie osobnym ustawieniem —
            stąd dwa przyciski zamiast listy i przycisku obok niej. */}
        {FORMATY.map((wariant) => (
          <button
            key={wariant.id}
            type="button"
            onClick={() => {
              setFormat(wariant.id);
              setDoDruku(true);
            }}
            className="min-h-11 rounded-[var(--radius-control)] border border-[var(--line)] px-4 text-sm font-semibold"
          >
            Drukuj {wariant.etykieta}
            <span className="mono ml-1.5 text-xs font-normal text-[var(--muted)]">
              {wariant.opis}
            </span>
          </button>
        ))}

        <span className="mono ml-auto text-xs text-[var(--muted)]">
          aktywnych {data.activeCount} z {data.tableLimit} w planie
        </span>
      </div>

      {edytowany === 'nowy' && (
        <div className="mb-4 max-w-sm rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 print:hidden">
          <h2 className="text-sm font-semibold">Nowy stolik</h2>
          <TableFields
            zapisz={(dane: DaneStolika) => zapisz(() => createTable(dane))}
            anuluj={() => setEdytowany(null)}
            etykietaZapisu="Dodaj stolik"
          />
        </div>
      )}

      <QrPrintSheet tables={data.tables} codes={codes} format={format} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
        {data.tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            svg={codes[table.id]}
            edytowany={edytowany === table.id}
            onEdit={() => setEdytowany(table.id)}
            onCancelEdit={() => setEdytowany(null)}
            onSave={(dane: DaneStolika) => zapisz(() => updateTable(table.id, dane))}
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
  edytowany,
  onEdit,
  onCancelEdit,
  onSave,
  onRegenerate,
  onToggleActive,
}: {
  table: AdminTable;
  svg: string | undefined;
  edytowany: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (dane: DaneStolika) => Promise<void>;
  onRegenerate: () => void;
  onToggleActive: () => void;
}) {
  return (
    <article
      className={`flex flex-col items-center rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-4 text-center ${
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

      {/* Zapowiedź tego, co wyjdzie na naklejce. Sam wydruk składa
          `QrPrintSheet` — ta karta służy do zarządzania i na papier nie idzie. */}
      <p className="mono mt-2 text-[10px] leading-tight text-[var(--muted)]">Zeskanuj i zamów</p>

      {edytowany && (
        <>
          <TableFields
            poczatkowe={table}
            zapisz={onSave}
            anuluj={onCancelEdit}
            etykietaZapisu="Zapisz"
          />
          {/* Numer stoi na naklejce, a naklejki nikt nie przedrukuje sam z siebie.
              Kod zostaje ten sam, więc wystarczy wydrukować arkusz na nowo. */}
          <p className="mono mt-2 text-[10px] leading-tight text-[var(--muted)]">
            Zmiana numeru nie unieważnia kodu — wydrukuj arkusz jeszcze raz, żeby naklejka zgadzała
            się z panelem.
          </p>
        </>
      )}

      <div className="mt-3 flex gap-2 print:hidden">
        {!edytowany && (
          <button
            type="button"
            onClick={onEdit}
            className="mono min-h-11 px-2 text-xs text-[var(--teal)]"
          >
            edytuj
          </button>
        )}
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

      {/*
        Ten sam adres, który niesie kod QR — sposób na sprawdzenie karty bez
        sięgania po telefon. Poza wydrukiem: naklejka ma prowadzić gościa
        skanowaniem, a wypisany link tylko zachęcałby do przepisywania go ręcznie.
      */}
      <a
        href={guestUrlFor(table.qrToken)}
        target="_blank"
        rel="noreferrer"
        className="mono mt-2 min-h-11 px-2 text-xs text-[var(--teal)] underline print:hidden"
      >
        otwórz menu gościa
      </a>
    </article>
  );
}
