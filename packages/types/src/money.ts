/**
 * Arytmetyka kwot i podziału rachunku.
 *
 * Reguły wiążące (docs/architecture.md §14.5):
 *  - wyłącznie liczby całkowite w groszach, nigdy zmiennoprzecinkowe,
 *  - podział metodą największych reszt (largest remainder),
 *  - kolejność deterministyczna: najpierw host, potem rosnąco po kluczu,
 *  - niezmiennik: suma udziałów == kwota dzielona, co do grosza.
 *
 * Ten plik jest jedynym miejscem, w którym wolno dzielić kwoty.
 */

/** Jeden udział w dzielonej kwocie. `key` to zwykle `participant_id`. */
export interface Share<K extends string = string> {
  key: K;
  /** Udział w częściach, np. 1 z 3 przy dzielonej butelce. Musi być > 0. */
  units: number;
  /** Uczestnik oznaczony `is_host` — do niego trafiają nierozdzielone grosze. */
  isHost?: boolean;
}

export interface Allocation<K extends string = string> {
  key: K;
  amountCents: number;
}

export class MoneySplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneySplitError';
  }
}

/**
 * Dzieli `totalCents` proporcjonalnie do `units` metodą największych reszt.
 *
 * Gwarancja: `sum(result.amountCents) === totalCents` dla każdego wejścia.
 * Kolejność przyznawania groszy z reszty: malejąco po części ułamkowej, przy
 * remisie najpierw host, potem rosnąco po `key` — dzięki temu ten sam rachunek
 * dzieli się zawsze tak samo, niezależnie od kolejności wejścia.
 */
export function allocateByShares<K extends string>(
  totalCents: number,
  shares: readonly Share<K>[],
): Allocation<K>[] {
  assertInteger(totalCents, 'totalCents');
  if (totalCents < 0) {
    throw new MoneySplitError('Kwota do podziału nie może być ujemna — użyj storna, nie podziału.');
  }
  if (shares.length === 0) {
    throw new MoneySplitError('Brak uczestników podziału.');
  }

  const seen = new Set<K>();
  for (const share of shares) {
    if (seen.has(share.key)) {
      throw new MoneySplitError(`Zduplikowany uczestnik podziału: ${share.key}`);
    }
    seen.add(share.key);
    assertInteger(share.units, `units[${share.key}]`);
    if (share.units <= 0) {
      throw new MoneySplitError(`Udział musi być dodatni (${share.key} = ${share.units}).`);
    }
  }

  const totalUnits = shares.reduce((sum, share) => sum + share.units, 0);

  const ordered = [...shares].sort(compareShares);
  const floors = ordered.map((share) => {
    const exact = totalCents * share.units;
    return {
      share,
      amountCents: Math.floor(exact / totalUnits),
      remainder: exact % totalUnits,
    };
  });

  let leftover = totalCents - floors.reduce((sum, entry) => sum + entry.amountCents, 0);

  // Grosze z reszty: największa reszta pierwsza, remis rozstrzyga kolejność `ordered`.
  const byRemainder = [...floors].sort((a, b) => {
    if (a.remainder !== b.remainder) return b.remainder - a.remainder;
    return compareShares(a.share, b.share);
  });

  for (const entry of byRemainder) {
    if (leftover === 0) break;
    entry.amountCents += 1;
    leftover -= 1;
  }

  return floors.map(({ share, amountCents }) => ({ key: share.key, amountCents }));
}

/**
 * Dzieli kwotę równo między uczestników (`split_mode = 'equal'`).
 * Nierozdzielone grosze trafiają do hosta, a w jego braku do pierwszego klucza.
 */
export function allocateEqually<K extends string>(
  totalCents: number,
  participants: readonly { key: K; isHost?: boolean }[],
): Allocation<K>[] {
  return allocateByShares(
    totalCents,
    participants.map((participant) => ({ ...participant, units: 1 })),
  );
}

/**
 * Weryfikacja niezmiennika. Wywoływana w testach i przed zapisem podziału —
 * podział, który nie sumuje się do kwoty rachunku, nie ma prawa trafić do bazy.
 */
export function assertAllocationSumsTo(
  allocations: readonly Allocation[],
  expectedCents: number,
): void {
  const sum = allocations.reduce((acc, allocation) => acc + allocation.amountCents, 0);
  if (sum !== expectedCents) {
    throw new MoneySplitError(
      `Podział nie sumuje się do kwoty rachunku: ${sum} != ${expectedCents} (groszy).`,
    );
  }
}

function compareShares(a: Share<string>, b: Share<string>): number {
  if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new MoneySplitError(`${label} musi być liczbą całkowitą groszy, otrzymano ${value}.`);
  }
}
