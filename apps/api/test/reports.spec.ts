/**
 * Raport sprzedaży.
 *
 * Raport, który nie zgadza się z rachunkami, jest gorszy niż jego brak — na jego
 * podstawie ktoś układa grafik i zamawia towar. Testy pilnują trzech rzeczy:
 * że liczymy **po dobie biznesowej**, że bierzemy **te same zamówienia** co
 * rachunek wizyty, i że „nikt tego nie zamawia" nie mówimy o daniu, które
 * sprzedaje się codziennie.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReportsService } from '../src/staff/reports.service';
import type { StaffContext } from '../src/auth/auth.types';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();
const reports = new ReportsService(prisma);

let organizationId: string;
let restaurantId: string;
let tableId: string;
let categoryId: string;
let manager: StaffContext;

/** Dzisiejsza doba biznesowa lokalu (start o 4:00, strefa Europe/Warsaw). */
function dobaDzis(przesuniecieDni = 0): Date {
  const teraz = new Date();
  const data = new Date(
    Date.UTC(teraz.getUTCFullYear(), teraz.getUTCMonth(), teraz.getUTCDate() + przesuniecieDni),
  );
  return data;
}

async function danie(nazwa: string) {
  const item = await direct.menuItem.create({
    data: {
      organizationId,
      restaurantId,
      categoryId,
      priceCents: 3000,
      currency: 'PLN',
      vatRate: new Prisma.Decimal('0.0800'),
      translations: { create: [{ organizationId, locale: 'pl', name: nazwa }] },
    },
  });
  return item;
}

/** Zamówienie w zadanej dobie biznesowej, z pozycjami. */
async function zamowienie(opcje: {
  businessDate: Date;
  status?: 'served' | 'canceled' | 'rejected';
  createdAt?: Date;
  pozycje: { menuItemId?: string; nazwa: string; sztuk: number; cenaCents: number }[];
}) {
  const session = await direct.tableSession.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      businessDate: opcje.businessDate,
      sessionNumber: Math.floor(Math.random() * 100_000),
      openedBy: 'guest',
      currency: 'PLN',
    },
  });

  const suma = opcje.pozycje.reduce((acc, p) => acc + p.sztuk * p.cenaCents, 0);
  return direct.order.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      tableSessionId: session.id,
      orderNumber: Math.floor(Math.random() * 100_000),
      source: 'guest',
      status: opcje.status ?? 'served',
      paymentStatus: 'awaiting_settlement',
      currency: 'PLN',
      businessDate: opcje.businessDate,
      ...(opcje.createdAt ? { createdAt: opcje.createdAt } : {}),
      subtotalCents: suma,
      totalCents: suma,
      items: {
        create: opcje.pozycje.map((p) => ({
          organizationId,
          ...(p.menuItemId ? { menuItemId: p.menuItemId } : {}),
          nameSnapshot: p.nazwa,
          quantity: p.sztuk,
          unitPriceCents: p.cenaCents,
          vatRate: new Prisma.Decimal('0.0800'),
          addedBy: 'guest',
        })),
      },
    },
  });
}

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Raport ${randomUUID().slice(0, 8)}`, billingEmail: 'raport@test.local' },
  });
  organizationId = organization.id;

  const restaurant = await direct.restaurant.create({
    data: {
      organizationId,
      name: 'Liczbowa',
      slug: `raport-${randomUUID()}`,
      currency: 'PLN',
      timezone: 'Europe/Warsaw',
      businessDayStartHour: 4,
      defaultLocale: 'pl',
      supportedLocales: ['pl'],
    },
  });
  restaurantId = restaurant.id;

  const table = await direct.table.create({
    data: { organizationId, restaurantId, label: 'Stolik 1', qrToken: randomUUID() },
  });
  tableId = table.id;

  const category = await direct.menuCategory.create({
    data: {
      organizationId,
      restaurantId,
      translations: { create: [{ organizationId, locale: 'pl', name: 'Dania' }] },
    },
  });
  categoryId = category.id;

  const member = await direct.staffMember.create({
    data: {
      organizationId,
      restaurantId,
      email: `raport-${randomUUID()}@test.local`,
      name: 'Manager',
      role: 'manager',
      passwordHash: 'x',
    },
  });
  manager = { staffId: member.id, organizationId, restaurantId, role: 'manager', name: 'Manager' };
});

beforeEach(async () => {
  await direct.tableSession.deleteMany({ where: { organizationId } });
  await direct.menuItem.deleteMany({ where: { organizationId } });
});

afterAll(async () => {
  await direct.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

describe('kwoty', () => {
  it('sumuje sprzedaż i liczy średni rachunek', async () => {
    await zamowienie({
      businessDate: dobaDzis(),
      pozycje: [{ nazwa: 'Żurek', sztuk: 2, cenaCents: 2000 }],
    });
    await zamowienie({
      businessDate: dobaDzis(),
      pozycje: [{ nazwa: 'Schabowy', sztuk: 1, cenaCents: 6000 }],
    });

    const raport = await reports.sprzedaz(manager, 7);

    expect(raport.razem.zamowien).toBe(2);
    expect(raport.razem.sprzedazCents).toBe(10_000);
    expect(raport.razem.sredniRachunekCents).toBe(5_000);
  });

  it('pomija zamówienia odrzucone i anulowane', async () => {
    await zamowienie({
      businessDate: dobaDzis(),
      pozycje: [{ nazwa: 'Żurek', sztuk: 1, cenaCents: 2000 }],
    });
    await zamowienie({
      businessDate: dobaDzis(),
      status: 'canceled',
      pozycje: [{ nazwa: 'Żurek', sztuk: 5, cenaCents: 2000 }],
    });
    await zamowienie({
      businessDate: dobaDzis(),
      status: 'rejected',
      pozycje: [{ nazwa: 'Żurek', sztuk: 5, cenaCents: 2000 }],
    });

    const raport = await reports.sprzedaz(manager, 7);

    // Ta sama reguła, którą liczy się rachunek wizyty. Rozjazd dałby raport,
    // który nie zgadza się z tym, co goście zapłacili.
    expect(raport.razem.zamowien).toBe(1);
    expect(raport.razem.sprzedazCents).toBe(2_000);
    expect(raport.dania).toHaveLength(1);
    expect(raport.dania[0]).toMatchObject({ nazwa: 'Żurek', sztuk: 1 });
  });

  it('nie sięga poza okno raportu', async () => {
    await zamowienie({
      businessDate: dobaDzis(-30),
      pozycje: [{ nazwa: 'Stare', sztuk: 1, cenaCents: 9900 }],
    });

    const raport = await reports.sprzedaz(manager, 7);

    expect(raport.razem.zamowien).toBe(0);
    expect(raport.dni).toHaveLength(7);
  });
});

describe('dni', () => {
  it('pokazuje dzień bez zamówień jako zero, a nie pomija go', async () => {
    await zamowienie({
      businessDate: dobaDzis(),
      pozycje: [{ nazwa: 'Żurek', sztuk: 1, cenaCents: 2000 }],
    });

    const raport = await reports.sprzedaz(manager, 3);

    // Zamknięty poniedziałek ma być zerem na wykresie. Pominięty sprawiłby,
    // że tydzień wygląda na krótszy, niż był.
    expect(raport.dni).toHaveLength(3);
    expect(raport.dni.filter((dzien) => dzien.zamowien === 0)).toHaveLength(2);
    expect(raport.dni.at(-1)).toMatchObject({ zamowien: 1, sprzedazCents: 2000 });
  });
});

describe('martwe pozycje', () => {
  it('nie nazywa martwym dania spoza czołówki rankingu', async () => {
    // Ranking jest obcięty do kilkunastu pozycji. Liczenie martwych przez
    // odjęcie od rankingu mówiłoby „nikt tego nie zamawia" o daniu, które
    // sprzedaje się codziennie — tylko gorzej od piętnastu innych.
    const dania = [];
    for (let i = 0; i < 18; i += 1) dania.push(await danie(`Danie ${String(i).padStart(2, '0')}`));

    for (const [index, pozycja] of dania.entries()) {
      await zamowienie({
        businessDate: dobaDzis(),
        pozycje: [
          {
            menuItemId: pozycja.id,
            nazwa: `Danie ${String(index).padStart(2, '0')}`,
            sztuk: 1,
            cenaCents: 1000 + index,
          },
        ],
      });
    }

    const raport = await reports.sprzedaz(manager, 7);

    expect(raport.dania).toHaveLength(15);
    expect(raport.martwe).toHaveLength(0);
  });

  it('wskazuje pozycję z karty, której nikt nie zamówił', async () => {
    const sprzedane = await danie('Rosół');
    await danie('Flaki');

    await zamowienie({
      businessDate: dobaDzis(),
      pozycje: [{ menuItemId: sprzedane.id, nazwa: 'Rosół', sztuk: 1, cenaCents: 2000 }],
    });

    const raport = await reports.sprzedaz(manager, 7);

    expect(raport.martwe.map((pozycja) => pozycja.nazwa)).toEqual(['Flaki']);
  });
});

describe('godziny', () => {
  it('daje pełną dobę i liczy w strefie lokalu', async () => {
    // 10:30 UTC = 12:30 w Warszawie latem, 11:30 zimą. Sprawdzamy, że godzina
    // nie została wzięta z UTC — wykres przesunięty o dwie godziny wskazywałby
    // szczyt obiadowy w złym miejscu.
    const owarszawskiej = new Date();
    owarszawskiej.setUTCHours(10, 30, 0, 0);

    await zamowienie({
      businessDate: dobaDzis(),
      createdAt: owarszawskiej,
      pozycje: [{ nazwa: 'Żurek', sztuk: 1, cenaCents: 2000 }],
    });

    const raport = await reports.sprzedaz(manager, 1);

    expect(raport.godziny).toHaveLength(24);
    const zZamowieniem = raport.godziny.filter((wpis) => wpis.zamowien > 0);
    expect(zZamowieniem).toHaveLength(1);
    expect(zZamowieniem[0]!.godzina).toBeGreaterThan(10);
  });
});

describe('eksport CSV', () => {
  /** Ustawia flagę funkcji na abonamencie lokalu testowego. */
  async function ustawEksport(enabled: boolean) {
    await direct.subscription.upsert({
      where: { organizationId },
      update: { reportsExportEnabled: enabled },
      create: {
        organizationId,
        plan: 'pro',
        status: 'active',
        tableLimit: 40,
        languageLimit: 6,
        reportsExportEnabled: enabled,
      },
    });
  }

  it('odmawia planom bez tej funkcji', async () => {
    await ustawEksport(false);

    // Bramka stoi po stronie serwera — ukrycie przycisku w panelu jest wygodą,
    // nie zabezpieczeniem.
    await expect(reports.csv(manager, 7, 'dni')).rejects.toThrow(/Pro i wyższych/);
  });

  it('daje plik, który polski arkusz otworzy poprawnie', async () => {
    await ustawEksport(true);
    await zamowienie({
      businessDate: dobaDzis(),
      pozycje: [{ nazwa: 'Zestaw: zupa; drugie', sztuk: 3, cenaCents: 2050 }],
    });

    const plik = await reports.csv(manager, 7, 'dania');

    // Trzy rzeczy, bez których plik otwiera się jako jedna kolumna krzaków:
    // znacznik BOM, średnik jako separator i przecinek dziesiętny.
    expect(plik.tresc.startsWith('﻿')).toBe(true);
    expect(plik.tresc).toContain('"Danie";"Sztuk"');
    expect(plik.tresc).toContain('61,50');

    // Średnik w nazwie dania nie może rozbić wiersza na dwa.
    expect(plik.tresc).toContain('"Zestaw: zupa; drugie";3;61,50');
    expect(plik.nazwaPliku).toMatch(/^kelbroo-dania-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('eksport dni ma po wierszu na dobę, także pustą', async () => {
    await ustawEksport(true);

    const plik = await reports.csv(manager, 3, 'dni');
    const wiersze = plik.tresc.trimEnd().split('\r\n');

    // Nagłówek + trzy doby. Dzień bez sprzedaży zostaje z zerem, żeby wykres
    // w arkuszu nie zsuwał sąsiednich słupków.
    expect(wiersze).toHaveLength(4);
  });
});
