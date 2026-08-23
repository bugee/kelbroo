/**
 * Zamawianie i edycja w imieniu gościa.
 *
 * Wymóg nadrzędny z docs/product.md §5: w każdym momencie musi być widoczne,
 * co dodał gość, a co obsługa. Testy pilnują atrybucji, historii i tego, żeby
 * kwoty rachunku zgadzały się po każdej zmianie — bo to na nich rozlicza się
 * kelnera i rozstrzyga spory przy stoliku.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { MenuService } from '../src/menu/menu.service';
import { DailyCounterService } from '../src/common/daily-counter.service';
import { OrderPricingService } from '../src/orders/order-pricing.service';
import { OrdersGateway } from '../src/realtime/orders.gateway';
import type { GuestGateway } from '../src/realtime/guest.gateway';
import { StaffOrderingService } from '../src/staff/staff-ordering.service';
import type { StaffContext } from '../src/auth/auth.types';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();

// Gateway rozsyła po Socket.IO; w teście wystarczy, że wywołanie nie wybucha.
const gateway = { publish: () => undefined } as unknown as OrdersGateway;
// Zdarzenia do gościa notujemy, zamiast rozsyłać — sprawdzamy, że w ogóle lecą.
const visitEvents: { tableSessionId: string; kind: string }[] = [];
const guestGateway = {
  publish: (tableSessionId: string, event: { kind: string }) =>
    visitEvents.push({ tableSessionId, kind: event.kind }),
} as unknown as GuestGateway;
const ordering = new StaffOrderingService(
  prisma,
  new DailyCounterService(),
  new OrderPricingService(),
  new MenuService(),
  gateway,
  guestGateway,
);

let organizationId: string;
let restaurantId: string;
let tableId: string;
let drugiStolikId: string;
let zupaId: string;
let kawaId: string;
let waiter: StaffContext;

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Kelner ${randomUUID()}`, billingEmail: 'kelner@test.local' },
  });
  organizationId = organization.id;

  await direct.subscription.create({
    data: { organizationId, plan: 'pro', status: 'active', tableLimit: 20, languageLimit: 2 },
  });

  const restaurant = await direct.restaurant.create({
    data: {
      organizationId,
      name: 'Kelnerska',
      slug: `kelner-${randomUUID()}`,
      currency: 'PLN',
      defaultLocale: 'pl',
      orderingMode: 'pay_at_table',
      // Nawet przy wymaganym potwierdzeniu zamówienie kelnera idzie prosto do kuchni.
      requireStaffConfirmation: true,
    },
  });
  restaurantId = restaurant.id;

  const stolik = await direct.table.create({
    data: {
      organizationId,
      restaurantId,
      label: 'Stolik 1',
      qrToken: randomBytes(16).toString('base64url'),
    },
  });
  tableId = stolik.id;

  const stolik2 = await direct.table.create({
    data: {
      organizationId,
      restaurantId,
      label: 'Stolik 2',
      qrToken: randomBytes(16).toString('base64url'),
    },
  });
  drugiStolikId = stolik2.id;

  const category = await direct.menuCategory.create({
    data: {
      organizationId,
      restaurantId,
      translations: { create: [{ organizationId, locale: 'pl', name: 'Dania' }] },
    },
  });

  const zupa = await direct.menuItem.create({
    data: {
      organizationId,
      restaurantId,
      categoryId: category.id,
      priceCents: 5000,
      currency: 'PLN',
      vatRate: new Prisma.Decimal('0.0800'),
      translations: { create: [{ organizationId, locale: 'pl', name: 'Zupa' }] },
    },
  });
  zupaId = zupa.id;

  const kawa = await direct.menuItem.create({
    data: {
      organizationId,
      restaurantId,
      categoryId: category.id,
      priceCents: 1200,
      currency: 'PLN',
      vatRate: new Prisma.Decimal('0.2300'),
      translations: { create: [{ organizationId, locale: 'pl', name: 'Kawa' }] },
    },
  });
  kawaId = kawa.id;

  const member = await direct.staffMember.create({
    data: {
      organizationId,
      restaurantId,
      email: `kelner-${randomUUID()}@test.local`,
      name: 'Anna Kelnerka',
      role: 'waiter',
      passwordHash: 'x',
    },
  });

  waiter = {
    staffId: member.id,
    organizationId,
    restaurantId,
    role: 'waiter',
    name: 'Anna Kelnerka',
  };
});

afterAll(async () => {
  if (organizationId) await direct.organization.delete({ where: { id: organizationId } });
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

const zamow = (tableIdArg: string, items = [{ menuItemId: zupaId, quantity: 1 }]) =>
  ordering.createOnBehalf(waiter, { tableId: tableIdArg, items });

describe('zamówienie złożone przez kelnera', () => {
  it('omija kolejkę potwierdzeń i trafia prosto do kuchni', async () => {
    const order = await zamow(tableId);

    // Kelner stoi przy stoliku, więc zamówienie jest już potwierdzone fizycznie.
    expect(order.status).toBe('confirmed');
    expect(order.source).toBe('staff');
    expect(order.placedByStaffName).toBe('Anna Kelnerka');
  });

  it('otwiera wizytę, gdy stolik jej nie ma, i dokłada do istniejącej', async () => {
    const pierwsze = await zamow(drugiStolikId);
    const drugie = await zamow(drugiStolikId);

    const sesje = await direct.tableSession.findMany({ where: { tableId: drugiStolikId } });
    expect(sesje).toHaveLength(1);
    expect(sesje[0]?.openedBy).toBe('staff');

    // Jedna wizyta, dwa zamówienia — TableSession jest jednostką rachunku.
    const zamowienia = await direct.order.findMany({
      where: { tableSessionId: sesje[0]?.id },
    });
    expect(zamowienia.map((o) => o.id).sort()).toEqual([pierwsze.id, drugie.id].sort());
  });

  it('powiadamia telefon gościa, że coś się zmieniło w jego rachunku', async () => {
    const order = await zamow(tableId);
    const zamowienie = await direct.order.findUniqueOrThrow({ where: { id: order.id } });

    visitEvents.length = 0;
    await ordering.addItems(waiter, order.id, { items: [{ menuItemId: kawaId, quantity: 1 }] });

    // Pozycja dołożona przez kelnera ma pojawić się u gościa bez odświeżania.
    expect(visitEvents).toContainEqual({
      tableSessionId: zamowienie.tableSessionId,
      kind: 'orders',
    });
  });

  it('oznacza pozycje jako dodane przez obsługę, z nazwiskiem', async () => {
    const order = await zamow(tableId);
    const item = order.items[0];

    expect(item?.addedByStaff).toBe(true);
    expect(item?.addedByName).toBe('Anna Kelnerka');
    // Nikt jeszcze nie edytował — trzecia atrybucja pozostaje pusta.
    expect(item?.lastEditedByName).toBeNull();
  });

  it('odrzuca gościa z innej wizyty', async () => {
    const order = await zamow(tableId);
    const obcaSesja = await direct.tableSession.create({
      data: {
        organizationId,
        restaurantId,
        tableId: drugiStolikId,
        sessionNumber: 900,
        openedBy: 'guest',
        currency: 'PLN',
        businessDate: new Date(),
      },
    });
    const obcyGosc = await direct.tableParticipant.create({
      data: {
        organizationId,
        tableSessionId: obcaSesja.id,
        displayName: 'Obcy',
        color: '#000000',
        avatarKey: 'a1',
        createdBy: 'guest',
      },
    });

    await expect(
      ordering.createOnBehalf(waiter, {
        tableId,
        forParticipantId: obcyGosc.id,
        items: [{ menuItemId: zupaId, quantity: 1 }],
      }),
    ).rejects.toThrow('Ten gość nie należy do tej wizyty.');
    expect(order.id).toBeTruthy();
  });
});

describe('edycja zamówienia', () => {
  it('dodanie pozycji przelicza zamówienie i rachunek wizyty', async () => {
    const order = await zamow(tableId, [{ menuItemId: zupaId, quantity: 1 }]);
    const po = await ordering.addItems(waiter, order.id, {
      items: [{ menuItemId: kawaId, quantity: 2 }],
    });

    expect(po.items).toHaveLength(2);
    expect(po.totalCents).toBe(5000 + 2 * 1200);

    const zamowienie = await direct.order.findUniqueOrThrow({ where: { id: order.id } });
    const sesja = await direct.tableSession.findUniqueOrThrow({
      where: { id: zamowienie.tableSessionId },
    });
    // Rachunek wizyty to suma zamówień, nie kopia ostatniego.
    expect(sesja.totalCents).toBeGreaterThanOrEqual(po.totalCents);
  });

  it('zmiana ilości liczy VAT z zapisanej stawki, nie z bieżącego cennika', async () => {
    const order = await zamow(tableId, [{ menuItemId: kawaId, quantity: 1 }]);
    const itemId = order.items[0]!.id;

    // Cennik zmienia się po złożeniu zamówienia — historyczny rachunek ma zostać nietknięty.
    await direct.menuItem.update({
      where: { id: kawaId },
      data: { vatRate: new Prisma.Decimal('0.0500'), priceCents: 9900 },
    });

    const po = await ordering.changeQuantity(waiter, order.id, itemId, 3);

    expect(po.items[0]?.quantity).toBe(3);
    expect(po.totalCents).toBe(3 * 1200);

    const zamowienie = await direct.order.findUniqueOrThrow({ where: { id: order.id } });
    // 23% zawarte w 3600 gr brutto = 673 gr. Ze stawki 5% wyszłoby 171.
    expect(zamowienie.vatCents).toBe(Math.round((3600 * 0.23) / 1.23));

    await direct.menuItem.update({
      where: { id: kawaId },
      data: { vatRate: new Prisma.Decimal('0.2300'), priceCents: 1200 },
    });
  });

  it('zapisuje trzecią atrybucję przy edycji', async () => {
    const order = await zamow(tableId);
    const po = await ordering.changeQuantity(waiter, order.id, order.items[0]!.id, 2);

    expect(po.items[0]?.lastEditedByName).toBe('Anna Kelnerka');
    expect(po.items[0]?.lastEditedAt).toBeTruthy();
  });

  it('nie pozwala usunąć ostatniej pozycji', async () => {
    const order = await zamow(tableId);

    await expect(ordering.removeItem(waiter, order.id, order.items[0]!.id)).rejects.toThrow(
      'Nie da się usunąć ostatniej pozycji — anuluj całe zamówienie.',
    );
  });

  it('nie pozwala zmieniać zamówienia już wydanego', async () => {
    const order = await zamow(tableId);
    await direct.order.update({ where: { id: order.id }, data: { status: 'served' } });

    await expect(
      ordering.addItems(waiter, order.id, { items: [{ menuItemId: kawaId, quantity: 1 }] }),
    ).rejects.toThrow('Tego zamówienia nie da się już zmienić.');
  });
});

describe('historia zamówienia', () => {
  it('zapisuje każdą zmianę z aktorem i zachowuje ją po usunięciu pozycji', async () => {
    const order = await zamow(tableId, [
      { menuItemId: zupaId, quantity: 1 },
      { menuItemId: kawaId, quantity: 1 },
    ]);
    const kawaItem = order.items.find((item) => item.name === 'Kawa')!;

    await ordering.changeQuantity(waiter, order.id, kawaItem.id, 4);
    await ordering.removeItem(waiter, order.id, kawaItem.id, 'gość zrezygnował');

    const historia = await ordering.history(waiter, order.id);
    const typy = historia.map((event) => event.type);

    expect(typy).toEqual(['created', 'quantity_changed', 'item_removed']);
    expect(historia.every((event) => event.actorName === 'Anna Kelnerka')).toBe(true);

    // Zdarzenie usunięcia powstaje PRZED skasowaniem wiersza, więc nazwa pozycji
    // zostaje w historii mimo ON DELETE SET NULL na order_item_id.
    const usuniecie = historia.at(-1)!;
    expect(usuniecie.before).toMatchObject({ name: 'Kawa', quantity: 4 });
    expect(usuniecie.reason).toBe('gość zrezygnował');
  });
});
