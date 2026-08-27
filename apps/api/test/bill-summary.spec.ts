/**
 * Zestawienie rachunku na e-mail.
 *
 * Trzy rzeczy trzeba tu pilnować i każda z innego powodu.
 *
 * **Zestawienie musi sumować się do rachunku.** Gość bierze je do rozliczenia
 * delegacji, więc kwota inna niż zapłacona jest gorsza niż brak zestawienia.
 *
 * **Nazwy pochodzą od gościa.** Nick i nazwa dania wchodzą do wiadomości HTML,
 * a szablon wstawia akapity surowo — bez ucieczki mielibyśmy wstrzyknięcie
 * znaczników do poczty wysyłanej z naszego adresu.
 *
 * **To wejście wysyła pocztę na cudze polecenie**, więc musi mieć limit.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { BillSummaryService } from '../src/guest/bill-summary.service';
import { GuestSessionService } from '../src/guest/guest-session.service';
import type { MailService } from '../src/mail/mail.service';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();

let wyslane: { to: string; subject: string; text: string; html?: string }[] = [];
const poczta = {
  adresStrony: 'https://kelbroo.test',
  skrzynkaKelbroo: 'kontakt@kelbroo.test',
  send: async (wiadomosc: { to: string; subject: string; text: string; html?: string }) => {
    wyslane.push(wiadomosc);
    return true;
  },
} as unknown as MailService;

let zestawienia: BillSummaryService;
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
  wyslane = [];
  // Nowy serwis na każdy test — licznik wysyłek żyje w jego pamięci.
  zestawienia = new BillSummaryService(prisma, poczta);
  await direct.tableSession.deleteMany({ where: { organizationId } });
});

afterAll(async () => {
  await direct.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

describe('treść zestawienia', () => {
  it('grupuje pozycje po uczestnikach i sumuje do rachunku', async () => {
    const { guestSessionId } = await wizyta();

    await zestawienia.send(organizationId, guestSessionId, 'ksiegowosc@firma.test');

    const [wiadomosc] = wyslane;
    expect(wiadomosc.to).toBe('ksiegowosc@firma.test');
    expect(wiadomosc.text).toContain('Wesoły Borsuk');
    expect(wiadomosc.text).toContain('2× Żurek — 40,00 PLN');
    expect(wiadomosc.text).toContain('Szybki Jeż');
    expect(wiadomosc.text).toContain('1× Pierogi ruskie — 30,00 PLN');
    // Suma z zestawienia musi zgadzać się z rachunkiem co do grosza — po to
    // gość je bierze.
    expect(wiadomosc.text).toContain('Razem: 70,00 PLN');
  });

  it('mówi wprost, że nie jest paragonem fiskalnym', async () => {
    const { guestSessionId } = await wizyta();

    await zestawienia.send(organizationId, guestSessionId, 'gosc@test.local');

    // Wymóg z docs/03 §3.6c. Bez tego zdania dokument wygląda jak paragon,
    // a nim nie jest — paragon wystawia kasa lokalu.
    expect(wyslane[0].text).toMatch(/nie jest paragonem fiskalnym/i);
  });

  it('niesie nazwę lokalu, stolik i numer rachunku', async () => {
    const { guestSessionId } = await wizyta();

    await zestawienia.send(organizationId, guestSessionId, 'gosc@test.local');

    expect(wyslane[0].text).toContain('Pod Delegacją');
    expect(wyslane[0].text).toContain('Stolik 12');
    expect(wyslane[0].subject).toContain('Pod Delegacją');
  });

  it('nie wysyła zestawienia z pustej wizyty', async () => {
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

    await expect(
      zestawienia.send(organizationId, guestSession.id, 'gosc@test.local'),
    ).rejects.toThrow(/żadnego zamówienia/);
    expect(wyslane).toHaveLength(0);
  });
});

describe('nazwy pochodzące od gościa', () => {
  it('trafiają do HTML-a po ucieczce', async () => {
    // Nick wpisuje gość, a szablon wstawia akapity surowo. Bez ucieczki byłby
    // to zastrzyk znaczników do poczty wychodzącej z naszego adresu.
    const { guestSessionId } = await wizyta({
      nick: '<script>alert(1)</script>',
      danie: 'Żurek <b>staropolski</b>',
    });

    await zestawienia.send(organizationId, guestSessionId, 'gosc@test.local');

    const html = wyslane[0].html ?? '';
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Żurek &lt;b&gt;staropolski&lt;/b&gt;');
  });
});

describe('limit wysyłek', () => {
  it('przepuszcza kilka poprawek adresu, ale nie robi z nas przekaźnika', async () => {
    const { guestSessionId } = await wizyta();

    for (let i = 0; i < 3; i += 1) {
      await zestawienia.send(organizationId, guestSessionId, `gosc${i}@test.local`);
    }

    await expect(
      zestawienia.send(organizationId, guestSessionId, 'jeszcze@test.local'),
    ).rejects.toThrow(/kilka razy/);
    expect(wyslane).toHaveLength(3);
  });

  it('liczy się osobno dla każdego gościa przy stoliku', async () => {
    // Limit na sesję gościa, nie na wizytę ani na adres IP: cały lokal wychodzi
    // jednym łączem, a każdy przy stoliku ma prawo do własnego zestawienia.
    const pierwszy = await wizyta();
    const drugi = await wizyta();

    for (let i = 0; i < 3; i += 1) {
      await zestawienia.send(organizationId, pierwszy.guestSessionId, 'a@test.local');
    }
    await expect(
      zestawienia.send(organizationId, drugi.guestSessionId, 'b@test.local'),
    ).resolves.toBeUndefined();
  });
});

describe('nieudana wysyłka', () => {
  it('nie mówi gościowi, że wysłała, i nie zabiera mu limitu', async () => {
    // Serwer poczty skonfigurowany, ale odmawia — na produkcji to awaria.
    process.env.SMTP_HOST = 'smtp.nieistnieje.test';
    const zepsuta = new BillSummaryService(prisma, {
      ...poczta,
      skonfigurowana: true,
      send: async () => false,
    } as unknown as MailService);

    try {
      const { guestSessionId } = await wizyta();

      // Cisza byłaby najgorszym wyjściem: gość czeka na coś, co nie przyjdzie,
      // i dowiaduje się o tym dopiero przy rozliczaniu delegacji.
      await expect(zepsuta.send(organizationId, guestSessionId, 'gosc@test.local')).rejects.toThrow(
        /Nie udało się wysłać/,
      );
    } finally {
      delete process.env.SMTP_HOST;
    }
  });

  it('milczy, gdy poczty w ogóle nie skonfigurowano', async () => {
    // Lokalnie i w testach SMTP nie istnieje i to normalny stan — ta sama
    // zasada, co w całej reszcie aplikacji. Awarią jest dopiero odmowa serwera,
    // który miał działać.
    const bezPoczty = new BillSummaryService(prisma, {
      ...poczta,
      skonfigurowana: false,
      send: async () => false,
    } as unknown as MailService);

    const { guestSessionId } = await wizyta();

    await expect(
      bezPoczty.send(organizationId, guestSessionId, 'gosc@test.local'),
    ).resolves.toBeUndefined();
  });
});
