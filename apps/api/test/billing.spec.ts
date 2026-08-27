/**
 * Zakup abonamentu.
 *
 * Dwie rzeczy muszą się tu trzymać bezwzględnie. Pierwsza: abonament przedłuża
 * **wyłącznie** potwierdzona wpłata, a potwierdzeniem jest podpisane
 * powiadomienie operatora — nigdy powrót przeglądarki. Druga: to samo
 * powiadomienie przetworzone dwa razy nie może dać dwóch okresów, bo operator
 * ponawia je do skutku.
 */
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { addPeriod, priceFor } from '@kelbroo/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { BillingService } from '../src/billing/billing.service';
import { PayuProvider } from '../src/billing/payu.provider';
import { PaymentSignatureError, type PaymentNotification } from '../src/billing/payment-provider';
import { BillingReconciliationService } from '../src/billing/billing-reconciliation.service';
import type { MailService } from '../src/mail/mail.service';
import { alertyDoTestow } from './alerty';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();

const DRUGI_KLUCZ = 'drugi-klucz-testowy';

const wyslane: { to: string; subject: string; text: string }[] = [];
const mail = {
  send: async (w: { to: string; subject: string; text: string }) => {
    wyslane.push(w);
    return true;
  },
  skrzynkaKelbroo: 'kontakt@kelbroo.com',
  adresStrony: 'https://kelbroo.com',
} as unknown as MailService;

let provider: PayuProvider;
let billing: BillingService;
let organizationId: string;

/** Powiadomienie operatora, podpisane tak jak podpisuje je PayU. */
function powiadomienie(
  externalId: string,
  status: string,
  grossCents: number,
  opcje: { klucz?: string; algorytm?: 'MD5' | 'SHA-256' } = {},
) {
  const body = Buffer.from(
    JSON.stringify({
      order: {
        orderId: `PAYU-${externalId.slice(0, 8)}`,
        extOrderId: externalId,
        status,
        totalAmount: String(grossCents),
        currencyCode: 'PLN',
      },
    }),
    'utf8',
  );

  const algorytm = opcje.algorytm ?? 'MD5';
  const podpis = createHash(algorytm === 'SHA-256' ? 'sha256' : 'md5')
    .update(Buffer.concat([body, Buffer.from(opcje.klucz ?? DRUGI_KLUCZ, 'utf8')]))
    .digest('hex');

  return {
    body,
    naglowek: `sender=checkout;signature=${podpis};algorithm=${algorytm};content=DOCUMENT`,
  };
}

/** Zamówienie oczekujące na wpłatę — stan, w którym zastaje je powiadomienie. */
async function zamowienie(plan: 'starter' | 'pro', period: 'month' | 'year') {
  const cena = priceFor(plan, period);
  return direct.subscriptionOrder.create({
    data: {
      organizationId,
      plan,
      period,
      netCents: cena.netCents,
      vatCents: cena.vatCents,
      grossCents: cena.grossCents,
      status: 'pending',
      externalId: randomUUID(),
    },
  });
}

async function ustawAbonament(currentPeriodEnd: Date | null, status: 'trialing' | 'active') {
  await direct.subscription.update({
    where: { organizationId },
    data: { plan: 'pro', status, currentPeriodEnd, tableLimit: 40, languageLimit: 6 },
  });
}

beforeAll(async () => {
  process.env.PAYU_POS_ID = '300746';
  process.env.PAYU_CLIENT_SECRET = 'sekret-testowy';
  process.env.PAYU_SECOND_KEY = DRUGI_KLUCZ;

  provider = new PayuProvider();
  billing = new BillingService(prisma, provider, mail, alertyDoTestow().alerts);

  const organizacja = await direct.organization.create({
    data: {
      name: `Testowa ${randomUUID().slice(0, 8)}`,
      nip: '5252445394',
      billingEmail: 'ksiegowosc@test.local',
      billingAddress: 'Przykładowa 1',
      billingPostalCode: '00-001',
      billingCity: 'Warszawa',
      subscription: {
        create: { plan: 'pro', status: 'trialing', tableLimit: 40, languageLimit: 6 },
      },
    },
  });
  organizationId = organizacja.id;
});

beforeEach(() => {
  wyslane.length = 0;
});

afterAll(async () => {
  await direct.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  delete process.env.PAYU_POS_ID;
  delete process.env.PAYU_CLIENT_SECRET;
  delete process.env.PAYU_SECOND_KEY;
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

describe('podpis powiadomienia', () => {
  it('przyjmuje poprawnie podpisane powiadomienie', () => {
    const { body, naglowek } = powiadomienie('abc-123', 'COMPLETED', 19_557);

    expect(provider.readNotification(body, naglowek)).toMatchObject({
      externalId: 'abc-123',
      status: 'completed',
      grossCents: 19_557,
    });
  });

  it('odrzuca powiadomienie podpisane cudzym kluczem', () => {
    // To jest cała ochrona tego wejścia: adres jest publiczny, a treść mówi,
    // komu przedłużyć abonament.
    const { body, naglowek } = powiadomienie('abc-123', 'COMPLETED', 19_557, {
      klucz: 'nie-nasz-klucz',
    });

    expect(() => provider.readNotification(body, naglowek)).toThrow(PaymentSignatureError);
  });

  it('odrzuca powiadomienie bez podpisu', () => {
    const { body } = powiadomienie('abc-123', 'COMPLETED', 19_557);

    expect(() => provider.readNotification(body, undefined)).toThrow(PaymentSignatureError);
    expect(() => provider.readNotification(body, 'sender=checkout;algorithm=MD5')).toThrow(
      PaymentSignatureError,
    );
  });

  it('wykrywa podmianę treści po podpisaniu', () => {
    const { body, naglowek } = powiadomienie('abc-123', 'COMPLETED', 19_557);
    const podmieniona = Buffer.from(body.toString('utf8').replace('19557', '1'), 'utf8');

    expect(() => provider.readNotification(podmieniona, naglowek)).toThrow(PaymentSignatureError);
  });

  it('obsługuje konta podpisujące SHA-256', () => {
    const { body, naglowek } = powiadomienie('abc-123', 'COMPLETED', 19_557, {
      algorytm: 'SHA-256',
    });

    expect(provider.readNotification(body, naglowek).status).toBe('completed');
  });

  it('nie zgaduje nieznanego statusu', () => {
    const { body, naglowek } = powiadomienie('abc-123', 'REJECTED', 19_557);

    expect(() => provider.readNotification(body, naglowek)).toThrow(PaymentSignatureError);
  });

  it('stan przejściowy operatora to dla nas brak wpłaty', () => {
    // WAITING_FOR_CONFIRMATION znaczy „środki zablokowane, nie zaksięgowane".
    for (const status of ['PENDING', 'WAITING_FOR_CONFIRMATION', 'NEW']) {
      const { body, naglowek } = powiadomienie('abc-123', status, 19_557);
      expect(provider.readNotification(body, naglowek).status).toBe('pending');
    }
  });
});

describe('księgowanie wpłaty', () => {
  it('przedłuża abonament od dziś, gdy termin już minął', async () => {
    await ustawAbonament(new Date(Date.now() - 30 * 24 * 3_600_000), 'active');
    const order = await zamowienie('starter', 'month');
    const { body, naglowek } = powiadomienie(order.externalId, 'COMPLETED', order.grossCents);

    await billing.handleNotification(body, naglowek);

    const abonament = await direct.subscription.findUniqueOrThrow({ where: { organizationId } });
    expect(abonament.status).toBe('active');
    expect(abonament.plan).toBe('starter');
    // Klient miesiąc po terminie ma dostać pełny opłacony miesiąc, a nie
    // miesiąc liczony od dawno minionej daty — czyli zero dni działania.
    expect(abonament.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now());
    expect(abonament.tableLimit).toBe(12);
    expect(abonament.languageLimit).toBe(2);
  });

  it('dolicza okres do końca trwającego abonamentu', async () => {
    const koniec = new Date('2027-06-30T12:00:00Z');
    await ustawAbonament(koniec, 'active');
    const order = await zamowienie('pro', 'year');
    const { body, naglowek } = powiadomienie(order.externalId, 'COMPLETED', order.grossCents);

    await billing.handleNotification(body, naglowek);

    const abonament = await direct.subscription.findUniqueOrThrow({ where: { organizationId } });
    // Płacący z wyprzedzeniem nie może stracić reszty opłaconego okresu.
    expect(abonament.currentPeriodEnd!.toISOString()).toBe(addPeriod(koniec, 'year').toISOString());
  });

  it('to samo powiadomienie dwa razy daje jeden okres', async () => {
    await ustawAbonament(new Date('2027-01-31T12:00:00Z'), 'active');
    const order = await zamowienie('starter', 'month');
    const { body, naglowek } = powiadomienie(order.externalId, 'COMPLETED', order.grossCents);

    await billing.handleNotification(body, naglowek);
    const poPierwszym = await direct.subscription.findUniqueOrThrow({ where: { organizationId } });

    // Operator ponawia powiadomienie, dopóki nie dostanie 200 — powtórka jest
    // stanem normalnym, nie awarią, i nie może kosztować drugiego miesiąca.
    await billing.handleNotification(body, naglowek);
    const poDrugim = await direct.subscription.findUniqueOrThrow({ where: { organizationId } });

    expect(poDrugim.currentPeriodEnd!.toISOString()).toBe(
      poPierwszym.currentPeriodEnd!.toISOString(),
    );
  });

  it('odrzucona płatność nie rusza abonamentu', async () => {
    const koniec = new Date('2027-03-15T12:00:00Z');
    await ustawAbonament(koniec, 'active');
    const order = await zamowienie('pro', 'month');
    const { body, naglowek } = powiadomienie(order.externalId, 'CANCELED', order.grossCents);

    await billing.handleNotification(body, naglowek);

    const abonament = await direct.subscription.findUniqueOrThrow({ where: { organizationId } });
    expect(abonament.currentPeriodEnd!.toISOString()).toBe(koniec.toISOString());
    const zapisane = await direct.subscriptionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(zapisane.status).toBe('canceled');
    expect(zapisane.paidAt).toBeNull();
  });

  it('stan przejściowy nie przedłuża abonamentu', async () => {
    const koniec = new Date('2027-04-10T12:00:00Z');
    await ustawAbonament(koniec, 'active');
    const order = await zamowienie('starter', 'month');
    const { body, naglowek } = powiadomienie(order.externalId, 'PENDING', order.grossCents);

    await billing.handleNotification(body, naglowek);

    const abonament = await direct.subscription.findUniqueOrThrow({ where: { organizationId } });
    expect(abonament.currentPeriodEnd!.toISOString()).toBe(koniec.toISOString());
  });

  it('nie księguje kwoty innej niż wystawiona', async () => {
    const koniec = new Date('2027-05-20T12:00:00Z');
    await ustawAbonament(koniec, 'active');
    const order = await zamowienie('pro', 'month');
    // Podpis się zgadza, ale kwota nie — coś rozjechało się po naszej stronie
    // i nie wolno wtedy przedłużać abonamentu w ciemno.
    const { body, naglowek } = powiadomienie(order.externalId, 'COMPLETED', 1_00);

    await expect(billing.handleNotification(body, naglowek)).rejects.toThrow(/Kwota/);

    const abonament = await direct.subscription.findUniqueOrThrow({ where: { organizationId } });
    expect(abonament.currentPeriodEnd!.toISOString()).toBe(koniec.toISOString());
  });

  it('nie zna zamówienia, którego nie wystawiliśmy', async () => {
    const { body, naglowek } = powiadomienie(randomUUID(), 'COMPLETED', 19_557);

    await expect(billing.handleNotification(body, naglowek)).rejects.toThrow(/Nieznane/);
  });

  it('zapisuje, do kiedy opłacono, i zawiadamia obie strony', async () => {
    await ustawAbonament(new Date('2027-07-01T12:00:00Z'), 'active');
    const order = await zamowienie('starter', 'year');
    const { body, naglowek } = powiadomienie(order.externalId, 'COMPLETED', order.grossCents);

    await billing.handleNotification(body, naglowek);

    const zapisane = await direct.subscriptionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(zapisane.status).toBe('completed');
    expect(zapisane.paidAt).not.toBeNull();
    // Bez tej daty nie dałoby się po latach odtworzyć, za co klient zapłacił.
    expect(zapisane.paidUntil!.toISOString()).toBe(
      addPeriod(new Date('2027-07-01T12:00:00Z'), 'year').toISOString(),
    );

    // Klient dostaje potwierdzenie, my — dane do faktury, bo wystawiamy ją poza kelbroo.
    expect(wyslane.map((w) => w.to)).toEqual(
      expect.arrayContaining(['ksiegowosc@test.local', 'kontakt@kelbroo.com']),
    );
    const doNas = wyslane.find((w) => w.to === 'kontakt@kelbroo.com')!;
    expect(doNas.text).toContain('5252445394');
    expect(doNas.text).toContain('Przykładowa 1');
  });
});

describe('katalog planów', () => {
  it('podaje ceny wyłącznie dla planów do kupienia', () => {
    const katalog = billing.katalog();
    const starter = katalog.plans.find((plan) => plan.id === 'starter')!;
    const enterprise = katalog.plans.find((plan) => plan.id === 'enterprise')!;

    expect(starter.prices.month).toEqual(priceFor('starter', 'month'));
    expect(enterprise.prices.month).toBeNull();
  });

  it('mówi wprost, czy płatności są włączone', () => {
    expect(billing.katalog().enabled).toBe(true);

    delete process.env.PAYU_SECOND_KEY;
    try {
      // Panel ma o tym wiedzieć **przed** pokazaniem przycisku „Zapłać".
      expect(billing.katalog().enabled).toBe(false);
    } finally {
      process.env.PAYU_SECOND_KEY = DRUGI_KLUCZ;
    }
  });
});

/**
 * Uzgadnianie z operatorem.
 *
 * Broni przed najgorszym przypadkiem tego modułu: klient zapłacił, powiadomienie
 * nie dotarło, abonament się nie przedłużył i nikt o tym nie wie. Samo „wisi
 * w pending" nie odróżnia go od klienta, który rozmyślił się na bramce — dlatego
 * pytamy operatora, zamiast zgadywać z własnej bazy.
 */
describe('uzgadnianie', () => {
  /** Operator-atrapa: mówi to, co mu każe test, i liczy zapytania. */
  class Atrapa extends PayuProvider {
    stany = new Map<string, PaymentNotification>();
    zapytania: string[] = [];
    wlaczony = true;

    override get configured() {
      return this.wlaczony;
    }

    override async fetchOrder(providerOrderId: string) {
      this.zapytania.push(providerOrderId);
      return this.stany.get(providerOrderId) ?? null;
    }
  }

  let atrapa: Atrapa;
  let uzgadnianie: BillingReconciliationService;

  /** Zamówienie na tyle stare, że przegląd je zauważa. */
  async function wiszace(minutTemu: number, payuOrderId: string | null) {
    const cena = priceFor('starter', 'month');
    return direct.subscriptionOrder.create({
      data: {
        organizationId,
        plan: 'starter',
        period: 'month',
        netCents: cena.netCents,
        vatCents: cena.vatCents,
        grossCents: cena.grossCents,
        status: 'pending',
        externalId: randomUUID(),
        payuOrderId,
        createdAt: new Date(Date.now() - minutTemu * 60_000),
      },
    });
  }

  let wyslaneAlarmy: { subject: string }[] = [];

  beforeEach(async () => {
    atrapa = new Atrapa();
    const alarmy = alertyDoTestow();
    wyslaneAlarmy = alarmy.wyslane;
    uzgadnianie = new BillingReconciliationService(
      new BillingService(prisma, atrapa, mail, alarmy.alerts),
      atrapa,
      alarmy.alerts,
    );
    await direct.subscriptionOrder.deleteMany({ where: { organizationId } });
    await ustawAbonament(new Date('2027-09-01T12:00:00Z'), 'active');
  });

  it('księguje wpłatę, o której nie przyszło powiadomienie, i zawiadamia nas', async () => {
    const order = await wiszace(30, 'PAYU-1');
    atrapa.stany.set('PAYU-1', {
      externalId: order.externalId,
      providerOrderId: 'PAYU-1',
      status: 'completed',
      grossCents: order.grossCents,
      currency: 'PLN',
    });

    await uzgadnianie.przeglad();

    const zapisane = await direct.subscriptionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(zapisane.status).toBe('completed');
    expect(zapisane.paidUntil).not.toBeNull();

    // Klient dostaje potwierdzenie zwykłą pocztą, my — sygnał kanałem alarmowym,
    // że powiadomienia nie działają. Bez tego drugiego naprawilibyśmy skutek
    // i przegapili przyczynę. Rozdział kanałów jest tu istotą: wiadomość do
    // klienta i alarm dla nas mają różnych adresatów i różne wyciszanie.
    expect(wyslane.map((w) => w.subject)).toEqual(
      expect.arrayContaining([expect.stringContaining('opłacony')]),
    );
    expect(wyslaneAlarmy.map((w) => w.subject)).toEqual(
      expect.arrayContaining([expect.stringContaining('odzyskana')]),
    );
  });

  it('nie rusza zamówienia, które u operatora wciąż czeka', async () => {
    const order = await wiszace(30, 'PAYU-2');
    atrapa.stany.set('PAYU-2', {
      externalId: order.externalId,
      providerOrderId: 'PAYU-2',
      status: 'pending',
      grossCents: order.grossCents,
      currency: 'PLN',
    });

    await uzgadnianie.przeglad();

    const zapisane = await direct.subscriptionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(zapisane.status).toBe('pending');
    expect(wyslane).toHaveLength(0);
  });

  it('zamyka zamówienie odrzucone u operatora, nie zawiadamiając nikogo', async () => {
    const order = await wiszace(30, 'PAYU-3');
    atrapa.stany.set('PAYU-3', {
      externalId: order.externalId,
      providerOrderId: 'PAYU-3',
      status: 'canceled',
      grossCents: order.grossCents,
      currency: 'PLN',
    });

    await uzgadnianie.przeglad();

    const zapisane = await direct.subscriptionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(zapisane.status).toBe('canceled');
    // Rezygnacja na bramce to codzienność, nie zdarzenie do zgłaszania.
    expect(wyslane).toHaveLength(0);
  });

  it('nie pyta o zamówienie, które nigdy nie dotarło do operatora', async () => {
    const order = await wiszace(30, null);

    await uzgadnianie.przeglad();

    // Bez identyfikatora operatora nie ma o co pytać. Sprawdzamy to zamówienie,
    // a nie liczbę zapytań ogółem: przegląd z założenia idzie w poprzek
    // najemców, więc w bazie deweloperskiej trafia też na cudze.
    expect(atrapa.zapytania).not.toContain(order.externalId);
    const zapisane = await direct.subscriptionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(zapisane.status).toBe('canceled');
  });

  it('zostawia w spokoju zamówienie sprzed chwili', async () => {
    // Klient może właśnie wpisywać kod BLIK — pytanie o niego po minucie
    // to zamykanie płatności, która trwa.
    const order = await wiszace(2, 'PAYU-4');

    await uzgadnianie.przeglad();

    expect(atrapa.zapytania).not.toContain('PAYU-4');
    const zapisane = await direct.subscriptionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(zapisane.status).toBe('pending');
  });

  it('zamyka porzucone po dwóch dobach', async () => {
    const order = await wiszace(60 * 24 * 3, 'PAYU-5');

    await uzgadnianie.przeglad();

    const zapisane = await direct.subscriptionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(zapisane.status).toBe('canceled');
  });

  it('bez skonfigurowanego operatora nie robi nic', async () => {
    atrapa.wlaczony = false;
    const order = await wiszace(30, 'PAYU-6');

    await uzgadnianie.przeglad();

    expect(atrapa.zapytania).toHaveLength(0);
    const zapisane = await direct.subscriptionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(zapisane.status).toBe('pending');
  });

  it('powiadomienie i uzgadnianie naraz dają jeden okres', async () => {
    const order = await wiszace(30, 'PAYU-7');
    const stan: PaymentNotification = {
      externalId: order.externalId,
      providerOrderId: 'PAYU-7',
      status: 'completed',
      grossCents: order.grossCents,
      currency: 'PLN',
    };
    const usluga = new BillingService(prisma, atrapa, mail, alertyDoTestow().alerts);
    const przed = await direct.subscription.findUniqueOrThrow({ where: { organizationId } });

    // Wyścig jest realny: PayU ponawia powiadomienie akurat wtedy, gdy przegląd
    // pyta o to samo zamówienie. Obie drogi zobaczyłyby „pending".
    const wyniki = await Promise.all([
      usluga.zastosujStan(organizationId, stan),
      usluga.zastosujStan(organizationId, stan),
    ]);

    expect(wyniki.filter(Boolean)).toHaveLength(1);
    const po = await direct.subscription.findUniqueOrThrow({ where: { organizationId } });
    expect(po.currentPeriodEnd!.toISOString()).toBe(
      addPeriod(przed.currentPeriodEnd!, 'month').toISOString(),
    );
  });
});
