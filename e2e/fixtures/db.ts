/**
 * Dane testowe zakładane bezpośrednio w bazie.
 *
 * Celowo przez SQL, a nie przez Prismę: wygenerowany klient mieszka w
 * `node_modules` pakietu `@kelbroo/api` i wciągnięcie go tutaj wiązałoby
 * testy end-to-end z tym, jak pnpm rozwiązał zależności równorzędne.
 * Zapytania są proste, a hasła i tak trzeba haszować bcryptem.
 */
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';

loadEnv({ path: path.resolve(__dirname, '../../.env'), quiet: true });

/** Rola omijająca RLS — dane testowe zakładamy jak seed, nie jak aplikacja. */
const connectionString = process.env.DIRECT_DATABASE_URL;

/** Wszystko, co należy do testów, wisi pod tą jedną restauracją. */
export const E2E_SLUG = 'e2e-kelbroo';

export type StaffRole = 'owner' | 'manager' | 'waiter' | 'kitchen';

export interface Account {
  email: string;
  password: string;
  role: StaffRole;
  name: string;
}

async function withClient<T>(run: (client: Client) => Promise<T>): Promise<T> {
  if (!connectionString) {
    throw new Error(
      'Brak DIRECT_DATABASE_URL — testy e2e zakładają dane rolą omijającą RLS. Skopiuj .env.example do .env.',
    );
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** Kasuje restaurację testową razem ze wszystkim, co pod nią wisi (kaskada z organizacji). */
export async function dropTestOrganization(): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `DELETE FROM organization
        WHERE id IN (SELECT organization_id FROM restaurant WHERE slug = $1)`,
      [E2E_SLUG],
    );
  });
}

/**
 * Zakłada organizację, restaurację i podane konta. Zwraca id restauracji,
 * żeby testy mogły dokładać do niej własne konta.
 */
export async function createTestOrganization(accounts: Account[]): Promise<{
  organizationId: string;
  restaurantId: string;
}> {
  return withClient(async (client) => {
    const organizationId = randomUUID();
    const restaurantId = randomUUID();

    await client.query(
      `INSERT INTO organization (id, name, billing_email, updated_at)
       VALUES ($1, 'kelbroo e2e', 'e2e@kelbroo.test', now())`,
      [organizationId],
    );

    await client.query(
      `INSERT INTO subscription (id, organization_id, plan, status, table_limit, language_limit, updated_at)
       VALUES ($1, $2, 'pro', 'active', 40, 4, now())`,
      [randomUUID(), organizationId],
    );

    await client.query(
      `INSERT INTO restaurant (id, organization_id, name, slug, currency, default_locale, supported_locales, updated_at)
       VALUES ($1, $2, 'Restauracja testowa', $3, 'PLN', 'pl', ARRAY['pl','en'], now())`,
      [restaurantId, organizationId, E2E_SLUG],
    );

    for (const account of accounts) {
      await insertStaff(client, { organizationId, restaurantId }, account);
    }

    return { organizationId, restaurantId };
  });
}

/**
 * Dokłada konto do restauracji testowej. Testy, które zmieniają hasło,
 * zakładają własne konto, żeby nie zależeć od kolejności ani od siebie nawzajem.
 */
export async function createStaffAccount(
  account: Account & { mustChangePassword?: boolean },
): Promise<Account> {
  await withClient(async (client) => {
    const { rows } = await client.query<{ id: string; organization_id: string }>(
      'SELECT id, organization_id FROM restaurant WHERE slug = $1',
      [E2E_SLUG],
    );
    const restaurant = rows[0];
    if (!restaurant) {
      throw new Error(`Brak restauracji testowej (${E2E_SLUG}) — global setup nie wykonał się.`);
    }
    await insertStaff(
      client,
      { organizationId: restaurant.organization_id, restaurantId: restaurant.id },
      account,
    );
  });
  return account;
}

export async function deleteStaffAccount(email: string): Promise<void> {
  await withClient(async (client) => {
    await client.query('DELETE FROM staff_member WHERE email = $1', [email]);
  });
}

/** Unikalny adres na jeden test — pozwala puszczać pliki równolegle. */
export const uniqueEmail = (prefix: string): string =>
  `${prefix}-${randomUUID().slice(0, 8)}@e2e.test`;

async function insertStaff(
  client: Client,
  scope: { organizationId: string; restaurantId: string },
  account: Account & { mustChangePassword?: boolean },
): Promise<void> {
  await client.query(
    `INSERT INTO staff_member
       (id, organization_id, restaurant_id, email, password_hash, role, name, must_change_password, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::"StaffRole", $7, $8, now())`,
    [
      randomUUID(),
      scope.organizationId,
      scope.restaurantId,
      // Logowanie szuka konta po `lower(trim())`, a porównuje dosłownie —
      // adres zapisany wielkimi literami byłby kontem nie do zalogowania.
      account.email.toLowerCase().trim(),
      await bcrypt.hash(account.password, 10),
      account.role,
      account.name,
      account.mustChangePassword ?? false,
    ],
  );
}
