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

/**
 * Kasuje restaurację testową razem ze wszystkim, co pod nią wisi.
 *
 * Płatności trzeba zdjąć pierwsze: `payment` trzyma wizytę kluczem RESTRICT,
 * więc kaskada z organizacji sama się o nie zatrzyma. Reszta idzie kaskadą.
 */
export async function dropTestOrganization(): Promise<void> {
  await withClient(async (client) => {
    const { rows } = await client.query<{ organization_id: string }>(
      'SELECT organization_id FROM restaurant WHERE slug = $1',
      [E2E_SLUG],
    );
    const organizationId = rows[0]?.organization_id;
    if (!organizationId) return;

    await client.query('DELETE FROM payment WHERE organization_id = $1', [organizationId]);
    await client.query('DELETE FROM organization WHERE id = $1', [organizationId]);
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

/**
 * Stolik i jedna pozycja karty na potrzeby ścieżki kelnera.
 *
 * Restauracja testowa startuje bez menu i bez stolików, a zamawianie potrzebuje
 * obu. Zwracany `cleanup` kasuje tylko to, co ten fixture dodał — reszta danych
 * testowych zostaje dla równolegle biegnących plików.
 */
export async function seedMenuAndTable(): Promise<{
  tableId: string;
  tableLabel: string;
  dishName: string;
  cleanup: () => Promise<void>;
}> {
  const tableLabel = `Stolik ${randomUUID().slice(0, 4)}`;
  const dishName = `Danie ${randomUUID().slice(0, 4)}`;

  return withClient(async (client) => {
    const { rows } = await client.query<{ id: string; organization_id: string }>(
      'SELECT id, organization_id FROM restaurant WHERE slug = $1',
      [E2E_SLUG],
    );
    const restaurant = rows[0];
    if (!restaurant) {
      throw new Error(`Brak restauracji testowej (${E2E_SLUG}) — global setup nie wykonał się.`);
    }

    const organizationId = restaurant.organization_id;
    const tableId = randomUUID();
    const categoryId = randomUUID();
    const dishId = randomUUID();

    await client.query(
      `INSERT INTO restaurant_table (id, organization_id, restaurant_id, label, qr_token, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [tableId, organizationId, restaurant.id, tableLabel, randomUUID().replace(/-/g, '')],
    );

    await client.query(
      `INSERT INTO menu_category (id, organization_id, restaurant_id, updated_at)
       VALUES ($1, $2, $3, now())`,
      [categoryId, organizationId, restaurant.id],
    );
    await client.query(
      `INSERT INTO menu_category_translation (id, organization_id, category_id, locale, name)
       VALUES ($1, $2, $3, 'pl', 'Karta testowa')`,
      [randomUUID(), organizationId, categoryId],
    );

    await client.query(
      `INSERT INTO menu_item (id, organization_id, restaurant_id, category_id, price_cents, currency, vat_rate, updated_at)
       VALUES ($1, $2, $3, $4, 2500, 'PLN', 0.0800, now())`,
      [dishId, organizationId, restaurant.id, categoryId],
    );
    await client.query(
      `INSERT INTO menu_item_translation (id, organization_id, menu_item_id, locale, name)
       VALUES ($1, $2, $3, 'pl', $4)`,
      [randomUUID(), organizationId, dishId, dishName],
    );

    return {
      tableId,
      tableLabel,
      dishName,
      cleanup: async () => {
        await withClient(async (inner) => {
          // Kolejność jest istotna i wynika z kluczy RESTRICT, nie z wygody:
          // `payment` trzyma wizytę, `table_session` trzyma stolik, `menu_item`
          // trzyma kategorię. Kasowanie od góry pada na każdym z nich po kolei.
          // Zamówienia, pozycje i grupy rozliczeniowe znikają kaskadą po wizycie.
          await inner.query(
            `DELETE FROM payment
              WHERE table_session_id IN (SELECT id FROM table_session WHERE table_id = $1)`,
            [tableId],
          );
          await inner.query('DELETE FROM table_session WHERE table_id = $1', [tableId]);
          await inner.query('DELETE FROM restaurant_table WHERE id = $1', [tableId]);
          await inner.query('DELETE FROM menu_item WHERE category_id = $1', [categoryId]);
          await inner.query('DELETE FROM menu_category WHERE id = $1', [categoryId]);
        });
      },
    };
  });
}

/**
 * Wizyta z dwoma gośćmi i rachunkiem — punkt wyjścia do testów podziału.
 *
 * Zakładana wprost w bazie, bo przejście całej ścieżki gościa (skan QR, wybór
 * nicku, koszyk) na potrzeby testu podziału kosztowałoby więcej niż wnosi.
 */
export async function seedSessionWithBill(options: {
  tableId: string;
  totalCents: number;
}): Promise<{ sessionId: string; guests: { id: string; name: string }[] }> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ id: string; organization_id: string }>(
      'SELECT id, organization_id FROM restaurant WHERE slug = $1',
      [E2E_SLUG],
    );
    const restaurant = rows[0];
    if (!restaurant) {
      throw new Error(`Brak restauracji testowej (${E2E_SLUG}).`);
    }

    const organizationId = restaurant.organization_id;
    const sessionId = randomUUID();
    const orderId = randomUUID();
    const guests = [
      { id: randomUUID(), name: 'Ala', symbol: 'star', color: 'red', isHost: true },
      { id: randomUUID(), name: 'Borys', symbol: 'heart', color: 'blue', isHost: false },
    ];

    await client.query(
      `INSERT INTO table_session
         (id, organization_id, restaurant_id, table_id, session_number, opened_by, currency,
          business_date, subtotal_cents, total_cents, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'guest', 'PLN', current_date, $6, $6, now())`,
      [sessionId, organizationId, restaurant.id, options.tableId, 7000 + Math.floor(Math.random() * 900), options.totalCents],
    );

    for (const guest of guests) {
      await client.query(
        `INSERT INTO table_participant
           (id, organization_id, table_session_id, display_name, symbol, color, is_host, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'guest')`,
        // Znak rozpoznawczy: para symbol + kolor jest unikalna przy stoliku.
        [
          guest.id,
          organizationId,
          sessionId,
          guest.name,
          guest.symbol,
          guest.color,
          guest.isHost,
        ],
      );
    }

    await client.query(
      `INSERT INTO "order"
         (id, organization_id, restaurant_id, table_id, table_session_id, order_number, source,
          status, payment_status, currency, business_date, subtotal_cents, total_cents, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'guest', 'confirmed', 'awaiting_settlement', 'PLN',
               current_date, $7, $7, now())`,
      [orderId, organizationId, restaurant.id, options.tableId, sessionId, 7000 + Math.floor(Math.random() * 900), options.totalCents],
    );

    await client.query(
      `INSERT INTO order_item
         (id, organization_id, order_id, name_snapshot, quantity, unit_price_cents, vat_rate, added_by)
       VALUES ($1, $2, $3, 'Rachunek testowy', 1, $4, 0.0800, 'guest')`,
      [randomUUID(), organizationId, orderId, options.totalCents],
    );

    return {
      sessionId,
      guests: guests.map((guest) => ({ id: guest.id, name: guest.name })),
    };
  });
}
