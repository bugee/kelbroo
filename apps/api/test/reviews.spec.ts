/**
 * Oceny dań i wizyty.
 *
 * Sens tej funkcji nie leży w gwiazdkach, tylko w tym, co robi z niezadowolonym
 * gościem: daje mu miejsce, w którym powie o tym restauracji, zanim powie
 * internetowi. Dlatego dwie rzeczy muszą się trzymać — **jedno zgłoszenie na
 * gościa** (inaczej jeden zły wieczór zamienia się w dwadzieścia jedynek) i to,
 * że każdy przy stoliku ma własne, osobne prawo głosu.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReviewsService } from '../src/guest/reviews.service';
import { ReviewsAdminService } from '../src/management/reviews.admin.service';
import { GuestSessionService } from '../src/guest/guest-session.service';
import type { StaffContext } from '../src/auth/auth.types';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();
const reviews = new ReviewsService(prisma);
const panel = new ReviewsAdminService(prisma);

let organizationId: string;
let restaurantId: string;
let tableId: string;
let categoryId: string;
let dishId: string;
let sessionId: string;
let staff: StaffContext;

/** Gość przy bieżącej wizycie, ze swoim wydanym daniem. */
async function goscZDaniem(opcje: { wydane?: boolean } = {}) {
  const participant = await direct.tableParticipant.create({
    data: {
      organizationId,
      tableSessionId: sessionId,
      displayName: `Gość ${randomUUID().slice(0, 4)}`,
      symbol: 'star',
      color: 'teal',
      createdBy: 'guest',
    },
  });

  const order = await direct.order.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      tableSessionId: sessionId,
      orderNumber: Math.floor(Math.random() * 100_000),
      businessDate: new Date(),
      source: 'guest',
      status: 'served',
      paymentStatus: 'awaiting_settlement',
      currency: 'PLN',
      subtotalCents: 2500,
      vatCents: 200,
      totalCents: 2700,
    },
  });

  await direct.orderItem.create({
    data: {
      organizationId,
      orderId: order.id,
      menuItemId: dishId,
      nameSnapshot: 'Danie testowe',
      quantity: 1,
      unitPriceCents: 2500,
      vatRate: '0.0800',
      forParticipantId: participant.id,
      addedBy: 'guest',
      status: opcje.wydane === false ? 'queued' : 'served',
    },
  });

  const token = randomUUID();
  const guestSession = await direct.guestSession.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      tableSessionId: sessionId,
      participantId: participant.id,
      tokenHash: GuestSessionService.hash(token),
      locale: 'pl',
      expiresAt: new Date(Date.now() + 6 * 3_600_000),
    },
  });

  return { guestSessionId: guestSession.id, participantId: participant.id };
}

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Oceny ${randomUUID().slice(0, 8)}`, billingEmail: 'oceny@test.local' },
  });
  organizationId = organization.id;

  const restaurant = await direct.restaurant.create({
    data: { organizationId, name: 'Oceniana', slug: `oceny-${randomUUID()}`, currency: 'PLN' },
  });
  restaurantId = restaurant.id;

  const table = await direct.table.create({
    data: { organizationId, restaurantId, label: 'Stolik 1', qrToken: randomUUID() },
  });
  tableId = table.id;

  const category = await direct.menuCategory.create({ data: { organizationId, restaurantId } });
  categoryId = category.id;

  const dish = await direct.menuItem.create({
    data: {
      organizationId,
      restaurantId,
      categoryId,
      priceCents: 2500,
      currency: 'PLN',
      vatRate: '0.0800',
      translations: { create: [{ organizationId, locale: 'pl', name: 'Danie testowe' }] },
    },
  });
  dishId = dish.id;

  const member = await direct.staffMember.create({
    data: {
      organizationId,
      restaurantId,
      email: `oceny-${randomUUID().slice(0, 8)}@test.local`,
      name: 'Manager',
      role: 'manager',
      passwordHash: 'x',
    },
  });
  staff = { staffId: member.id, organizationId, restaurantId, role: 'manager', name: 'Manager' };
});

/** Oceny są funkcją planu Pro — testy sprzed bramki muszą ją mieć włączoną. */
async function ustawFunkcje(enabled: boolean) {
  await direct.subscription.upsert({
    where: { organizationId },
    update: { reviewsEnabled: enabled },
    create: {
      organizationId,
      plan: 'pro',
      status: 'active',
      tableLimit: 40,
      languageLimit: 6,
      staffLimit: 9999,
      reviewsEnabled: enabled,
    },
  });
}

beforeEach(async () => {
  await ustawFunkcje(true);
  await direct.review.deleteMany({ where: { organizationId } });
  await direct.tableSession.deleteMany({ where: { organizationId } });
  const session = await direct.tableSession.create({
    data: {
      organizationId,
      restaurantId,
      tableId,
      businessDate: new Date(),
      sessionNumber: Math.floor(Math.random() * 100_000),
      openedBy: 'guest',
      currency: 'PLN',
    },
  });
  sessionId = session.id;
});

afterAll(async () => {
  await direct.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

describe('co gość może ocenić', () => {
  it('swoje wydane danie', async () => {
    const gosc = await goscZDaniem();

    const wynik = await reviews.reviewable(organizationId, gosc.guestSessionId);

    expect(wynik.dishes).toEqual([{ menuItemId: dishId, name: 'Danie testowe' }]);
    expect(wynik.alreadySubmitted).toBe(false);
  });

  it('nie danie, którego jeszcze nie dostał', async () => {
    // Pytanie o smak czegoś, co stoi na kuchni, wygląda jak pomyłka
    // i nie niesie żadnej informacji.
    const gosc = await goscZDaniem({ wydane: false });

    expect((await reviews.reviewable(organizationId, gosc.guestSessionId)).dishes).toEqual([]);
  });

  it('nie cudze danie przy tym samym stoliku', async () => {
    await goscZDaniem();
    const drugi = await direct.tableParticipant.create({
      data: {
        organizationId,
        tableSessionId: sessionId,
        displayName: 'Drugi',
        symbol: 'car',
        color: 'orange',
        createdBy: 'guest',
      },
    });
    const sesjaDrugiego = await direct.guestSession.create({
      data: {
        organizationId,
        restaurantId,
        tableId,
        tableSessionId: sessionId,
        participantId: drugi.id,
        tokenHash: GuestSessionService.hash(randomUUID()),
        locale: 'pl',
        expiresAt: new Date(Date.now() + 6 * 3_600_000),
      },
    });

    // Rachunek jest wspólny, ale smak już nie.
    expect((await reviews.reviewable(organizationId, sesjaDrugiego.id)).dishes).toEqual([]);
  });
});

describe('wystawienie oceny', () => {
  it('zapisuje ocenę dania i wizyty naraz', async () => {
    const gosc = await goscZDaniem();

    const wynik = await reviews.submit(organizationId, gosc.guestSessionId, {
      dishes: [{ menuItemId: dishId, rating: 5, comment: 'Rewelacja' }],
      visit: { rating: 4, target: 'service', comment: 'Miła obsługa' },
    });

    expect(wynik).toEqual({ saved: 2 });
    const zapisane = await direct.review.findMany({ where: { organizationId } });
    expect(zapisane.map((r) => r.target).sort()).toEqual(['dish', 'service']);
  });

  it('przyjmuje jedno zgłoszenie na gościa', async () => {
    const gosc = await goscZDaniem();
    await reviews.submit(organizationId, gosc.guestSessionId, {
      visit: { rating: 1, target: 'kitchen' },
    });

    // Bez tego jeden zły wieczór zamienia się w dwadzieścia jedynek.
    await expect(
      reviews.submit(organizationId, gosc.guestSessionId, {
        visit: { rating: 1, target: 'kitchen' },
      }),
    ).rejects.toThrow(/raz na wizytę/);
  });

  it('nie zabiera głosu pozostałym przy stoliku', async () => {
    const pierwszy = await goscZDaniem();
    const drugi = await goscZDaniem();

    await reviews.submit(organizationId, pierwszy.guestSessionId, {
      visit: { rating: 5, target: 'kitchen' },
    });

    // Limit jest na gościa, nie na stolik — inaczej oceniałby wyłącznie ten,
    // kto zdążył pierwszy.
    await expect(
      reviews.submit(organizationId, drugi.guestSessionId, {
        visit: { rating: 2, target: 'service' },
      }),
    ).resolves.toEqual({ saved: 1 });
  });

  it('odrzuca ocenę spoza skali', async () => {
    const gosc = await goscZDaniem();

    await expect(
      reviews.submit(organizationId, gosc.guestSessionId, {
        visit: { rating: 6, target: 'kitchen' },
      }),
    ).rejects.toThrow(/od 1 do 5/);
  });

  it('odrzuca puste zgłoszenie', async () => {
    const gosc = await goscZDaniem();

    await expect(reviews.submit(organizationId, gosc.guestSessionId, {})).rejects.toThrow(
      /Nie ma czego zapisać/,
    );
  });

  it('po wystawieniu mówi o tym gościowi', async () => {
    const gosc = await goscZDaniem();
    await reviews.submit(organizationId, gosc.guestSessionId, {
      visit: { rating: 5, target: 'kitchen' },
    });

    expect((await reviews.reviewable(organizationId, gosc.guestSessionId)).alreadySubmitted).toBe(
      true,
    );
  });
});

describe('bramka planu', () => {
  it('bez funkcji gość nie dostaje zaproszenia do oceny', async () => {
    await ustawFunkcje(false);
    const gosc = await goscZDaniem();

    // Zamiast błędu — pusta lista. Gość nie ma prawa zobaczyć, że coś mu
    // odebrano; dla niego ten lokal po prostu nie zbiera ocen.
    expect(await reviews.reviewable(organizationId, gosc.guestSessionId)).toEqual({
      dishes: [],
      alreadySubmitted: false,
    });
  });

  it('bez funkcji nie przyjmujemy oceny wysłanej mimo wszystko', async () => {
    await ustawFunkcje(false);
    const gosc = await goscZDaniem();

    // Ukrycie przycisku jest wygodą, nie zabezpieczeniem — bramka stoi tutaj.
    await expect(
      reviews.submit(organizationId, gosc.guestSessionId, {
        visit: { rating: 5, target: 'kitchen' },
      }),
    ).rejects.toThrow(/nie zbiera ocen/);
  });

  it('zaplecze może włączyć oceny bez zmiany planu', async () => {
    await ustawFunkcje(true);
    const gosc = await goscZDaniem();

    await expect(
      reviews.submit(organizationId, gosc.guestSessionId, {
        visit: { rating: 5, target: 'kitchen' },
      }),
    ).resolves.toEqual({ saved: 1 });
  });
});

describe('opinie w panelu', () => {
  it('nieprzeczytane idą na górę', async () => {
    const gosc = await goscZDaniem();
    await reviews.submit(organizationId, gosc.guestSessionId, {
      dishes: [{ menuItemId: dishId, rating: 2, comment: 'Za słone' }],
    });
    const [pierwsza] = await panel.list(staff);
    await panel.markRead(staff, pierwsza!.id);

    const drugi = await goscZDaniem();
    await reviews.submit(organizationId, drugi.guestSessionId, {
      visit: { rating: 1, target: 'service', comment: 'Długo czekaliśmy' },
    });

    const lista = await panel.list(staff);
    // Jeśli nikt tego nie czyta, mechanizm jest pozorny — dlatego świeże
    // wychodzą przed odhaczone, niezależnie od daty.
    expect(lista[0]!.isRead).toBe(false);
    expect(lista[0]!.comment).toBe('Długo czekaliśmy');
  });

  it('niesie kontekst potrzebny do rozmowy przy stoliku', async () => {
    const gosc = await goscZDaniem();
    await reviews.submit(organizationId, gosc.guestSessionId, {
      dishes: [{ menuItemId: dishId, rating: 3 }],
    });

    const [opinia] = await panel.list(staff);
    expect(opinia!.dishName).toBe('Danie testowe');
    expect(opinia!.tableLabel).toBe('Stolik 1');
    expect(opinia!.guestName).toMatch(/^Gość/);
  });

  it('liczy nieprzeczytane', async () => {
    const gosc = await goscZDaniem();
    await reviews.submit(organizationId, gosc.guestSessionId, {
      dishes: [{ menuItemId: dishId, rating: 4 }],
      visit: { rating: 4, target: 'kitchen' },
    });

    expect(await panel.unreadCount(staff)).toBe(2);
    const [pierwsza] = await panel.list(staff);
    await panel.markRead(staff, pierwsza!.id);
    expect(await panel.unreadCount(staff)).toBe(1);
  });
});
