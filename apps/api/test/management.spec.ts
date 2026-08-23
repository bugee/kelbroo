/**
 * Konfiguracja lokalu: menu, stoliki i ustawienia.
 *
 * Testy budują własną restaurację i sprawdzają reguły, których złamanie widać
 * dopiero u gościa albo dopiero po miesiącu w raportach.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { MenuService } from '../src/menu/menu.service';
import { MenuAdminService } from '../src/management/menu.admin.service';
import { TablesAdminService } from '../src/management/tables.admin.service';
import { RestaurantAdminService } from '../src/management/restaurant.admin.service';
import { DailyCounterService } from '../src/common/daily-counter.service';
import { GuestSessionService } from '../src/guest/guest-session.service';
import type { GuestGateway } from '../src/realtime/guest.gateway';
import type { StaffSignalsGateway } from '../src/realtime/staff-signals.gateway';
import { TableService } from '../src/table/table.service';
import type { StaffContext } from '../src/auth/auth.types';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();

const menuService = new MenuService();
const menuAdmin = new MenuAdminService(prisma);
const tablesAdmin = new TablesAdminService(prisma);
const restaurantAdmin = new RestaurantAdminService(prisma);
const tableService = new TableService(
  prisma,
  menuService,
  new DailyCounterService(),
  new GuestSessionService(prisma),
  { publish: () => undefined } as unknown as GuestGateway,
  { publishGuestWaiting: () => undefined } as unknown as StaffSignalsGateway,
);

let staff: StaffContext;
let organizationId: string;
let categoryId: string;

const pl = (name: string) => ({ locale: 'pl', name });
const en = (name: string) => ({ locale: 'en', name });

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Mgmt ${randomUUID()}`, billingEmail: 'mgmt@rls.test' },
  });
  organizationId = organization.id;

  await direct.subscription.create({
    data: { organizationId, plan: 'starter', status: 'active', tableLimit: 2, languageLimit: 2 },
  });

  const restaurant = await direct.restaurant.create({
    data: {
      organizationId,
      name: 'Testowa',
      slug: `mgmt-${randomUUID()}`,
      currency: 'PLN',
      defaultLocale: 'pl',
      supportedLocales: ['pl', 'en'],
    },
  });

  const member = await direct.staffMember.create({
    data: {
      organizationId,
      restaurantId: restaurant.id,
      email: `mgr-${randomUUID()}@rls.test`,
      passwordHash: 'x',
      role: 'manager',
      name: 'Manager',
    },
  });

  staff = {
    staffId: member.id,
    organizationId,
    restaurantId: restaurant.id,
    role: 'manager',
    name: 'Manager',
  };

  const category = await menuAdmin.createCategory(staff, {
    translations: [pl('Dania'), en('Dishes')],
  });
  categoryId = category.id;
});

afterAll(async () => {
  if (organizationId) await direct.organization.delete({ where: { id: organizationId } });
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

describe('tłumaczenia menu', () => {
  it('wymaga tłumaczenia w języku domyślnym lokalu', async () => {
    await expect(
      menuAdmin.createItem(staff, {
        categoryId,
        priceCents: 1000,
        vatPercent: 8,
        translations: [en('English only')],
      }),
    ).rejects.toThrow(/domyślnym/);
  });

  it('odrzuca język spoza obsługiwanych przez lokal', async () => {
    await expect(
      menuAdmin.createItem(staff, {
        categoryId,
        priceCents: 1000,
        vatPercent: 8,
        translations: [pl('Zupa'), { locale: 'de', name: 'Suppe' }],
      }),
    ).rejects.toThrow(/nie obsługuje języka/);
  });

  it('odrzuca zduplikowany język', async () => {
    await expect(
      menuAdmin.createItem(staff, {
        categoryId,
        priceCents: 1000,
        vatPercent: 8,
        translations: [pl('Zupa'), pl('Zupa jeszcze raz')],
      }),
    ).rejects.toThrow(/Zduplikowany/);
  });
});

describe('edycja dania', () => {
  it('PATCH bez modifierGroups nie kasuje modyfikatorów', async () => {
    const created = await menuAdmin.createItem(staff, {
      categoryId,
      priceCents: 4000,
      vatPercent: 8,
      translations: [pl('Stek'), en('Steak')],
      modifierGroups: [
        {
          minSelect: 0,
          maxSelect: 1,
          translations: [pl('Sos'), en('Sauce')],
          modifiers: [{ priceDeltaCents: 500, translations: [pl('Pieprzowy'), en('Pepper')] }],
        },
      ],
    });

    await menuAdmin.updateItem(staff, created.id, {
      categoryId,
      priceCents: 4500,
      vatPercent: 8,
      translations: [pl('Stek'), en('Steak')],
    });

    const groups = await direct.menuItemModifierGroup.count({ where: { menuItemId: created.id } });
    expect(groups).toBe(1);
  });

  it('pusta tablica modifierGroups usuwa modyfikatory', async () => {
    const created = await menuAdmin.createItem(staff, {
      categoryId,
      priceCents: 4000,
      vatPercent: 8,
      translations: [pl('Burger'), en('Burger')],
      modifierGroups: [
        {
          minSelect: 0,
          maxSelect: 1,
          translations: [pl('Dodatek'), en('Extra')],
          modifiers: [{ priceDeltaCents: 300, translations: [pl('Ser'), en('Cheese')] }],
        },
      ],
    });

    await menuAdmin.updateItem(staff, created.id, {
      categoryId,
      priceCents: 4000,
      vatPercent: 8,
      translations: [pl('Burger'), en('Burger')],
      modifierGroups: [],
    });

    const groups = await direct.menuItemModifierGroup.count({ where: { menuItemId: created.id } });
    expect(groups).toBe(0);
  });

  it('zapisuje zmianę ceny w dzienniku audytu', async () => {
    const created = await menuAdmin.createItem(staff, {
      categoryId,
      priceCents: 2000,
      vatPercent: 8,
      translations: [pl('Sałatka'), en('Salad')],
    });

    await menuAdmin.updateItem(staff, created.id, {
      categoryId,
      priceCents: 2400,
      vatPercent: 8,
      translations: [pl('Sałatka'), en('Salad')],
    });

    const entry = await direct.auditLog.findFirst({
      where: { entityId: created.id, action: 'menu_item.price_changed' },
    });
    expect(entry?.payload).toMatchObject({ from: 2000, to: 2400 });
  });

  it('odrzuca grupę wymagającą więcej wyborów, niż ma opcji', async () => {
    await expect(
      menuAdmin.createItem(staff, {
        categoryId,
        priceCents: 1000,
        vatPercent: 8,
        translations: [pl('Zestaw'), en('Set')],
        modifierGroups: [
          {
            minSelect: 3,
            maxSelect: 3,
            isRequired: true,
            translations: [pl('Wybór'), en('Choice')],
            modifiers: [{ priceDeltaCents: 0, translations: [pl('A'), en('A')] }],
          },
        ],
      }),
    ).rejects.toThrow(/więcej wyborów/);
  });
});

describe('archiwizacja', () => {
  it('wycofane danie znika z karty gościa, ale zostaje w panelu', async () => {
    const table = await tablesAdmin.create(staff, { label: `Arch ${randomUUID().slice(0, 6)}` });
    const created = await menuAdmin.createItem(staff, {
      categoryId,
      priceCents: 1900,
      vatPercent: 8,
      translations: [pl('Wycofane danie'), en('Retired dish')],
    });

    const before = await tableService.enter(table.qrToken, { requestedLocale: 'pl' });
    expect(before.menu.flatMap((c) => c.items).map((i) => i.name)).toContain('Wycofane danie');

    await menuAdmin.archiveItem(staff, created.id, true);

    const after = await tableService.enter(table.qrToken, { requestedLocale: 'pl' });
    expect(after.menu.flatMap((c) => c.items).map((i) => i.name)).not.toContain('Wycofane danie');

    const adminView = await menuAdmin.fullMenu(staff);
    const stillThere = adminView.categories
      .flatMap((c) => c.items)
      .find((item) => item.id === created.id);
    expect(stillThere?.isArchived).toBe(true);
  });
});

describe('stoliki', () => {
  it('regeneracja QR unieważnia poprzedni token', async () => {
    const table = await tablesAdmin.create(staff, { label: `QR ${randomUUID().slice(0, 6)}` });
    const oldToken = table.qrToken;

    const regenerated = await tablesAdmin.regenerateQr(staff, table.id);

    expect(regenerated.qrToken).not.toBe(oldToken);
    expect(regenerated.qrVersion).toBe(2);
    await expect(tableService.enter(oldToken, {})).rejects.toThrow();
    await expect(tableService.enter(regenerated.qrToken, {})).resolves.toBeTruthy();
  });

  it('pilnuje limitu stolików z planu', async () => {
    const { activeCount, tableLimit } = await tablesAdmin.list(staff);
    // Plan testowy ma limit 2 — wcześniejsze testy już go wyczerpały.
    expect(activeCount).toBeGreaterThanOrEqual(tableLimit);

    await expect(
      tablesAdmin.create(staff, { label: `Ponad limit ${randomUUID()}` }),
    ).rejects.toThrow(/obejmuje 2 stolik/);
  });

  it('nie pozwala wyłączyć stolika z otwartym rachunkiem', async () => {
    const busy = await direct.table.findFirst({ where: { restaurantId: staff.restaurantId! } });
    await tableService.enter(busy!.qrToken, {});

    await expect(tablesAdmin.setActive(staff, busy!.id, false)).rejects.toThrow(/otwarty rachunek/);
  });
});

describe('ustawienia lokalu', () => {
  it('nie pozwala ustawić języka domyślnego spoza obsługiwanych', async () => {
    await expect(restaurantAdmin.update(staff, { defaultLocale: 'de' })).rejects.toThrow(
      /fallbackiem/,
    );
  });

  it('pilnuje limitu języków z planu', async () => {
    await expect(
      restaurantAdmin.update(staff, { supportedLocales: ['pl', 'en', 'de', 'cs'] }),
    ).rejects.toThrow(/2 język/);
  });

  it('odrzuca tryb prepaid, dopóki nie ma płatności online', async () => {
    await expect(restaurantAdmin.update(staff, { orderingMode: 'prepaid' })).rejects.toThrow(
      /Płatności online/,
    );
  });

  it('zgłasza języki osierocone przez zmianę listy', async () => {
    const result = await restaurantAdmin.update(staff, { supportedLocales: ['pl'] });
    expect(result.removedLocales).toEqual(['en']);
  });
});
