/**
 * Seed środowiska lokalnego: jedna demo-restauracja w trybie `pay_at_table`
 * (MVP etap 1) z menu w dwóch językach, kompletem ról i ośmioma stolikami.
 *
 * Uruchamiany rolą DIRECT_DATABASE_URL (superuser) — omija RLS.
 * Uruchomienie: pnpm db:seed
 */
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { CURRENCY, MENU, VAT_FOOD } from './demo-menu';

loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const datasourceUrl = process.env.DIRECT_DATABASE_URL;
if (!datasourceUrl) {
  throw new Error('Brak DIRECT_DATABASE_URL — seed musi działać rolą omijającą RLS.');
}

const prisma = new PrismaClient({ datasourceUrl });

/** Token QR: 128-bit, losowy, niezgadywalny — nigdy sekwencyjne ID stolika. */
const qrToken = () => randomBytes(16).toString('base64url');

const OWNER_EMAIL = 'owner@demo.kelbroo.pl';

const STAFF: { email: string; name: string; role: 'owner' | 'manager' | 'waiter' | 'kitchen' }[] = [
  { email: OWNER_EMAIL, name: 'Ewa Nowak', role: 'owner' },
  { email: 'manager@demo.kelbroo.pl', name: 'Piotr Zieliński', role: 'manager' },
  { email: 'kelner@demo.kelbroo.pl', name: 'Anna Wójcik', role: 'waiter' },
  { email: 'kuchnia@demo.kelbroo.pl', name: 'Marek Lewandowski', role: 'kitchen' },
];

const DEMO_PASSWORD = 'kelbroo123';

async function main() {
  const existing = await prisma.restaurant.findUnique({ where: { slug: 'bistro-widok' } });
  if (existing) {
    console.log('Demo-restauracja już istnieje — pomijam seed. Wyczyść bazę: pnpm db:reset');
    return;
  }

  const organization = await prisma.organization.create({
    data: {
      name: 'Bistro Widok sp. z o.o.',
      // Poprawny NIP: dane demo przechodzą tę samą sumę kontrolną, co rejestracja
      // i checkout. Wcześniejszy numer jej nie przechodził, więc zakup abonamentu
      // na koncie demo kończył się błędem walidacji.
      nip: '5252445394',
      billingEmail: 'ksiegowosc@demo.kelbroo.pl',
      subscription: {
        create: {
          plan: 'starter',
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          tableLimit: 20,
          languageLimit: 2,
        },
      },
    },
  });

  const restaurant = await prisma.restaurant.create({
    data: {
      organizationId: organization.id,
      name: 'Bistro Widok',
      slug: 'bistro-widok',
      address: 'ul. Próżna 12, 00-107 Warszawa',
      currency: CURRENCY,
      defaultLocale: 'pl',
      supportedLocales: ['pl', 'en'],
      // MVP etap 1: płatność wyłącznie u kelnera, potwierdzenie obsługi włączone.
      orderingMode: 'pay_at_table',
      requireStaffConfirmation: true,
      tableActivationRequired: false,
      fiscalizationMode: 'none',
      minOrderCents: 0,
      openBillLimitCents: 30000,
    },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await prisma.staffMember.createMany({
    data: STAFF.map((member) => ({
      organizationId: organization.id,
      restaurantId: restaurant.id,
      email: member.email,
      name: member.name,
      role: member.role,
      passwordHash,
      mustChangePassword: false,
      // Konta demonstracyjne są potwierdzone: nikt nie odbierze wiadomości
      // wysłanej na `@bistrowidok.pl`, a seed ma dawać działający panel.
      emailVerifiedAt: new Date(),
    })),
  });

  const tables = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      prisma.table.create({
        data: {
          organizationId: organization.id,
          restaurantId: restaurant.id,
          label: `Stolik ${index + 1}`,
          zone: index < 6 ? 'Sala' : 'Taras',
          seats: index < 4 ? 2 : 4,
          qrToken: qrToken(),
        },
      }),
    ),
  );

  for (const [categoryIndex, category] of MENU.entries()) {
    const created = await prisma.menuCategory.create({
      data: {
        organizationId: organization.id,
        restaurantId: restaurant.id,
        sortOrder: categoryIndex,
        translations: {
          create: [
            { organizationId: organization.id, locale: 'pl', name: category.pl },
            { organizationId: organization.id, locale: 'en', name: category.en },
          ],
        },
      },
    });

    for (const [itemIndex, item] of category.items.entries()) {
      await prisma.menuItem.create({
        data: {
          organizationId: organization.id,
          restaurantId: restaurant.id,
          categoryId: created.id,
          priceCents: item.priceCents,
          currency: CURRENCY,
          vatRate: item.vatRate ?? VAT_FOOD,
          sortOrder: itemIndex,
          allergens: item.allergens ?? [],
          dietaryTags: item.dietaryTags ?? [],
          prepTimeMinutes: item.prepTimeMinutes,
          isFeatured: item.isFeatured ?? false,
          translations: {
            create: [
              { organizationId: organization.id, locale: 'pl', ...item.pl },
              { organizationId: organization.id, locale: 'en', ...item.en },
            ],
          },
        },
      });
    }
  }

  // Jeden przykład grupy modyfikatorów — dodatek do dania głównego.
  const risotto = await prisma.menuItem.findFirst({
    where: {
      restaurantId: restaurant.id,
      translations: { some: { name: 'Risotto z borowikami' } },
    },
  });
  if (risotto) {
    const group = await prisma.menuItemModifierGroup.create({
      data: {
        organizationId: organization.id,
        menuItemId: risotto.id,
        minSelect: 0,
        maxSelect: 2,
        isRequired: false,
        translations: {
          create: [
            { organizationId: organization.id, locale: 'pl', name: 'Dodatki' },
            { organizationId: organization.id, locale: 'en', name: 'Extras' },
          ],
        },
      },
    });
    await prisma.menuItemModifier.create({
      data: {
        organizationId: organization.id,
        groupId: group.id,
        priceDeltaCents: 900,
        sortOrder: 0,
        translations: {
          create: [
            { organizationId: organization.id, locale: 'pl', name: 'Dodatkowy parmezan' },
            { organizationId: organization.id, locale: 'en', name: 'Extra parmesan' },
          ],
        },
      },
    });
    await prisma.menuItemModifier.create({
      data: {
        organizationId: organization.id,
        groupId: group.id,
        priceDeltaCents: 1400,
        sortOrder: 1,
        translations: {
          create: [
            { organizationId: organization.id, locale: 'pl', name: 'Trufla' },
            { organizationId: organization.id, locale: 'en', name: 'Truffle' },
          ],
        },
      },
    });
  }

  console.log(`Restauracja: ${restaurant.name} (${restaurant.slug})`);
  console.log(`Logowanie do panelu: ${OWNER_EMAIL} / ${DEMO_PASSWORD}`);
  console.log('Kody QR stolików:');
  for (const table of tables) {
    console.log(`  ${table.label.padEnd(12)} /t/${table.qrToken}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
