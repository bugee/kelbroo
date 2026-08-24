/**
 * Cykl życia stolika: sprzątanie, usuwanie gości i blokada.
 *
 * Najostrzejsza reguła jest tu taka, że sprzątanie **nie może** kasować rachunku,
 * za który ktoś już zapłacił albo który został wydany. Stolik ma wrócić do stanu
 * wyjściowego tylko wtedy, gdy naprawdę nie ma czego rozliczać.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { TableLifecycleService } from '../src/staff/table-lifecycle.service';
import { TableService } from '../src/table/table.service';
import { MenuService } from '../src/menu/menu.service';
import { DailyCounterService } from '../src/common/daily-counter.service';
import { GuestSessionService } from '../src/guest/guest-session.service';
import type { GuestGateway } from '../src/realtime/guest.gateway';
import type { StaffSignalsGateway } from '../src/realtime/staff-signals.gateway';
import type { StaffContext } from '../src/auth/auth.types';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();
const guestGateway = { publish: () => undefined } as unknown as GuestGateway;
const staffSignals = {
  publishGuestWaiting: () => undefined,
} as unknown as StaffSignalsGateway;
const menu = new MenuService();
const counters = new DailyCounterService();
const lifecycle = new TableLifecycleService(prisma, guestGateway, counters);
const guests = new GuestSessionService(prisma);
const tables = new TableService(prisma, menu, counters, guests, guestGateway, staffSignals);

let organizationId: string;
let restaurantId: string;
let staff: StaffContext;

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Stolik ${randomUUID()}`, billingEmail: 'stolik@test.local' },
  });
  organizationId = organization.id;

  await direct.subscription.create({
    data: { organizationId, plan: 'pro', status: 'active', tableLimit: 30, languageLimit: 2 },
  });

  const restaurant = await direct.restaurant.create({
    data: { organizationId, name: 'Cyklowa', slug: `cykl-${randomUUID()}`, currency: 'PLN' },
  });
  restaurantId = restaurant.id;

  const category = await direct.menuCategory.create({
    data: {
      organizationId,
      restaurantId,
      translations: { create: [{ organizationId, locale: 'pl', name: 'Dania' }] },
    },
  });
  await direct.menuItem.create({
    data: {
      organizationId,
      restaurantId,
      categoryId: category.id,
      priceCents: 2000,
      currency: 'PLN',
      vatRate: new Prisma.Decimal('0.0800'),
      translations: { create: [{ organizationId, locale: 'pl', name: 'Danie' }] },
    },
  });

  const member = await direct.staffMember.create({
    data: {
      organizationId,
      restaurantId,
      email: `cykl-${randomUUID()}@test.local`,
      name: 'Kelner',
      role: 'waiter',
      passwordHash: 'x',
    },
  });
  staff = { staffId: member.id, organizationId, restaurantId, role: 'waiter', name: 'Kelner' };
});

afterAll(async () => {
  if (organizationId) {
    await direct.payment.deleteMany({ where: { organizationId } });
    await direct.organization.delete({ where: { id: organizationId } });
  }
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

let counter = 0;

async function newTable() {
  counter += 1;
  const qrToken = randomBytes(16).toString('base64url');
  const table = await direct.table.create({
    data: { organizationId, restaurantId, label: `Stolik ${counter}`, qrToken },
  });
  return { table, qrToken };
}

/** Gość wchodzi po kodzie QR i dostaje własny token. */
async function scan(qrToken: string, existingGuestToken?: string) {
  return tables.enter(qrToken, { existingGuestToken });
}

describe('sprzątnięcie stolika', () => {
  it('anuluje zamówienia, wyprowadza gości i blokuje stolik', async () => {
    const { table, qrToken } = await newTable();
    const wejscie = await scan(qrToken);
    const sesja = await direct.tableSession.findFirstOrThrow({ where: { tableId: table.id } });

    await direct.order.create({
      data: {
        organizationId,
        restaurantId,
        tableId: table.id,
        tableSessionId: sesja.id,
        orderNumber: 8000 + counter,
        source: 'guest',
        status: 'confirmed',
        paymentStatus: 'awaiting_settlement',
        currency: 'PLN',
        businessDate: new Date(),
        subtotalCents: 2000,
        totalCents: 2000,
      },
    });

    const po = await lifecycle.reset(staff, table.id, 'goście zrezygnowali');

    const zamowienia = await direct.order.findMany({ where: { tableSessionId: sesja.id } });
    expect(zamowienia.every((order) => order.status === 'canceled')).toBe(true);

    const wizyta = await direct.tableSession.findUniqueOrThrow({ where: { id: sesja.id } });
    // `abandoned`, nie `closed` — nikt nic nie zapłacił, nie ma czego rozliczać.
    expect(wizyta.status).toBe('abandoned');
    expect(wizyta.totalCents).toBe(0);

    const uczestnicy = await direct.tableParticipant.findMany({
      where: { tableSessionId: sesja.id, leftAt: null },
    });
    expect(uczestnicy).toHaveLength(0);
    expect(po.blockedUntil).toBeInstanceOf(Date);
    expect(wejscie.participant.id).toBeTruthy();
  });

  it('odmawia, gdy zamówienie zostało już wydane', async () => {
    const { table, qrToken } = await newTable();
    await scan(qrToken);
    const sesja = await direct.tableSession.findFirstOrThrow({ where: { tableId: table.id } });
    await direct.order.create({
      data: {
        organizationId,
        restaurantId,
        tableId: table.id,
        tableSessionId: sesja.id,
        orderNumber: 8500 + counter,
        source: 'guest',
        status: 'served',
        paymentStatus: 'awaiting_settlement',
        currency: 'PLN',
        businessDate: new Date(),
        subtotalCents: 2000,
        totalCents: 2000,
      },
    });

    await expect(lifecycle.reset(staff, table.id, 'pomyłka')).rejects.toThrow(
      'Zamówienie zostało już wydane',
    );
  });

  it('odmawia, gdy na wizycie są płatności', async () => {
    const { table, qrToken } = await newTable();
    await scan(qrToken);
    const sesja = await direct.tableSession.findFirstOrThrow({ where: { tableId: table.id } });
    await direct.tableSession.update({ where: { id: sesja.id }, data: { paidCents: 500 } });

    await expect(lifecycle.reset(staff, table.id, 'pomyłka')).rejects.toThrow('są już płatności');
  });

  it('wymaga powodu', async () => {
    const { table } = await newTable();
    await expect(lifecycle.reset(staff, table.id, '   ')).rejects.toThrow('wymaga podania powodu');
  });
});

describe('usunięcie gościa', () => {
  it('wyprowadza go z wizyty, ale zostawia jego pozycje na rachunku', async () => {
    const { table, qrToken } = await newTable();
    await scan(qrToken);
    const sesja = await direct.tableSession.findFirstOrThrow({ where: { tableId: table.id } });
    const host = await direct.tableParticipant.findFirstOrThrow({
      where: { tableSessionId: sesja.id },
    });

    const order = await direct.order.create({
      data: {
        organizationId,
        restaurantId,
        tableId: table.id,
        tableSessionId: sesja.id,
        orderNumber: 8700 + counter,
        source: 'guest',
        status: 'confirmed',
        paymentStatus: 'awaiting_settlement',
        currency: 'PLN',
        businessDate: new Date(),
        subtotalCents: 2000,
        totalCents: 2000,
        items: {
          create: [
            {
              organizationId,
              nameSnapshot: 'Danie',
              quantity: 1,
              unitPriceCents: 2000,
              vatRate: new Prisma.Decimal('0.0800'),
              addedBy: 'guest',
              forParticipantId: host.id,
            },
          ],
        },
      },
    });

    await lifecycle.removeParticipant(staff, sesja.id, host.id);

    const po = await direct.tableParticipant.findUniqueOrThrow({ where: { id: host.id } });
    expect(po.leftAt).toBeInstanceOf(Date);

    // Rachunek, z którego da się wymazać komu co przypisano, przestaje być weryfikowalny.
    const pozycje = await direct.orderItem.findMany({ where: { orderId: order.id } });
    expect(pozycje[0]?.forParticipantId).toBe(host.id);
  });

  it('przekazuje rolę hosta następnemu gościowi', async () => {
    const { table, qrToken } = await newTable();
    await scan(qrToken);
    const sesja = await direct.tableSession.findFirstOrThrow({ where: { tableId: table.id } });
    const host = await direct.tableParticipant.findFirstOrThrow({
      where: { tableSessionId: sesja.id },
    });
    const drugi = await direct.tableParticipant.create({
      data: {
        organizationId,
        tableSessionId: sesja.id,
        displayName: 'Drugi',
        symbol: 'heart',
        color: 'blue',
        createdBy: 'guest',
      },
    });

    await lifecycle.removeParticipant(staff, sesja.id, host.id);

    // Bez hosta nie ma do kogo skierować nierozdzielonego grosza przy podziale.
    const po = await direct.tableParticipant.findUniqueOrThrow({ where: { id: drugi.id } });
    expect(po.isHost).toBe(true);
  });

  it('nie usuwa gościa z cudzej wizyty', async () => {
    const { qrToken: obcyToken } = await newTable();
    await scan(obcyToken);
    const { table, qrToken } = await newTable();
    await scan(qrToken);

    const mojaSesja = await direct.tableSession.findFirstOrThrow({ where: { tableId: table.id } });
    const obcy = await direct.tableParticipant.findFirstOrThrow({
      where: { tableSession: { table: { qrToken: obcyToken } } },
    });

    await expect(lifecycle.removeParticipant(staff, mojaSesja.id, obcy.id)).rejects.toThrow(
      'Gość nie należy do tej wizyty.',
    );
  });
});

describe('blokada stolika', () => {
  it('gość po skanie widzi wyłącznie prośbę o otwarcie', async () => {
    const { table, qrToken } = await newTable();
    await lifecycle.blockTable(staff, table.id, 'sprzątanie');

    const wejscie = await scan(qrToken);

    expect(wejscie.session.blockedReason).toBe('table_blocked');
    expect(wejscie.session.orderingEnabled).toBe(false);
    expect(wejscie.participant.id).toBe('');
    // Zablokowany stolik nie zakłada wizyty — o to w tym chodzi.
    expect(await direct.tableSession.count({ where: { tableId: table.id } })).toBe(0);
  });

  it('otwarcie stolika wpuszcza gościa z powrotem', async () => {
    const { table, qrToken } = await newTable();
    await lifecycle.blockTable(staff, table.id);
    await lifecycle.openTable(staff, table.id);

    const wejscie = await scan(qrToken);
    expect(wejscie.session.blockedReason).toBeNull();
    expect(wejscie.participant.id).toBeTruthy();
  });

  it('otwarcie zakłada wizytę, więc obsługa otwiera stolik przed przyjściem gości', async () => {
    const { table, qrToken } = await newTable();

    // Ten sam przycisk działa na wolnym stoliku, nie tylko na zablokowanym:
    // kelner sadza gości, zanim ktokolwiek zeskanuje kod.
    const otwarty = await lifecycle.openTable(staff, table.id);
    expect(otwarty.sessionId).toBeTruthy();

    const sesja = await direct.tableSession.findFirstOrThrow({ where: { tableId: table.id } });
    expect(sesja.openedBy).toBe('staff');
    expect(sesja.openedByStaffId).toBe(staff.staffId);

    // Gość dołącza do wizyty założonej przez obsługę, nie zakłada drugiej.
    const wejscie = await scan(qrToken);
    expect(wejscie.session.id).toBe(sesja.id);
    expect(await direct.tableSession.count({ where: { tableId: table.id } })).toBe(1);
  });

  it('otwarcie stolika z otwartą wizytą nie zakłada drugiej', async () => {
    const { table, qrToken } = await newTable();
    await scan(qrToken);

    const pierwsza = await direct.tableSession.findFirstOrThrow({ where: { tableId: table.id } });
    const wynik = await lifecycle.openTable(staff, table.id);

    expect(wynik.sessionId).toBe(pierwsza.id);
    expect(await direct.tableSession.count({ where: { tableId: table.id } })).toBe(1);
  });

  it('otwarcie stolika zamyka prośbę gościa, żeby nie wisiała w kolejce', async () => {
    const { table } = await newTable();
    await direct.waiterCall.create({
      data: {
        organizationId,
        restaurantId,
        tableId: table.id,
        reason: 'open_table',
      },
    });

    await lifecycle.openTable(staff, table.id);

    const zgloszenia = await direct.waiterCall.findMany({ where: { tableId: table.id } });
    expect(zgloszenia.every((call) => call.status === 'resolved')).toBe(true);
  });

  it('wygasła blokada przestaje obowiązywać', async () => {
    const { table, qrToken } = await newTable();
    await direct.table.update({
      where: { id: table.id },
      data: { blockedUntil: new Date(Date.now() - 1000) },
    });

    const wejscie = await scan(qrToken);
    expect(wejscie.session.blockedReason).toBeNull();
  });
});

describe('odświeżenie po zapłaceniu', () => {
  it('nie zakłada nowej wizyty, tylko mówi że rachunek jest rozliczony', async () => {
    const { table, qrToken } = await newTable();
    const wejscie = await scan(qrToken);
    const token = wejscie.guestToken!;
    const sesja = await direct.tableSession.findFirstOrThrow({ where: { tableId: table.id } });

    await direct.tableSession.update({
      where: { id: sesja.id },
      data: { status: 'closed', closedAt: new Date() },
    });
    // Blokada wygasła — sam upływ czasu nie może przywrócić starego zachowania.
    await direct.table.update({
      where: { id: table.id },
      data: { blockedUntil: new Date(Date.now() - 1000) },
    });

    const ponownie = await scan(qrToken, token);

    expect(ponownie.session.blockedReason).toBe('visit_finished');
    expect(await direct.tableSession.count({ where: { tableId: table.id } })).toBe(1);
  });

  it('nowy gość bez tokenu otwiera normalną wizytę', async () => {
    const { table, qrToken } = await newTable();
    const pierwszy = await scan(qrToken);
    const sesja = await direct.tableSession.findFirstOrThrow({ where: { tableId: table.id } });
    await direct.tableSession.update({
      where: { id: sesja.id },
      data: { status: 'closed', closedAt: new Date() },
    });

    const nowy = await scan(qrToken);

    expect(nowy.session.blockedReason).toBeNull();
    expect(nowy.participant.id).not.toBe(pierwszy.participant.id);
  });
});
