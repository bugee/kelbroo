/**
 * Sygnały od gościa do obsługi: wezwanie kelnera i prośba o rachunek.
 *
 * Wezwanie jest zapisem w bazie, nie tylko powiadomieniem — po zgubionym
 * połączeniu albo przeładowanym tablecie nadal musi być widać, że ktoś czeka.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { SplitService } from '../src/staff/split.service';
import { WaiterCallsService } from '../src/staff/waiter-calls.service';
import { GuestSignalsService } from '../src/guest/guest-signals.service';
import { StaffSignalsGateway } from '../src/realtime/staff-signals.gateway';
import type { GuestGateway } from '../src/realtime/guest.gateway';
import type { OrdersGateway } from '../src/realtime/orders.gateway';
import type { StaffContext } from '../src/auth/auth.types';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();

const emitted: { restaurantId: string; tableLabel: string }[] = [];
const orders = { server: undefined } as unknown as OrdersGateway;
const signalsGateway = new StaffSignalsGateway(orders);
// Podmieniamy tylko wysyłkę — reszta klasy ma się wykonać naprawdę.
signalsGateway.publishWaiterCall = (restaurantId, event) => {
  emitted.push({ restaurantId, tableLabel: event.tableLabel });
};

const split = new SplitService(prisma);
const guestSignals = new GuestSignalsService(prisma, split, signalsGateway);
// Kanał gościa notuje zdarzenia zamiast je rozsyłać — sprawdzamy, że lecą.
const visitEvents: { tableSessionId: string; kind: string }[] = [];
const guestGateway = {
  publish: (tableSessionId: string, event: { kind: string }) =>
    visitEvents.push({ tableSessionId, kind: event.kind }),
} as unknown as GuestGateway;

const waiterCalls = new WaiterCallsService(prisma, guestGateway);

let organizationId: string;
let restaurantId: string;
let tableId: string;
let staff: StaffContext;

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Sygnały ${randomUUID()}`, billingEmail: 'sygnaly@test.local' },
  });
  organizationId = organization.id;

  const restaurant = await direct.restaurant.create({
    data: { organizationId, name: 'Sygnałowa', slug: `sygnaly-${randomUUID()}`, currency: 'PLN' },
  });
  restaurantId = restaurant.id;

  const table = await direct.table.create({
    data: {
      organizationId,
      restaurantId,
      label: 'Stolik 7',
      qrToken: randomBytes(16).toString('base64url'),
    },
  });
  tableId = table.id;

  const member = await direct.staffMember.create({
    data: {
      organizationId,
      restaurantId,
      email: `sygnaly-${randomUUID()}@test.local`,
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

/** Wizyta z dwoma gośćmi, rachunkiem i sesją gościa gotową do sygnałów. */
async function visit(totalCents: number) {
  counter += 1;
  const session = await direct.tableSession.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      sessionNumber: 3000 + counter,
      openedBy: 'guest',
      currency: 'PLN',
      businessDate: new Date(),
      subtotalCents: totalCents,
      totalCents,
    },
  });

  const host = await direct.tableParticipant.create({
    data: {
      organizationId,
      tableSessionId: session.id,
      displayName: 'Ala',
      symbol: 'star',
      color: '#111111',
      isHost: true,
      createdBy: 'guest',
    },
  });
  await direct.tableParticipant.create({
    data: {
      organizationId,
      tableSessionId: session.id,
      displayName: 'Borys',
      symbol: 'heart',
      color: '#222222',
      createdBy: 'guest',
    },
  });

  await direct.order.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      tableSessionId: session.id,
      orderNumber: 3000 + counter,
      source: 'guest',
      status: 'confirmed',
      paymentStatus: 'awaiting_settlement',
      currency: 'PLN',
      businessDate: new Date(),
      subtotalCents: totalCents,
      totalCents,
      items: {
        create: [
          {
            organizationId,
            nameSnapshot: 'Danie',
            quantity: 1,
            unitPriceCents: totalCents,
            vatRate: new Prisma.Decimal('0.0800'),
            addedBy: 'guest',
            forParticipantId: host.id,
          },
        ],
      },
    },
  });

  const guestSession = await direct.guestSession.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      tableSessionId: session.id,
      participantId: host.id,
      tokenHash: randomBytes(16).toString('hex'),
      locale: 'pl',
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });

  return { session, guestSession, host };
}

describe('wezwanie kelnera', () => {
  it('zapisuje zgłoszenie i sygnalizuje je obsłudze', async () => {
    const { guestSession } = await visit(5000);
    emitted.length = 0;

    const call = await guestSignals.call(organizationId, guestSession.id, 'water');

    expect(call.reason).toBe('water');
    expect(call.status).toBe('open');
    expect(emitted).toEqual([{ restaurantId, tableLabel: 'Stolik 7' }]);

    const otwarte = await waiterCalls.open(staff);
    expect(otwarte.some((entry) => entry.id === call.id)).toBe(true);
  });

  it('powtórzone stuknięcie nie tworzy drugiego zgłoszenia', async () => {
    const { guestSession } = await visit(5000);

    const pierwsze = await guestSignals.call(organizationId, guestSession.id, 'help');
    const drugie = await guestSignals.call(organizationId, guestSession.id, 'help');

    expect(drugie.id).toBe(pierwsze.id);
  });

  it('przyjęcie pokazuje resztcie zmiany, że ktoś już idzie', async () => {
    const { guestSession } = await visit(5000);
    const call = await guestSignals.call(organizationId, guestSession.id, 'other');

    await waiterCalls.acknowledge(staff, call.id);
    const otwarte = await waiterCalls.open(staff);
    const wpis = otwarte.find((entry) => entry.id === call.id)!;

    expect(wpis.status).toBe('acknowledged');
    expect(wpis.acknowledgedBy).toBe('Kelner');
  });

  it('gość widzi stan zgłoszenia: wysłane, potem przyjęte, potem nic', async () => {
    const { guestSession } = await visit(5000);

    // Zanim gość cokolwiek kliknie, nie ma czego pokazywać.
    expect(await guestSignals.activeCalls(organizationId, guestSession.id)).toEqual([]);

    const call = await guestSignals.call(organizationId, guestSession.id, 'help');
    const poWyslaniu = await guestSignals.activeCalls(organizationId, guestSession.id);
    // „Wysłane" — zgłoszenie leży w kolejce, ale nikt go jeszcze nie przyjął.
    expect(poWyslaniu).toEqual([{ id: call.id, reason: 'help', status: 'open' }]);

    visitEvents.length = 0;
    await waiterCalls.acknowledge(staff, call.id);
    const poPrzyjeciu = await guestSignals.activeCalls(organizationId, guestSession.id);
    // Dopiero teraz gościowi wolno powiedzieć, że kelner idzie.
    expect(poPrzyjeciu[0]?.status).toBe('acknowledged');
    // I dowiaduje się o tym zdarzeniem, nie odpytywaniem.
    expect(visitEvents).toEqual([{ tableSessionId: guestSession.tableSessionId, kind: 'call' }]);

    await waiterCalls.resolve(staff, call.id);
    expect(await guestSignals.activeCalls(organizationId, guestSession.id)).toEqual([]);
  });

  it('załatwione zgłoszenie znika z widoku', async () => {
    const { guestSession } = await visit(5000);
    const call = await guestSignals.call(organizationId, guestSession.id, 'other');

    await waiterCalls.resolve(staff, call.id);
    const otwarte = await waiterCalls.open(staff);

    expect(otwarte.some((entry) => entry.id === call.id)).toBe(false);
  });
});

describe('prośba o rachunek', () => {
  it('ustawia podział i przestawia wizytę w oczekiwanie na rozliczenie', async () => {
    const { session, guestSession } = await visit(10001);

    const wynik = await guestSignals.requestBill(organizationId, guestSession.id, 'equal');

    expect(wynik.splitMode).toBe('equal');
    // Ten sam niezmiennik co przy podziale ustawionym przez kelnera.
    expect(wynik.groups.reduce((sum, group) => sum + group.totalCents, 0)).toBe(10001);

    const po = await direct.tableSession.findUniqueOrThrow({ where: { id: session.id } });
    // Rachunek zamyka wyłącznie personel — prośba gościa go nie rozlicza.
    expect(po.status).toBe('awaiting_settlement');
    expect(po.paidCents).toBe(0);
  });

  it('dokłada wezwanie z powodem „rachunek", żeby kelner o tym wiedział', async () => {
    const { guestSession } = await visit(4000);

    await guestSignals.requestBill(organizationId, guestSession.id, 'per_person');
    const otwarte = await waiterCalls.open(staff);

    expect(otwarte.some((entry) => entry.reason === 'bill')).toBe(true);
  });

  it('odmawia, gdy rachunek jest już rozliczony', async () => {
    const { session, guestSession } = await visit(4000);
    await direct.tableSession.update({ where: { id: session.id }, data: { status: 'closed' } });

    await expect(
      guestSignals.requestBill(organizationId, guestSession.id, 'equal'),
    ).rejects.toThrow('Rachunek jest już rozliczony.');
  });
});
