/**
 * Limit pozycji w karcie.
 *
 * Limit liczy **kartę, nie bazę**: wycofane danie zostaje w bazie na zawsze,
 * bo wisi na nim historyczny rachunek, ale w karcie go nie ma i nie ma powodu,
 * żeby zajmowało miejsce w planie. Bez tego rozróżnienia lokal po roku pracy
 * uderzałby w limit, nie mając w menu ani jednej pozycji więcej.
 *
 * Druga rzecz: limit siedzi **na wierszu abonamentu**, nie w kodzie planu.
 * Dzięki temu zaplecze podnosi go pojedynczemu klientowi bez zmiany cennika
 * i bez wdrożenia.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { MenuAdminService } from '../src/management/menu.admin.service';
import type { StaffContext } from '../src/auth/auth.types';

const direct = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL });
const prisma = new PrismaService();
const menuAdmin = new MenuAdminService(prisma);

let organizationId: string;
let categoryId: string;
let staff: StaffContext;

const danie = (name: string) =>
  menuAdmin.createItem(staff, {
    categoryId,
    priceCents: 2500,
    vatPercent: 8,
    translations: [{ locale: 'pl', name }],
  });

const ustawLimit = (menuItemLimit: number) =>
  direct.subscription.update({ where: { organizationId }, data: { menuItemLimit } });

beforeAll(async () => {
  const organization = await direct.organization.create({
    data: { name: `Limit karty ${randomUUID().slice(0, 8)}`, billingEmail: 'limit@test.local' },
  });
  organizationId = organization.id;

  await direct.subscription.create({
    data: { organizationId, plan: 'menu', status: 'active', tableLimit: 9999, languageLimit: 1 },
  });

  const restaurant = await direct.restaurant.create({
    data: {
      organizationId,
      name: 'Krótka karta',
      slug: `limit-${randomUUID()}`,
      currency: 'PLN',
      defaultLocale: 'pl',
      supportedLocales: ['pl'],
    },
  });

  const member = await direct.staffMember.create({
    data: {
      organizationId,
      restaurantId: restaurant.id,
      email: `mgr-${randomUUID()}@test.local`,
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
    translations: [{ locale: 'pl', name: 'Dania' }],
  });
  categoryId = category.id;
});

beforeEach(async () => {
  await direct.menuItem.deleteMany({ where: { organizationId } });
});

afterAll(async () => {
  await direct.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  await Promise.all([direct.$disconnect(), prisma.$disconnect()]);
});

describe('limit pozycji w karcie', () => {
  it('przepuszcza aż do limitu i zatrzymuje na kolejnej', async () => {
    await ustawLimit(2);

    await danie('Rosół');
    await danie('Schabowy');

    await expect(danie('Sernik')).rejects.toThrow(/2 pozycji w karcie/);
    expect(await direct.menuItem.count({ where: { organizationId } })).toBe(2);
  });

  it('nie liczy pozycji wycofanych', async () => {
    await ustawLimit(2);

    const rosol = await danie('Rosół');
    await danie('Schabowy');
    await menuAdmin.archiveItem(staff, rosol.id, true);

    // Wycofane danie zostaje w bazie — rachunek sprzed tygodnia wciąż się do
    // niego odwołuje — ale zwalnia miejsce w karcie.
    await expect(danie('Sernik')).resolves.toBeTruthy();
  });

  it('honoruje wyjątek podniesiony z zaplecza', async () => {
    await ustawLimit(2);
    await danie('Rosół');
    await danie('Schabowy');
    await expect(danie('Sernik')).rejects.toThrow();

    await ustawLimit(3);

    await expect(danie('Sernik')).resolves.toBeTruthy();
  });
});
