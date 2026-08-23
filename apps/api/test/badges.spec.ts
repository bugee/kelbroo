/**
 * Liczniki pracy czekającej na obsługę.
 *
 * Najważniejsze jest tu rozróżnienie ról: `Kuchnia` znaczy „odbierz" dla kelnera
 * i „zrób" dla kuchni. Pomyłka pokazałaby każdej z nich cudzą robotę, a licznik,
 * któremu nie można wierzyć, jest gorszy niż jego brak.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { BadgesService } from '../src/staff/badges.service';
import type { StaffContext } from '../src/auth/auth.types';
import type { StaffRole } from '@kelbroo/types';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();
const badges = new BadgesService(prisma);

let organizationId: string;
let restaurantId: string;
let tableId: string;
let sessionId: string;

const asRole = (role: StaffRole): StaffContext => ({
  staffId: randomUUID(),
  organizationId,
  restaurantId,
  role,
  name: role,
});

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Liczniki ${randomUUID()}`, billingEmail: 'liczniki@test.local' },
  });
  organizationId = organization.id;

  const restaurant = await direct.restaurant.create({
    data: { organizationId, name: 'Licznikowa', slug: `licz-${randomUUID()}`, currency: 'PLN' },
  });
  restaurantId = restaurant.id;

  const table = await direct.table.create({
    data: {
      organizationId,
      restaurantId,
      label: 'Stolik 1',
      qrToken: randomBytes(16).toString('base64url'),
    },
  });
  tableId = table.id;

  const session = await direct.tableSession.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      sessionNumber: 5000,
      openedBy: 'guest',
      currency: 'PLN',
      businessDate: new Date(),
    },
  });
  sessionId = session.id;
});

afterAll(async () => {
  if (organizationId) {
    await direct.payment.deleteMany({ where: { organizationId } });
    await direct.organization.delete({ where: { id: organizationId } });
  }
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

let orderCounter = 0;

async function order(status: 'awaiting_confirmation' | 'confirmed' | 'preparing' | 'ready') {
  orderCounter += 1;
  return direct.order.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      tableSessionId: sessionId,
      orderNumber: 5000 + orderCounter,
      source: 'guest',
      status,
      paymentStatus: 'awaiting_settlement',
      currency: 'PLN',
      businessDate: new Date(),
      subtotalCents: 1000,
      totalCents: 1000,
      items: {
        create: [
          {
            organizationId,
            nameSnapshot: 'Danie',
            quantity: 1,
            unitPriceCents: 1000,
            vatRate: new Prisma.Decimal('0.0800'),
            addedBy: 'guest',
          },
        ],
      },
    },
  });
}

describe('bez pracy w toku', () => {
  it('nie zwraca zer — zero nie jest informacją', async () => {
    expect(await badges.forStaff(asRole('waiter'))).toEqual({});
    expect(await badges.forStaff(asRole('kitchen'))).toEqual({});
  });
});

describe('rozdział pracy między role', () => {
  it('liczy kelnerowi to, po co ma pójść, a kuchni to, co ma zrobić', async () => {
    await order('awaiting_confirmation');
    await order('confirmed');
    await order('preparing');
    await order('ready');
    await order('ready');

    const kelner = await badges.forStaff(asRole('waiter'));
    // Jedno do potwierdzenia, dwa gotowe do odebrania.
    expect(kelner['/queue']).toBe(1);
    expect(kelner['/kds']).toBe(2);

    const kuchnia = await badges.forStaff(asRole('kitchen'));
    // Kuchnia nie widzi kolejki potwierdzeń i nie liczy gotowych do wydania.
    expect(kuchnia['/queue']).toBeUndefined();
    expect(kuchnia['/kds']).toBe(2);

    // Właściciel i manager nadzorują obie strony przejścia, więc widzą całość.
    for (const role of ['owner', 'manager'] as const) {
      const nadzor = await badges.forStaff(asRole(role));
      expect(nadzor['/queue']).toBe(1);
      expect(nadzor['/kds']).toBe(4);
    }
  });

  it('nie liczy zamówień zamkniętych ani odrzuconych', async () => {
    const przed = await badges.forStaff(asRole('owner'));

    const wydane = await order('ready');
    await direct.order.update({ where: { id: wydane.id }, data: { status: 'served' } });
    const odrzucone = await order('awaiting_confirmation');
    await direct.order.update({ where: { id: odrzucone.id }, data: { status: 'rejected' } });

    const po = await badges.forStaff(asRole('owner'));
    expect(po).toEqual(przed);
  });
});

describe('wezwania kelnera', () => {
  it('doliczają się do kolejki potwierdzeń, ale nie obciążają kuchni', async () => {
    const przedKelner = (await badges.forStaff(asRole('waiter')))['/queue'] ?? 0;

    await direct.waiterCall.create({
      data: { organizationId, restaurantId, tableId, tableSessionId: sessionId, reason: 'help' },
    });

    const poKelner = await badges.forStaff(asRole('waiter'));
    expect(poKelner['/queue']).toBe(przedKelner + 1);

    const kuchnia = await badges.forStaff(asRole('kitchen'));
    expect(kuchnia['/queue']).toBeUndefined();
  });

  it('załatwione wezwanie znika z licznika', async () => {
    const call = await direct.waiterCall.create({
      data: { organizationId, restaurantId, tableId, tableSessionId: sessionId, reason: 'water' },
    });
    const zWezwaniem = (await badges.forStaff(asRole('waiter')))['/queue'] ?? 0;

    await direct.waiterCall.update({ where: { id: call.id }, data: { status: 'resolved' } });

    expect((await badges.forStaff(asRole('waiter')))['/queue']).toBe(zWezwaniem - 1);
  });
});

describe('izolacja lokalu', () => {
  it('nie liczy pracy innej restauracji', async () => {
    const obcaOrganizacja = await direct.organization.create({
      data: { name: `Obca ${randomUUID()}`, billingEmail: 'obca@test.local' },
    });
    const obcaRestauracja = await direct.restaurant.create({
      data: { organizationId: obcaOrganizacja.id, name: 'Obca', slug: `obca-${randomUUID()}` },
    });

    const obcy: StaffContext = {
      staffId: randomUUID(),
      organizationId: obcaOrganizacja.id,
      restaurantId: obcaRestauracja.id,
      role: 'owner',
      name: 'Obcy',
    };

    expect(await badges.forStaff(obcy)).toEqual({});

    await direct.organization.delete({ where: { id: obcaOrganizacja.id } });
  });
});
