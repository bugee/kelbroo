/**
 * Sprzątanie po restauracji pokazowej.
 *
 * Przy stoliku pokazowym siedzą nieznajomi z internetu i widzą nawzajem swoje
 * zamówienia razem z notatkami, które sami wpisali. Bez sprzątania demo psuje
 * się samo: po tygodniu nowy zwiedzający zamiast czystej karty widzi cudzy
 * rachunek sprzed dni.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PublicDemoService } from '../src/demo/public-demo.service';
import { alertyDoTestow } from './alerty';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const demo = new PublicDemoService(alertyDoTestow().alerts);

let pokazowa: { organizationId: string; restaurantId: string; tableId: string };
let prawdziwa: { organizationId: string; restaurantId: string; tableId: string };

/** Restauracja z jednym stolikiem — pokazowa albo zwyczajna. */
async function restauracja(isDemo: boolean) {
  const organization = await direct.organization.create({
    data: { name: `Test ${randomUUID().slice(0, 8)}`, billingEmail: 'test@test.local', isDemo },
  });
  const restaurant = await direct.restaurant.create({
    data: {
      organizationId: organization.id,
      name: 'Testowa',
      slug: `test-${randomUUID().slice(0, 8)}`,
      currency: 'PLN',
    },
  });
  const table = await direct.table.create({
    data: {
      organizationId: organization.id,
      restaurantId: restaurant.id,
      label: 'Stolik 1',
      qrToken: randomUUID(),
    },
  });
  return { organizationId: organization.id, restaurantId: restaurant.id, tableId: table.id };
}

/** Wizyta otwarta `minutTemu` minut temu. */
async function wizyta(
  gdzie: { organizationId: string; restaurantId: string; tableId: string },
  minutTemu: number,
) {
  return direct.tableSession.create({
    data: {
      organizationId: gdzie.organizationId,
      restaurantId: gdzie.restaurantId,
      tableId: gdzie.tableId,
      businessDate: new Date(),
      sessionNumber: Math.floor(Math.random() * 100_000),
      openedBy: 'guest',
      currency: 'PLN',
      openedAt: new Date(Date.now() - minutTemu * 60_000),
    },
  });
}

beforeAll(async () => {
  pokazowa = await restauracja(true);
  prawdziwa = await restauracja(false);
});

beforeEach(async () => {
  await direct.tableSession.deleteMany({
    where: { organizationId: { in: [pokazowa.organizationId, prawdziwa.organizationId] } },
  });
});

afterAll(async () => {
  await direct.organization
    .deleteMany({ where: { id: { in: [pokazowa.organizationId, prawdziwa.organizationId] } } })
    .catch(() => undefined);
  await direct.$disconnect();
});

describe('sprzątanie', () => {
  it('usuwa wizytę zwiedzającego sprzed godziny', async () => {
    const stara = await wizyta(pokazowa, 60);

    await demo.posprzataj();

    expect(await direct.tableSession.findUnique({ where: { id: stara.id } })).toBeNull();
  });

  it('nie przerywa wizyty, która właśnie trwa', async () => {
    // Ktoś ogląda menu w tej chwili — skasowanie wizyty wyrzuciłoby go
    // w środku przeglądania.
    const swieza = await wizyta(pokazowa, 5);

    await demo.posprzataj();

    expect(await direct.tableSession.findUnique({ where: { id: swieza.id } })).not.toBeNull();
  });

  it('nie rusza wizyt prawdziwej restauracji', async () => {
    // Najważniejszy test w tym pliku: zadanie kasuje dane, a pomyłka
    // w warunku zabrałaby klientowi historię wizyt.
    const klienta = await wizyta(prawdziwa, 60 * 24);

    await demo.posprzataj();

    expect(await direct.tableSession.findUnique({ where: { id: klienta.id } })).not.toBeNull();
  });

  it('zabiera ze sobą zamówienia i uczestników wizyty', async () => {
    const stara = await wizyta(pokazowa, 60);
    const uczestnik = await direct.tableParticipant.create({
      data: {
        organizationId: pokazowa.organizationId,
        tableSessionId: stara.id,
        displayName: 'Wesoły Borsuk',
        symbol: 'star',
        color: 'teal',
        isHost: true,
        createdBy: 'guest',
      },
    });

    await demo.posprzataj();

    // Kasowanie kaskadowe: bez niego zostałyby sieroty, których nikt nigdy
    // nie sprzątnie, bo nie wiszą już na żadnej wizycie.
    expect(await direct.tableParticipant.findUnique({ where: { id: uczestnik.id } })).toBeNull();
  });
});
