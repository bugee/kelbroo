import type { AdminTable } from '@/lib/api';

export type FormatWydruku = 'a5' | 'a6';

export const FORMATY: { id: FormatWydruku; etykieta: string; opis: string }[] = [
  { id: 'a5', etykieta: 'A5', opis: '2 na stronie A4' },
  { id: 'a6', etykieta: 'A6', opis: '4 na stronie A4' },
];

/**
 * Arkusz kodów do wycięcia.
 *
 * Osobne znaczniki niż karty na ekranie, a nie te same z nadpisaniami `print:`.
 * To dwie różne rzeczy: na ekranie zarządza się stolikami, na papierze powstaje
 * naklejka, którą gość czyta z odległości metra. Wspólny komponent oznaczałby
 * kilkanaście reguł walczących ze sobą przy każdej zmianie układu.
 *
 * Kafel wypełnia dokładnie połowę (A5) albo ćwiartkę (A4) strony, a przerywana
 * ramka jest linią cięcia. Wymiary siedzą w `globals.css` — w milimetrach, bo
 * to jedyna jednostka, w której da się rozmawiać o papierze.
 */
export function QrPrintSheet({
  tables,
  codes,
  format,
}: {
  tables: AdminTable[];
  codes: Record<string, string>;
  format: FormatWydruku;
}) {
  return (
    <div className={`arkusz arkusz-${format} hidden print:grid`}>
      {tables.map((table) => (
        <section key={table.id} className="kafel">
          <div className="kafel-tresc">
            <div
              className="kafel-kod"
              dangerouslySetInnerHTML={{ __html: codes[table.id] ?? '' }}
            />
            <h2 className="kafel-numer">{table.label}</h2>
            {table.zone && <p className="kafel-strefa">{table.zone}</p>}
            <p className="kafel-zacheta">Zeskanuj i zamów</p>
          </div>

          {/* Stopka kafla, nie strony: kafle idą pod nożyczki i każdy musi
              nieść własną wersję wydruku. Po niej obsługa pozna, czy naklejka
              na stoliku jest jeszcze aktualna. */}
          <p className="kafel-stopka">wydruk v{table.qrVersion}</p>
        </section>
      ))}
    </div>
  );
}
