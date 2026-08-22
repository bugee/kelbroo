import { describe, expect, it } from 'vitest';
import {
  allocateByShares,
  allocateEqually,
  assertAllocationSumsTo,
  MoneySplitError,
} from '../src/money.js';

const sum = (allocations: { amountCents: number }[]) =>
  allocations.reduce((acc, a) => acc + a.amountCents, 0);

describe('allocateByShares', () => {
  it('dzieli równo, gdy kwota dzieli się bez reszty', () => {
    const result = allocateByShares(9000, [
      { key: 'a', units: 1 },
      { key: 'b', units: 1 },
      { key: 'c', units: 1 },
    ]);
    expect(result.map((r) => r.amountCents)).toEqual([3000, 3000, 3000]);
  });

  it('rozdziela nierozdzielone grosze metodą największych reszt', () => {
    // 10 gr na 3 osoby: 4/3/3, nigdy 3/3/3.
    const result = allocateByShares(10, [
      { key: 'a', units: 1 },
      { key: 'b', units: 1 },
      { key: 'c', units: 1 },
    ]);
    expect(sum(result)).toBe(10);
    expect(result.map((r) => r.amountCents).sort()).toEqual([3, 3, 4]);
  });

  it('kieruje nierozdzielony grosz do hosta przy remisie reszt', () => {
    const result = allocateEqually(100, [
      { key: 'zzz' },
      { key: 'aaa' },
      { key: 'mmm', isHost: true },
    ]);
    const host = result.find((r) => r.key === 'mmm');
    expect(host?.amountCents).toBe(34);
    expect(sum(result)).toBe(100);
  });

  it('dzieli proporcjonalnie do udziałów', () => {
    // Butelka wina 12,50 zł: jedna osoba wypiła dwa razy tyle.
    const result = allocateByShares(1250, [
      { key: 'a', units: 2 },
      { key: 'b', units: 1 },
    ]);
    expect(result).toEqual([
      { key: 'a', amountCents: 833 },
      { key: 'b', amountCents: 417 },
    ]);
    expect(sum(result)).toBe(1250);
  });

  it('jest deterministyczny niezależnie od kolejności wejścia', () => {
    const shares = [
      { key: 'b', units: 1 },
      { key: 'a', units: 1 },
      { key: 'c', units: 1 },
    ];
    const forward = allocateByShares(101, shares);
    const reversed = allocateByShares(101, [...shares].reverse());
    const normalize = (r: { key: string; amountCents: number }[]) =>
      [...r].sort((x, y) => x.key.localeCompare(y.key));
    expect(normalize(forward)).toEqual(normalize(reversed));
  });

  it('NIEZMIENNIK: suma udziałów zawsze równa kwocie dzielonej', () => {
    // docs/architecture.md §14.5 — podział, który się nie sumuje, to błąd krytyczny.
    for (let total = 0; total <= 500; total++) {
      for (let people = 1; people <= 7; people++) {
        const shares = Array.from({ length: people }, (_, i) => ({
          key: `p${i}`,
          units: (i % 3) + 1,
        }));
        const result = allocateByShares(total, shares);
        expect(sum(result)).toBe(total);
        expect(() => assertAllocationSumsTo(result, total)).not.toThrow();
      }
    }
  });

  it('odrzuca kwoty ujemne, ułamkowe i puste podziały', () => {
    expect(() => allocateByShares(-1, [{ key: 'a', units: 1 }])).toThrow(MoneySplitError);
    expect(() => allocateByShares(10.5, [{ key: 'a', units: 1 }])).toThrow(MoneySplitError);
    expect(() => allocateByShares(10, [])).toThrow(MoneySplitError);
    expect(() => allocateByShares(10, [{ key: 'a', units: 0 }])).toThrow(MoneySplitError);
    expect(() =>
      allocateByShares(10, [
        { key: 'a', units: 1 },
        { key: 'a', units: 1 },
      ]),
    ).toThrow(MoneySplitError);
  });
});
