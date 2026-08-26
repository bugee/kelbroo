/**
 * Cennik i arytmetyka okresu rozliczeniowego.
 *
 * Błąd o grosz przechodzi tu przez fakturę do księgowości, a błąd o dzień daje
 * klientowi okres, za który nie zapłacił, albo zabiera opłacony. Jedno i drugie
 * wychodzi na jaw miesiąc później, u kogoś innego.
 */
import { describe, expect, it } from 'vitest';
import {
  PLANS,
  SELF_SERVICE_PLANS,
  VAT_RATE_PERCENT,
  addPeriod,
  isPurchasable,
  priceFor,
  PlanPriceError,
  type BillingPeriod,
  type PlanId,
} from '../src/plans.js';

const OKRESY: BillingPeriod[] = ['month', 'year'];

describe('ceny', () => {
  it('brutto jest sumą netto i VAT — dla każdego planu i okresu', () => {
    for (const plan of SELF_SERVICE_PLANS) {
      for (const okres of OKRESY) {
        const cena = priceFor(plan, okres);
        expect(cena.netCents + cena.vatCents).toBe(cena.grossCents);
      }
    }
  });

  it('liczy VAT bez błędu zmiennoprzecinkowego', () => {
    // 159 zł netto → 36,57 zł VAT → 195,57 zł brutto. Zapis `15900 * 0.23`
    // daje w JavaScripcie 3656,9999999999995, więc zaokrąglenie w złą stronę
    // kosztowałoby grosz na każdej fakturze.
    expect(priceFor('starter', 'month')).toEqual({
      netCents: 15_900,
      vatCents: 3_657,
      grossCents: 19_557,
    });
    expect(priceFor('pro', 'month')).toEqual({
      netCents: 34_900,
      vatCents: 8_027,
      grossCents: 42_927,
    });
  });

  it('rok jest tańszy niż dwanaście miesięcy', () => {
    for (const plan of SELF_SERVICE_PLANS) {
      const rok = priceFor(plan, 'year').netCents;
      const dwanascie = priceFor(plan, 'month').netCents * 12;

      expect(rok).toBeLessThan(dwanascie);
      // Cennik obiecuje −17%, czyli dwa miesiące gratis.
      expect(rok).toBe(priceFor(plan, 'month').netCents * 10);
    }
  });

  it('stawka VAT jest liczbą całkowitą', () => {
    // Ułamkowa stawka wprowadziłaby zmiennoprzecinkowe do arytmetyki kwot.
    expect(Number.isInteger(VAT_RATE_PERCENT)).toBe(true);
  });

  it('odmawia wyceny planu spoza cennika samoobsługowego', () => {
    expect(() => priceFor('enterprise', 'month')).toThrow(PlanPriceError);
  });

  it('bezpłatny plan i Enterprise nie są do kupienia w panelu', () => {
    // Menu nic nie kosztuje, Enterprise wycenia się rozmową — checkout nie ma
    // w obu przypadkach czego policzyć.
    expect(isPurchasable('menu', 'month')).toBe(false);
    expect(isPurchasable('enterprise', 'year')).toBe(false);
    expect(isPurchasable('starter', 'month')).toBe(true);
    expect(isPurchasable('pro', 'year')).toBe(true);
  });

  it('każdy plan ma limity', () => {
    for (const plan of Object.keys(PLANS) as PlanId[]) {
      expect(PLANS[plan].limits.tableLimit).toBeGreaterThan(0);
      expect(PLANS[plan].limits.languageLimit).toBeGreaterThan(0);
    }
  });
});

describe('okres rozliczeniowy', () => {
  it('miesiąc to miesiąc kalendarzowy, nie trzydzieści dni', () => {
    expect(addPeriod(new Date('2026-01-15T10:00:00Z'), 'month').toISOString()).toBe(
      '2026-02-15T10:00:00.000Z',
    );
  });

  it('rok to dwanaście miesięcy', () => {
    expect(addPeriod(new Date('2026-03-10T08:30:00Z'), 'year').toISOString()).toBe(
      '2027-03-10T08:30:00.000Z',
    );
  });

  it('przycina dzień do długości krótszego miesiąca', () => {
    // Zakup 31 stycznia kończy się ostatniego dnia lutego. Bez przycięcia
    // JavaScript przewinąłby „31 lutego" na 3 marca i dałby trzy dni gratis.
    expect(addPeriod(new Date('2026-01-31T12:00:00Z'), 'month').toISOString()).toBe(
      '2026-02-28T12:00:00.000Z',
    );
  });

  it('zna rok przestępny', () => {
    expect(addPeriod(new Date('2028-01-31T12:00:00Z'), 'month').toISOString()).toBe(
      '2028-02-29T12:00:00.000Z',
    );
    expect(addPeriod(new Date('2028-02-29T12:00:00Z'), 'year').toISOString()).toBe(
      '2029-02-28T12:00:00.000Z',
    );
  });

  it('przechodzi przez koniec roku', () => {
    expect(addPeriod(new Date('2026-12-15T00:00:00Z'), 'month').toISOString()).toBe(
      '2027-01-15T00:00:00.000Z',
    );
  });

  it('nigdy nie skraca okresu', () => {
    // Niezmiennik ogólny: cokolwiek robi arytmetyka dat, klient dostaje czas
    // do przodu. Odwrotny wynik znaczyłby, że wpłata zabrała mu abonament.
    const daty = ['2026-01-31', '2026-02-28', '2026-08-26', '2028-02-29', '2026-12-31'];
    for (const dzien of daty) {
      for (const okres of OKRESY) {
        const start = new Date(`${dzien}T09:00:00Z`);
        expect(addPeriod(start, okres).getTime()).toBeGreaterThan(start.getTime());
      }
    }
  });
});
