/**
 * Katalog planów: limity i ceny.
 *
 * Jedno źródło prawdy dla API, panelu i strony produktowej. Do tej pory limity
 * były przepisane w trzech miejscach (rejestracja, zaplecze, panel), a ceny
 * istniały wyłącznie jako napisy w komponencie cennika — czyli nigdzie, gdzie
 * dałoby się na nich liczyć.
 *
 * Ceny **netto w groszach**, zgodnie z regułą całego projektu: kwoty to liczby
 * całkowite, nigdy zmiennoprzecinkowe (CLAUDE.md). Odbiorcą jest firma, więc
 * cennik podaje netto, a do zapłaty idzie brutto — przeliczenie jest niżej
 * i jest jedynym dozwolonym miejscem, w którym dolicza się VAT.
 */

export type PlanId = 'menu' | 'starter' | 'pro' | 'enterprise';

/** Okres rozliczeniowy. Rok jest tańszy w przeliczeniu na miesiąc (−17%). */
export type BillingPeriod = 'month' | 'year';

export interface PlanLimits {
  tableLimit: number;
  languageLimit: number;
  staffLimit: number;
}

/**
 * Wartość oznaczająca „bez limitu".
 *
 * Liczba, nie `null`: limit jest kolumną w bazie i porównaniem w kodzie, a jeden
 * typ zamiast dwóch oszczędza rozgałęzienia w każdym miejscu, które go sprawdza.
 * Dziewięć tysięcy kont personelu w jednej restauracji nie zdarzy się nigdy,
 * a interfejs pokazuje w tym miejscu „bez limitu", nie liczbę.
 */
export const BEZ_LIMITU = 9_999;

/**
 * Funkcje włączane planem.
 *
 * Osobno od limitów, bo to inne pytanie: limit mówi „ile", funkcja mówi „czy
 * w ogóle". Wartość z planu jest **wartością startową** — zaplecze może ją
 * podnieść pojedynczemu klientowi, nie ruszając jego planu.
 */
export interface PlanFeatures {
  /** Zdjęcia dań w karcie: jedno na pozycję, widoczne u gościa. */
  menuPhotos: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  limits: PlanLimits;
  features: PlanFeatures;
  /**
   * Cena netto w groszach za okres. `null` znaczy „nie do kupienia samodzielnie":
   * plan Menu jest bezpłatny, a Enterprise wyceniany indywidualnie — w obu
   * przypadkach checkout nie ma czego policzyć.
   */
  netCents: Record<BillingPeriod, number | null>;
}

/**
 * Stawka VAT w punktach procentowych.
 *
 * Liczba całkowita, żeby przeliczenie dało się zrobić na liczbach całkowitych.
 * Gdyby kiedyś doszedł rynek z inną stawką, przeniesie się to do konfiguracji
 * organizacji — dziś sprzedajemy wyłącznie w Polsce.
 */
export const VAT_RATE_PERCENT = 23;

export const PLANS: Record<PlanId, Plan> = {
  menu: {
    id: 'menu',
    name: 'Menu',
    limits: { tableLimit: BEZ_LIMITU, languageLimit: 1, staffLimit: 1 },
    features: { menuPhotos: false },
    netCents: { month: 0, year: 0 },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    limits: { tableLimit: 12, languageLimit: 2, staffLimit: 3 },
    features: { menuPhotos: false },
    // 159 zł/mies albo 1 590 zł/rok (132 zł/mies w przeliczeniu).
    netCents: { month: 15_900, year: 159_000 },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    limits: { tableLimit: 40, languageLimit: 6, staffLimit: BEZ_LIMITU },
    features: { menuPhotos: true },
    // 349 zł/mies albo 3 490 zł/rok (291 zł/mies w przeliczeniu).
    netCents: { month: 34_900, year: 349_000 },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    limits: { tableLimit: BEZ_LIMITU, languageLimit: 99, staffLimit: BEZ_LIMITU },
    features: { menuPhotos: true },
    netCents: { month: null, year: null },
  },
};

/** Plany, które klient może kupić sam. Reszta wymaga rozmowy albo nic nie kosztuje. */
export const SELF_SERVICE_PLANS: readonly PlanId[] = ['starter', 'pro'];

export interface PriceBreakdown {
  netCents: number;
  vatCents: number;
  grossCents: number;
}

export class PlanPriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanPriceError';
  }
}

/**
 * Cena do zapłaty wraz z podatkiem.
 *
 * VAT liczony na liczbach całkowitych i **zaokrąglany w połowie w górę** — tak
 * jak na fakturze. Kolejność działań ma znaczenie: mnożymy przed dzieleniem,
 * bo `netto * 0.23` w zmiennoprzecinkowym potrafi dać 19556.999999999996.
 *
 * Niezmiennik: `netCents + vatCents === grossCents`, co do grosza.
 */
export function priceFor(plan: PlanId, period: BillingPeriod): PriceBreakdown {
  const netCents = PLANS[plan].netCents[period];
  if (netCents === null) {
    throw new PlanPriceError(`Plan ${plan} nie ma ceny w cenniku samoobsługowym.`);
  }

  const vatCents = Math.round((netCents * VAT_RATE_PERCENT) / 100);
  return { netCents, vatCents, grossCents: netCents + vatCents };
}

/** Czy ten plan i okres da się kupić w panelu. */
export function isPurchasable(plan: PlanId, period: BillingPeriod): boolean {
  return SELF_SERVICE_PLANS.includes(plan) && PLANS[plan].netCents[period] !== null;
}

/**
 * Dodaje okres rozliczeniowy do daty.
 *
 * Miesiące, nie 30 dni: klient, który kupił 31 stycznia, ma opłacone do końca
 * lutego, a nie do 2 marca. Dzień jest przycinany do długości miesiąca
 * docelowego — inaczej JavaScript przewinąłby 31 lutego na 3 marca i klient
 * dostałby dni, za które nie zapłacił.
 */
export function addPeriod(from: Date, period: BillingPeriod): Date {
  const miesiecy = period === 'year' ? 12 : 1;
  const rok = from.getUTCFullYear();
  const miesiac = from.getUTCMonth() + miesiecy;
  const dzien = from.getUTCDate();

  // Zerowy dzień kolejnego miesiąca to ostatni dzień miesiąca docelowego.
  const ostatniDzien = new Date(Date.UTC(rok, miesiac + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      rok,
      miesiac,
      Math.min(dzien, ostatniDzien),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}
