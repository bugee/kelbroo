/**
 * Zestawienie rachunku pobierane jako PDF.
 *
 * **Zestawienie musi sumować się do rachunku.** Gość bierze je do rozliczenia
 * delegacji, więc kwota inna niż zapłacona jest gorsza niż brak zestawienia —
 * i to sprawdza większość tego pliku, na treści dokumentu, nie na jego bajtach.
 *
 * Sam plik testujemy wąsko: że **jest** PDF-em i że nie jest pusty. Tekst
 * w PDF-ie siedzi w podzbiorze kroju pisma, więc szukanie w bajtach napisu
 * „Żurek" niczego by nie dowiodło — wygląd sprawdza się otwierając plik.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { BillSummaryService } from '../src/guest/bill-summary.service';
import { GuestSessionService } from '../src/guest/guest-session.service';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();

const zestawienia = new BillSummaryService(prisma);
let organizationId: string;
let restaurantId: string;
let tableId: string;

/** Wizyta z dwoma gośćmi i po jednym daniu dla każdego. */
async function wizyta(opcje: { nick?: string; danie?: string } = {}) {
  const session = await direct.tableSession.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      businessDate: new Date(),
      sessionNumber: Math.floor(Math.random() * 100_000),
      openedBy: 'guest',
      currency: 'PLN',
      status: 'open',
      subtotalCents: 7000,
      totalCents: 7000,
    },
  });

  const anna = await direct.tableParticipant.create({
    data: {
      organizationId,
      tableSessionId: session.id,
      displayName: opcje.nick ?? 'Wesoły Borsuk',
      symbol: 'star',
      color: 'teal',
      createdBy: 'guest',
      isHost: true,
    },
  });
  const bartek = await direct.tableParticipant.create({
    data: {
      organizationId,
      tableSessionId: session.id,
      displayName: 'Szybki Jeż',
      symbol: 'car',
      color: 'orange',
      createdBy: 'guest',
    },
  });

  const order = await direct.order.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      tableSessionId: session.id,
      orderNumber: Math.floor(Math.random() * 100_000),
      source: 'guest',
      status: 'served',
      paymentStatus: 'awaiting_settlement',
      currency: 'PLN',
      businessDate: new Date(),
      subtotalCents: 7000,
      totalCents: 7000,
    },
  });

  await direct.orderItem.createMany({
    data: [
      {
        organizationId,
        orderId: order.id,
        nameSnapshot: opcje.danie ?? 'Żurek',
        unitPriceCents: 2000,
        quantity: 2,
        vatRate: '0.0800',
        forParticipantId: anna.id,
        addedBy: 'guest',
        status: 'served',
      },
      {
        organizationId,
        orderId: order.id,
        nameSnapshot: 'Pierogi ruskie',
        unitPriceCents: 3000,
        quantity: 1,
        vatRate: '0.0800',
        forParticipantId: bartek.id,
        addedBy: 'guest',
        status: 'served',
      },
    ],
  });

  const token = randomUUID();
  const guestSession = await direct.guestSession.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      tableSessionId: session.id,
      participantId: anna.id,
      tokenHash: GuestSessionService.hash(token),
      locale: 'pl',
      expiresAt: new Date(Date.now() + 6 * 3_600_000),
    },
  });

  return { sessionId: session.id, guestSessionId: guestSession.id };
}

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Zestawienie ${randomUUID().slice(0, 8)}`, billingEmail: 'zest@test.local' },
  });
  organizationId = organization.id;

  const restaurant = await direct.restaurant.create({
    data: {
      organizationId,
      name: 'Pod Delegacją',
      slug: `zest-${randomUUID()}`,
      currency: 'PLN',
    },
  });
  restaurantId = restaurant.id;

  const table = await direct.table.create({
    data: {
      organizationId,
      restaurantId,
      label: 'Stolik 12',
      qrToken: randomUUID().replace(/-/g, ''),
    },
  });
  tableId = table.id;
});

beforeEach(async () => {
  await direct.tableSession.deleteMany({ where: { organizationId } });
});

afterAll(async () => {
  await direct.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

describe('treść zestawienia', () => {
  it('grupuje pozycje po uczestnikach i sumuje do rachunku', async () => {
    const { guestSessionId } = await wizyta();

    const dane = await zestawienia.zestawienie(organizationId, guestSessionId);

    expect(dane.grupy.map((grupa) => grupa.nazwa)).toEqual(['Wesoły Borsuk', 'Szybki Jeż']);
    expect(dane.grupy[0].pozycje).toEqual([
      { nazwa: 'Żurek', ilosc: 2, kwotaCents: 4000 },
    ]);
    expect(dane.grupy[0].sumaCents).toBe(4000);
    expect(dane.grupy[1].sumaCents).toBe(3000);
    // Suma z zestawienia musi zgadzać się z rachunkiem co do grosza — po to
    // gość je bierze.
    expect(dane.grupy.reduce((suma, grupa) => suma + grupa.sumaCents, 0)).toBe(dane.totalCents);
    expect(dane.totalCents).toBe(7000);
  });

  it('niesie nazwę lokalu i datę, i nic poza tym', async () => {
    const { guestSessionId } = await wizyta();

    const dane = await zestawienia.zestawienie(organizationId, guestSessionId);

    expect(dane.lokal).toBe('Pod Delegacją');
    expect(dane.otwarta).toBeInstanceOf(Date);
    // Numer stolika i numer wizyty to nasza numeracja operacyjna. Na dokumencie
    // idącym do cudzej księgowości nie mają czego szukać, więc nie ma ich nawet
    // w treści — nie da się ich przez pomyłkę narysować.
    expect(dane).not.toHaveProperty('stolik');
    expect(dane).not.toHaveProperty('numer');
  });

  it('nie robi zestawienia z pustej wizyty', async () => {
    const session = await direct.tableSession.create({
      data: {
        organizationId,
        restaurantId,
        tableId,
        businessDate: new Date(),
        sessionNumber: 4242,
        openedBy: 'guest',
        currency: 'PLN',
      },
    });
    const guestSession = await direct.guestSession.create({
      data: {
        organizationId,
        restaurantId,
        tableId,
        tableSessionId: session.id,
        tokenHash: GuestSessionService.hash(randomUUID()),
        locale: 'pl',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await expect(zestawienia.pdf(organizationId, guestSession.id)).rejects.toThrow(
      /żadnego zamówienia/,
    );
  });
});

describe('plik', () => {
  it('jest PDF-em, a nie czymś z rozszerzeniem .pdf', async () => {
    const { guestSessionId } = await wizyta();

    const { plik, nazwa } = await zestawienia.pdf(organizationId, guestSessionId);

    expect(plik.subarray(0, 5).toString()).toBe('%PDF-');
    // Pusty dokument z osadzonym krojem waży kilka kilobajtów; zestawienie
    // z pozycjami wyraźnie więcej. Wartość graniczna łapie regres „plik jest,
    // ale nic w nim nie ma".
    expect(plik.length).toBeGreaterThan(8_000);
    expect(nazwa).toMatch(/^zestawienie-pod-delegacja-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('radzi sobie z polskimi znakami i znacznikami w nazwach od gościa', async () => {
    // Nick i nazwa dania pochodzą od gościa. W PDF-ie nie ma czego wstrzyknąć,
    // ale krój musi mieć te znaki — wbudowane kroje PDF-a nie mają polskich
    // diakrytyków i „Żurek" wyszedłby jako „urek".
    const { guestSessionId } = await wizyta({
      nick: 'Zażółć <b>gęślą</b> jaźń',
      danie: 'Żurek na zakwasie ze śliwką',
    });

    const { plik } = await zestawienia.pdf(organizationId, guestSessionId);

    expect(plik.subarray(0, 5).toString()).toBe('%PDF-');
    expect(plik.length).toBeGreaterThan(8_000);
  });

  it('nazwa pliku znosi lokal bez znaków łacińskich', () => {
    expect(BillSummaryService.nazwaPliku('Bistro Łódź', new Date('2026-09-02T10:00:00Z'))).toBe(
      'zestawienie-bistro-lodz-2026-09-02.pdf',
    );
    expect(BillSummaryService.nazwaPliku('!!!', new Date('2026-09-02T10:00:00Z'))).toBe(
      'zestawienie-2026-09-02.pdf',
    );
  });
});
