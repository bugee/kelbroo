/**
 * Wpuszczanie gości do wizyty przez hosta.
 *
 * Kod QR leży na stoliku na widoku — przy stoliku pod oknem odczyta go ktoś
 * z chodnika. Reguła, którą trzeba tu utrzymać, jest jedna: dopóki host nie
 * wpuści, czekający **nie może zamówić**, i to musi być bariera po stronie
 * serwera, nie wygaszony przycisk.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { TableAccessService } from '../src/guest/table-access.service';
import { TableService } from '../src/table/table.service';
import { OrdersService } from '../src/orders/orders.service';
import { OrderPricingService } from '../src/orders/order-pricing.service';
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
const access = new TableAccessService(prisma, guestGateway);

const menu = new MenuService();
const counters = new DailyCounterService();
const guests = new GuestSessionService(prisma);
const tables = new TableService(prisma, menu, counters, guests, guestGateway, staffSignals);
const orders = new OrdersService(prisma, counters, new OrderPricingService());

let organizationId: string;
let restaurantId: string;
let menuItemId: string;
let staff: StaffContext;

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Wstęp ${randomUUID()}`, billingEmail: 'wstep@test.local' },
  });
  organizationId = organization.id;

  await direct.subscription.create({
    data: { organizationId, plan: 'pro', status: 'active', tableLimit: 30, languageLimit: 2 },
  });

  const restaurant = await direct.restaurant.create({
    data: {
      organizationId,
      name: 'Wstępna',
      slug: `wstep-${randomUUID()}`,
      currency: 'PLN',
      hostApprovesGuests: true,
    },
  });
  restaurantId = restaurant.id;

  const category = await direct.menuCategory.create({
    data: {
      organizationId,
      restaurantId,
      translations: { create: [{ organizationId, locale: 'pl', name: 'Dania' }] },
    },
  });
  const item = await direct.menuItem.create({
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
  menuItemId = item.id;

  const member = await direct.staffMember.create({
    data: {
      organizationId,
      restaurantId,
      email: `wstep-${randomUUID()}@test.local`,
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
    data: { organizationId, restaurantId, label: `Wstęp ${counter}`, qrToken },
  });
  return { table, qrToken };
}

/** Identyfikator sesji gościa — potrzebny tam, gdzie serwis nie dostaje tokenu. */
async function guestSessionOf(participantId: string) {
  const row = await direct.guestSession.findFirstOrThrow({ where: { participantId } });
  return row.id;
}

describe('host wpuszcza gości', () => {
  it('pierwszy skanujący wchodzi bez zgody i zostaje hostem', async () => {
    const { qrToken } = await newTable();
    const host = await tables.enter(qrToken, {});

    expect(host.participant.isHost).toBe(true);
    expect(host.participant.approved).toBe(true);
    expect(host.session.orderingEnabled).toBe(true);
    expect(host.session.blockedReason).toBeNull();
  });

  it('kolejny gość czeka i nie ma prawa zamawiać', async () => {
    const { qrToken } = await newTable();
    await tables.enter(qrToken, {});
    const drugi = await tables.enter(qrToken, {});

    expect(drugi.participant.approved).toBe(false);
    expect(drugi.session.orderingEnabled).toBe(false);
    expect(drugi.session.blockedReason).toBe('awaiting_host_approval');

    // Bariera serwera, nie wygaszony przycisk: żądanie z pominięciem interfejsu
    // musi się odbić o tę samą regułę.
    await expect(
      orders.createForGuest(organizationId, await guestSessionOf(drugi.participant.id), {
        items: [{ menuItemId, quantity: 1 }],
      }),
    ).rejects.toThrow(/host/i);
  });

  it('po wpuszczeniu gość zamawia normalnie', async () => {
    const { qrToken } = await newTable();
    const host = await tables.enter(qrToken, {});
    const drugi = await tables.enter(qrToken, {});

    await access.decideAsHost(
      organizationId,
      await guestSessionOf(host.participant.id),
      drugi.participant.id,
      'approve',
    );

    const zamowienie = await orders.createForGuest(
      organizationId,
      await guestSessionOf(drugi.participant.id),
      { items: [{ menuItemId, quantity: 1 }] },
    );
    expect(zamowienie.totalCents).toBeGreaterThan(0);
  });

  it('odesłany gość znika z wizyty', async () => {
    const { qrToken } = await newTable();
    const host = await tables.enter(qrToken, {});
    const obcy = await tables.enter(qrToken, {});

    await access.decideAsHost(
      organizationId,
      await guestSessionOf(host.participant.id),
      obcy.participant.id,
      'reject',
    );

    const wiersz = await direct.tableParticipant.findUniqueOrThrow({
      where: { id: obcy.participant.id },
    });
    expect(wiersz.leftAt).not.toBeNull();
    expect(wiersz.approvedAt).toBeNull();
  });

  it('nie-host nie wpuszcza nikogo', async () => {
    const { qrToken } = await newTable();
    const host = await tables.enter(qrToken, {});
    const drugi = await tables.enter(qrToken, {});
    const trzeci = await tables.enter(qrToken, {});

    await access.decideAsHost(
      organizationId,
      await guestSessionOf(host.participant.id),
      drugi.participant.id,
      'approve',
    );

    // Wpuszczony gość nadal nie jest hostem — inaczej wystarczyłoby wejść raz,
    // żeby wpuścić resztę ulicy.
    await expect(
      access.decideAsHost(
        organizationId,
        await guestSessionOf(drugi.participant.id),
        trzeci.participant.id,
        'approve',
      ),
    ).rejects.toThrow(/host/i);
  });

  it('kelner wpuszcza zastępczo, gdy host odszedł od stolika', async () => {
    const { table, qrToken } = await newTable();
    await tables.enter(qrToken, {});
    const drugi = await tables.enter(qrToken, {});
    const sesja = await direct.tableSession.findFirstOrThrow({ where: { tableId: table.id } });

    await access.decideAsStaff(staff, sesja.id, drugi.participant.id, 'approve');

    const wiersz = await direct.tableParticipant.findUniqueOrThrow({
      where: { id: drugi.participant.id },
    });
    expect(wiersz.approvedAt).not.toBeNull();
  });

  it('kolejkę oczekujących widzi wyłącznie host', async () => {
    const { qrToken } = await newTable();
    const host = await tables.enter(qrToken, {});
    const czekajacy = await tables.enter(qrToken, {});

    const uHosta = await access.pendingForGuest(
      organizationId,
      await guestSessionOf(host.participant.id),
    );
    expect(uHosta.map((g) => g.id)).toEqual([czekajacy.participant.id]);

    const uCzekajacego = await access.pendingForGuest(
      organizationId,
      await guestSessionOf(czekajacy.participant.id),
    );
    expect(uCzekajacego).toEqual([]);
  });

  it('gdy przy stoliku nie został nikt wpuszczony, kolejny skan zakłada nową rolę hosta', async () => {
    const { table, qrToken } = await newTable();
    const host = await tables.enter(qrToken, {});

    // Host wyszedł — bez tej reguły następny gość czekałby na zgodę osoby,
    // której już nie ma, i nie mógłby zrobić nic.
    await direct.tableParticipant.update({
      where: { id: host.participant.id },
      data: { leftAt: new Date() },
    });
    await direct.tableSession.updateMany({
      where: { tableId: table.id },
      data: { status: 'open' },
    });

    const kolejny = await tables.enter(qrToken, {});
    expect(kolejny.participant.isHost).toBe(true);
    expect(kolejny.participant.approved).toBe(true);
  });

  it('wyłączona zgoda hosta wpuszcza każdego od razu', async () => {
    const otwarty = await direct.restaurant.create({
      data: {
        organizationId,
        name: 'Otwarta',
        slug: `otw-${randomUUID()}`,
        currency: 'PLN',
        hostApprovesGuests: false,
      },
    });
    const qrToken = randomBytes(16).toString('base64url');
    await direct.table.create({
      data: { organizationId, restaurantId: otwarty.id, label: 'Otwarty', qrToken },
    });

    await tables.enter(qrToken, {});
    const drugi = await tables.enter(qrToken, {});
    expect(drugi.participant.approved).toBe(true);
    expect(drugi.session.orderingEnabled).toBe(true);
  });
});
