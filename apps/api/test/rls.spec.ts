/**
 * Izolacja tenantów wymuszona przez PostgreSQL Row-Level Security.
 *
 * To nie jest test jednostkowy logiki aplikacji — to dowód, że druga linia
 * obrony z docs/architecture.md §8 faktycznie działa w bazie. Bez niego cała
 * warstwa multi-tenancy jest wyłącznie deklaracją.
 *
 * Wymaga działającej bazy: pnpm infra:up && pnpm db:migrate
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

/** Rola superusera — zakłada dane testowe, omija RLS. */
const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
/** Rola aplikacyjna — podlega RLS, tak jak API w czasie działania. */
const app = new PrismaService();

interface Fixture {
  organizationId: string;
  restaurantId: string;
  orderId: string;
  orderEventId: string;
}

async function createTenant(label: string): Promise<Fixture> {
  const organization = await direct.organization.create({
    data: { name: `RLS ${label} ${randomUUID()}`, billingEmail: `${label}@rls.test` },
  });
  const restaurant = await direct.restaurant.create({
    data: {
      organizationId: organization.id,
      name: `Lokal ${label}`,
      slug: `rls-${label}-${randomUUID()}`,
      currency: 'PLN',
    },
  });
  const table = await direct.table.create({
    data: {
      organizationId: organization.id,
      restaurantId: restaurant.id,
      label: 'Stolik 1',
      qrToken: randomBytes(16).toString('base64url'),
    },
  });
  const session = await direct.tableSession.create({
    data: {
      organizationId: organization.id,
      restaurantId: restaurant.id,
      tableId: table.id,
      businessDate: new Date('2026-08-22'),
      sessionNumber: 1,
      openedBy: 'guest',
      currency: 'PLN',
    },
  });
  const order = await direct.order.create({
    data: {
      organizationId: organization.id,
      restaurantId: restaurant.id,
      tableId: table.id,
      tableSessionId: session.id,
      businessDate: new Date('2026-08-22'),
      orderNumber: 1,
      source: 'guest',
      status: 'submitted',
      paymentStatus: 'awaiting_settlement',
      currency: 'PLN',
    },
  });
  const event = await direct.orderEvent.create({
    data: {
      organizationId: organization.id,
      orderId: order.id,
      type: 'created',
      actorType: 'guest',
    },
  });

  return {
    organizationId: organization.id,
    restaurantId: restaurant.id,
    orderId: order.id,
    orderEventId: event.id,
  };
}

let alpha: Fixture;
let beta: Fixture;

beforeAll(async () => {
  [alpha, beta] = await Promise.all([createTenant('alpha'), createTenant('beta')]);
});

afterAll(async () => {
  await direct.organization.deleteMany({
    where: {
      id: { in: [alpha?.organizationId, beta?.organizationId].filter(Boolean) as string[] },
    },
  });
  await Promise.all([direct.$disconnect(), app.$disconnect()]);
});

describe('izolacja tenantów (RLS)', () => {
  it('bez kontekstu tenanta rola aplikacyjna nie widzi ani jednego wiersza', async () => {
    // Zapytanie poza withTenant() — dokładnie ten przypadek, w którym błąd
    // w kodzie mógłby ujawnić cudze dane.
    await expect(app.restaurant.count()).resolves.toBe(0);
    await expect(app.order.count()).resolves.toBe(0);
    await expect(app.organization.count()).resolves.toBe(0);
  });

  it('w kontekście tenanta widać wyłącznie jego dane', async () => {
    const seen = await app.withTenant(alpha.organizationId, (tx) =>
      tx.restaurant.findMany({ select: { id: true, organizationId: true } }),
    );

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((r) => r.organizationId === alpha.organizationId)).toBe(true);
    expect(seen.map((r) => r.id)).toContain(alpha.restaurantId);
    expect(seen.map((r) => r.id)).not.toContain(beta.restaurantId);
  });

  it('dane innego tenanta są niewidoczne nawet przy zapytaniu po znanym ID', async () => {
    const stolen = await app.withTenant(alpha.organizationId, (tx) =>
      tx.restaurant.findUnique({ where: { id: beta.restaurantId } }),
    );
    expect(stolen).toBeNull();

    const stolenOrder = await app.withTenant(alpha.organizationId, (tx) =>
      tx.order.findUnique({ where: { id: beta.orderId } }),
    );
    expect(stolenOrder).toBeNull();
  });

  it('nie da się zapisać wiersza pod cudzym organization_id', async () => {
    await expect(
      app.withTenant(alpha.organizationId, (tx) =>
        tx.restaurant.create({
          data: {
            organizationId: beta.organizationId,
            name: 'Podszywka',
            slug: `rls-podszywka-${randomUUID()}`,
            currency: 'PLN',
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('nie da się zmodyfikować cudzego wiersza', async () => {
    const result = await app.withTenant(alpha.organizationId, (tx) =>
      tx.restaurant.updateMany({
        where: { id: beta.restaurantId },
        data: { name: 'Przejęte' },
      }),
    );
    expect(result.count).toBe(0);

    const untouched = await direct.restaurant.findUnique({ where: { id: beta.restaurantId } });
    expect(untouched?.name).toBe('Lokal beta');
  });

  it('withTenant odrzuca identyfikator, który nie jest UUID', async () => {
    await expect(
      app.withTenant("' OR '1'='1", async (tx) => tx.restaurant.count()),
    ).rejects.toThrow(/UUID/);
  });
});

describe('kompletność ochrony', () => {
  /**
   * Tabele zaplecza kelbroo. Mają `organization_id`, bo notują, kogo dotyczyła
   * operacja — ale **nie są danymi najemcy** i rola aplikacyjna nie ma do nich
   * żadnych uprawnień. RLS byłby tam pustym gestem: chroni przed rolą, która
   * i tak nie może ich dotknąć.
   *
   * Wyjątek jest wąski i pilnowany testem niżej: gdyby ktoś nadał tej roli
   * uprawnienia, brak RLS przestałby być bezpieczny i test to wykryje.
   */
  const POZA_NAJEMCAMI = ['platform_audit_log'];

  it('każda tabela z organization_id ma włączony RLS', async () => {
    // Prisma generuje wyłącznie DDL schematu — polityki bezpieczeństwa trzeba
    // dopisać ręcznie w migracji. Ten test wyłapuje moment, w którym ktoś
    // doda nową tabelę tenanta i o tym zapomni.
    const unprotected = await direct.$queryRaw<{ relname: string }[]>`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
       AND a.attname = 'organization_id'
       AND a.attnum > 0
       AND NOT a.attisdropped
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND NOT c.relrowsecurity
      ORDER BY c.relname
    `;

    expect(
      unprotected.map((row) => row.relname).filter((n) => !POZA_NAJEMCAMI.includes(n)),
    ).toEqual([]);
  });

  it('tabele zaplecza są nieosiągalne dla roli aplikacyjnej', async () => {
    // To jest cena wyjątku powyżej: skoro nie chroni ich RLS, muszą być
    // odcięte uprawnieniami. Dotyczy też `platform_admin`, gdzie leżą skróty
    // haseł do zaplecza całej platformy.
    for (const tabela of [...POZA_NAJEMCAMI, 'platform_admin']) {
      const [{ ma }] = await direct.$queryRawUnsafe<{ ma: boolean }[]>(
        `SELECT bool_or(privilege_type IS NOT NULL) AS ma
           FROM information_schema.table_privileges
          WHERE table_schema = 'public' AND table_name = $1 AND grantee = 'kelbroo_app'`,
        tabela,
      );
      expect(ma, `rola aplikacyjna ma uprawnienia do ${tabela}`).not.toBe(true);
    }
  });

  it('każda tabela z włączonym RLS ma politykę izolacji', async () => {
    // Sam ENABLE ROW LEVEL SECURITY bez polityki blokuje wszystko — to też
    // jest błąd, tyle że objawia się pustymi ekranami zamiast wyciekiem.
    const withoutPolicy = await direct.$queryRaw<{ relname: string }[]>`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relrowsecurity
        AND NOT EXISTS (
          SELECT 1 FROM pg_policies p
          WHERE p.schemaname = 'public'
            AND p.tablename = c.relname
            AND p.policyname = 'tenant_isolation'
        )
      ORDER BY c.relname
    `;

    expect(withoutPolicy.map((row) => row.relname)).toEqual([]);
  });

  it('tabela organization też jest objęta izolacją', async () => {
    const rows = await direct.$queryRaw<{ relrowsecurity: boolean }[]>`
      SELECT c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'organization'
    `;
    expect(rows[0]?.relrowsecurity).toBe(true);
  });
});

describe('OrderEvent jest append-only na poziomie uprawnień', () => {
  it('rola aplikacyjna może dopisać zdarzenie', async () => {
    const created = await app.withTenant(alpha.organizationId, (tx) =>
      tx.orderEvent.create({
        data: {
          organizationId: alpha.organizationId,
          orderId: alpha.orderId,
          type: 'status_changed',
          actorType: 'staff',
        },
      }),
    );
    expect(created.id).toBeTruthy();
  });

  it('rola aplikacyjna nie może zmienić ani usunąć zdarzenia', async () => {
    await expect(
      app.withTenant(alpha.organizationId, (tx) =>
        tx.orderEvent.update({
          where: { id: alpha.orderEventId },
          data: { reason: 'próba nadpisania historii' },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      app.withTenant(alpha.organizationId, (tx) =>
        tx.orderEvent.delete({ where: { id: alpha.orderEventId } }),
      ),
    ).rejects.toThrow();

    const survived = await direct.orderEvent.findUnique({ where: { id: alpha.orderEventId } });
    expect(survived).not.toBeNull();
    expect(survived?.reason).toBeNull();
  });
});
