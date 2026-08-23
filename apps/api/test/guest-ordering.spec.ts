/**
 * Ścieżka gościa od skanu QR do zamówienia, na prawdziwej bazie.
 *
 * Test buduje własną restaurację, żeby nie zależeć od seeda i nie zostawiać
 * po sobie śmieci w danych demo.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { MenuService } from '../src/menu/menu.service';
import { DailyCounterService } from '../src/common/daily-counter.service';
import { GuestSessionService } from '../src/guest/guest-session.service';
import { TableService } from '../src/table/table.service';
import { OrdersService } from '../src/orders/orders.service';
import { OrderPricingService } from '../src/orders/order-pricing.service';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();

const menu = new MenuService();
const counters = new DailyCounterService();
const guests = new GuestSessionService(prisma);
const tables = new TableService(prisma, menu, counters, guests);
const orders = new OrdersService(prisma, counters, new OrderPricingService());

let organizationId: string;
let qrToken: string;

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Ordering ${randomUUID()}`, billingEmail: 'test@rls.test' },
  });
  organizationId = organization.id;

  await direct.subscription.create({
    data: {
      organizationId,
      plan: 'starter',
      status: 'active',
      tableLimit: 10,
      languageLimit: 2,
    },
  });

  const restaurant = await direct.restaurant.create({
    data: {
      organizationId,
      name: 'Testowa',
      slug: `ordering-${randomUUID()}`,
      currency: 'PLN',
      defaultLocale: 'pl',
      supportedLocales: ['pl', 'en'],
      orderingMode: 'pay_at_table',
      requireStaffConfirmation: true,
    },
  });

  qrToken = randomBytes(16).toString('base64url');
  await direct.table.create({
    data: { organizationId, restaurantId: restaurant.id, label: 'Stolik 1', qrToken },
  });

  const category = await direct.menuCategory.create({
    data: {
      organizationId,
      restaurantId: restaurant.id,
      translations: {
        create: [
          { organizationId, locale: 'pl', name: 'Dania' },
          { organizationId, locale: 'en', name: 'Dishes' },
        ],
      },
    },
  });

  await direct.menuItem.create({
    data: {
      organizationId,
      restaurantId: restaurant.id,
      categoryId: category.id,
      priceCents: 5000,
      currency: 'PLN',
      vatRate: new Prisma.Decimal('0.0800'),
      translations: {
        create: [
          { organizationId, locale: 'pl', name: 'Zupa' },
          { organizationId, locale: 'en', name: 'Soup' },
        ],
      },
    },
  });

  // Pozycja bez tłumaczenia angielskiego — sprawdza fallback na język lokalu.
  await direct.menuItem.create({
    data: {
      organizationId,
      restaurantId: restaurant.id,
      categoryId: category.id,
      priceCents: 1500,
      currency: 'PLN',
      vatRate: new Prisma.Decimal('0.2300'),
      sortOrder: 1,
      translations: { create: [{ organizationId, locale: 'pl', name: 'Nalewka' }] },
    },
  });

  await direct.menuItem.create({
    data: {
      organizationId,
      restaurantId: restaurant.id,
      categoryId: category.id,
      priceCents: 3000,
      currency: 'PLN',
      vatRate: new Prisma.Decimal('0.0800'),
      isAvailable: false,
      sortOrder: 2,
      translations: { create: [{ organizationId, locale: 'pl', name: 'Wyprzedane' }] },
    },
  });
});

afterAll(async () => {
  if (organizationId) {
    await direct.organization.delete({ where: { id: organizationId } });
  }
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

const dishId = (entry: Awaited<ReturnType<TableService['enter']>>, name: string): string => {
  const item = entry.menu.flatMap((c) => c.items).find((i) => i.name === name);
  if (!item) throw new Error(`Brak pozycji "${name}" w menu.`);
  return item.id;
};

describe('wejście po skanie QR', () => {
  it('zwraca menu, wizytę i tożsamość uczestnika', async () => {
    const entry = await tables.enter(qrToken, { requestedLocale: 'pl' });

    expect(entry.restaurant.orderingMode).toBe('pay_at_table');
    expect(entry.session.orderingEnabled).toBe(true);
    expect(entry.session.number).toBe(1);
    expect(entry.participant.isHost).toBe(true);
    expect(entry.participant.displayName).toMatch(/\S+ \S+/);
    expect(entry.guestToken).toBeTruthy();
    expect(entry.menu[0]?.name).toBe('Dania');
  });

  it('drugie urządzenie dołącza do tej samej wizyty jako kolejny uczestnik', async () => {
    const first = await tables.enter(qrToken, { requestedLocale: 'pl' });
    const second = await tables.enter(qrToken, { requestedLocale: 'pl' });

    expect(second.session.id).toBe(first.session.id);
    expect(second.participant.id).not.toBe(first.participant.id);
    expect(second.participant.isHost).toBe(false);
    expect(second.participant.displayName).not.toBe(first.participant.displayName);
  });

  it('ponowny skan tym samym tokenem nie tworzy kolejnego uczestnika', async () => {
    const first = await tables.enter(qrToken, { requestedLocale: 'pl' });
    const again = await tables.enter(qrToken, {
      requestedLocale: 'pl',
      existingGuestToken: first.guestToken ?? undefined,
    });

    expect(again.participant.id).toBe(first.participant.id);
    expect(again.guestToken).toBeNull();
  });

  it('brak tłumaczenia spada na język domyślny lokalu, nie na pusty ekran', async () => {
    const entry = await tables.enter(qrToken, { requestedLocale: 'en' });
    const names = entry.menu.flatMap((c) => c.items).map((i) => i.name);

    expect(names).toContain('Soup');
    expect(names).toContain('Nalewka');
    expect(names).not.toContain('');
  });

  it('nieznany token QR kończy się 404, nie wyciekiem', async () => {
    await expect(tables.enter('nie-istnieje', {})).rejects.toThrow();
  });
});

describe('składanie zamówienia', () => {
  it('wycenia po stronie serwera i wylicza VAT z kwoty brutto', async () => {
    const entry = await tables.enter(qrToken, { requestedLocale: 'pl' });
    const guest = await guests.resolve(entry.guestToken!);

    const order = await orders.createForGuest(organizationId, guest!.guestSessionId, {
      items: [
        { menuItemId: dishId(entry, 'Zupa'), quantity: 2 },
        { menuItemId: dishId(entry, 'Nalewka'), quantity: 1 },
      ],
    });

    expect(order.totalCents).toBe(2 * 5000 + 1500);
    // 10000 * 8/108 = 741 (zaokrąglone), 1500 * 23/123 = 280
    expect(order.vatCents).toBe(741 + 280);
    expect(order.session.totalCents).toBe(order.totalCents);
  });

  it('zamówienie czeka na kelnera i nie trafia do kuchni', async () => {
    const entry = await tables.enter(qrToken, { requestedLocale: 'pl' });
    const guest = await guests.resolve(entry.guestToken!);

    const order = await orders.createForGuest(organizationId, guest!.guestSessionId, {
      items: [{ menuItemId: dishId(entry, 'Zupa'), quantity: 1 }],
    });

    expect(order.status).toBe('awaiting_confirmation');
    expect(order.paymentStatus).toBe('awaiting_settlement');
  });

  it('podpisuje każdą pozycję rachunku znakiem jej właściciela', async () => {
    // Rachunek stolika jest wspólny: każdy gość widzi cudze zamówienia. Samo
    // „nie moje" nie wystarczy — przy dzieleniu rachunku ktoś musi umieć
    // wskazać, czyja jest która pozycja.
    const pierwszy = await tables.enter(qrToken, { requestedLocale: 'pl' });
    const drugi = await tables.enter(qrToken, { requestedLocale: 'pl' });
    const g1 = await guests.resolve(pierwszy.guestToken!);
    const g2 = await guests.resolve(drugi.guestToken!);

    await orders.createForGuest(organizationId, g1!.guestSessionId, {
      items: [{ menuItemId: dishId(pierwszy, 'Zupa'), quantity: 1 }],
    });
    await orders.createForGuest(organizationId, g2!.guestSessionId, {
      items: [{ menuItemId: dishId(drugi, 'Nalewka'), quantity: 1 }],
    });

    const widok = await orders.listForSession(organizationId, g1!.guestSessionId);
    const pozycje = widok.orders.flatMap((order) => order.items);

    // Wizyta jest wspólna dla całego pliku, więc szukamy po uczestniku,
    // a nie po „pierwsza pozycja, która nie jest moja".
    const moja = pozycje.find((item) => item.forParticipant?.id === pierwszy.participant.id);
    const cudza = pozycje.find((item) => item.forParticipant?.id === drugi.participant.id);
    expect(moja?.isMine).toBe(true);
    expect(cudza?.isMine).toBe(false);
    expect(moja?.forParticipant?.id).toBe(pierwszy.participant.id);
    // Cudza pozycja też niesie znak — i to jest cały sens tego testu.
    expect(cudza?.forParticipant?.id).toBe(drugi.participant.id);
    expect(cudza?.forParticipant?.symbol).toBe(drugi.participant.symbol);
    expect(cudza?.forParticipant?.color).toBe(drugi.participant.color);
  });

  it('dopisuje zdarzenie do append-only historii', async () => {
    const entry = await tables.enter(qrToken, { requestedLocale: 'pl' });
    const guest = await guests.resolve(entry.guestToken!);

    const order = await orders.createForGuest(organizationId, guest!.guestSessionId, {
      items: [{ menuItemId: dishId(entry, 'Zupa'), quantity: 1 }],
    });

    const events = await direct.orderEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('created');
    expect(events[0]?.actorType).toBe('guest');
  });

  it('odrzuca danie oznaczone jako niedostępne', async () => {
    const entry = await tables.enter(qrToken, { requestedLocale: 'pl' });
    const guest = await guests.resolve(entry.guestToken!);

    await expect(
      orders.createForGuest(organizationId, guest!.guestSessionId, {
        items: [{ menuItemId: dishId(entry, 'Wyprzedane'), quantity: 1 }],
      }),
    ).rejects.toThrow(/niedostępne/);
  });

  it('odrzuca pozycję z menu innej restauracji', async () => {
    const entry = await tables.enter(qrToken, { requestedLocale: 'pl' });
    const guest = await guests.resolve(entry.guestToken!);

    await expect(
      orders.createForGuest(organizationId, guest!.guestSessionId, {
        items: [{ menuItemId: randomUUID(), quantity: 1 }],
      }),
    ).rejects.toThrow(/menu tej restauracji/);
  });

  it('równoczesne zamówienia dostają różne numery dzienne', async () => {
    const entry = await tables.enter(qrToken, { requestedLocale: 'pl' });
    const guest = await guests.resolve(entry.guestToken!);
    const soup = dishId(entry, 'Zupa');

    const placed = await Promise.all(
      Array.from({ length: 8 }, () =>
        orders.createForGuest(organizationId, guest!.guestSessionId, {
          items: [{ menuItemId: soup, quantity: 1 }],
        }),
      ),
    );

    const numbers = placed.map((order) => order.orderNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});
