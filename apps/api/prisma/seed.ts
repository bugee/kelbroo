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
import { PrismaClient, Prisma } from '@prisma/client';

loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const datasourceUrl = process.env.DIRECT_DATABASE_URL;
if (!datasourceUrl) {
  throw new Error('Brak DIRECT_DATABASE_URL — seed musi działać rolą omijającą RLS.');
}

const prisma = new PrismaClient({ datasourceUrl });

const CURRENCY = 'PLN';
const VAT_FOOD = new Prisma.Decimal('0.0800');
const VAT_ALCOHOL = new Prisma.Decimal('0.2300');

/** Token QR: 128-bit, losowy, niezgadywalny — nigdy sekwencyjne ID stolika. */
const qrToken = () => randomBytes(16).toString('base64url');

interface SeedItem {
  pl: { name: string; description?: string };
  en: { name: string; description?: string };
  priceCents: number;
  vatRate?: Prisma.Decimal;
  allergens?: string[];
  dietaryTags?: string[];
  prepTimeMinutes?: number;
  isFeatured?: boolean;
}

const MENU: { pl: string; en: string; items: SeedItem[] }[] = [
  {
    pl: 'Przystawki',
    en: 'Starters',
    items: [
      {
        pl: { name: 'Tatar wołowy', description: 'Polędwica, ogórek konserwowy, żółtko, kapary' },
        en: { name: 'Beef tartare', description: 'Sirloin, pickled cucumber, egg yolk, capers' },
        priceCents: 4900,
        allergens: ['jaja', 'gorczyca'],
        prepTimeMinutes: 10,
        isFeatured: true,
      },
      {
        pl: { name: 'Krem z pieczonej dyni', description: 'Pestki dyni, oliwa szałwiowa' },
        en: { name: 'Roasted pumpkin soup', description: 'Pumpkin seeds, sage oil' },
        priceCents: 2400,
        dietaryTags: ['vege', 'gluten-free'],
        prepTimeMinutes: 8,
      },
      {
        pl: { name: 'Burrata z pomidorami', description: 'Pomidory malinowe, bazylia, focaccia' },
        en: { name: 'Burrata with tomatoes', description: 'Heirloom tomatoes, basil, focaccia' },
        priceCents: 3900,
        allergens: ['mleko', 'gluten'],
        dietaryTags: ['vege'],
        prepTimeMinutes: 8,
      },
    ],
  },
  {
    pl: 'Dania główne',
    en: 'Main courses',
    items: [
      {
        pl: { name: 'Pierogi ruskie', description: 'Osiem sztuk, cebulka, śmietana' },
        en: { name: 'Potato & cheese dumplings', description: 'Eight pieces, onion, sour cream' },
        priceCents: 3400,
        allergens: ['gluten', 'mleko'],
        dietaryTags: ['vege'],
        prepTimeMinutes: 15,
      },
      {
        pl: { name: 'Policzki wołowe', description: 'Duszone w czerwonym winie, puree seler' },
        en: { name: 'Braised beef cheeks', description: 'Red wine reduction, celeriac purée' },
        priceCents: 6900,
        allergens: ['mleko', 'seler'],
        prepTimeMinutes: 20,
        isFeatured: true,
      },
      {
        pl: { name: 'Dorsz z pieca', description: 'Szpinak, beurre blanc, młode ziemniaki' },
        en: { name: 'Oven-baked cod', description: 'Spinach, beurre blanc, new potatoes' },
        priceCents: 6200,
        allergens: ['ryby', 'mleko'],
        dietaryTags: ['gluten-free'],
        prepTimeMinutes: 22,
      },
      {
        pl: { name: 'Risotto z borowikami', description: 'Carnaroli, parmezan, tymianek' },
        en: { name: 'Porcini risotto', description: 'Carnaroli, parmesan, thyme' },
        priceCents: 5400,
        allergens: ['mleko'],
        dietaryTags: ['vege', 'gluten-free'],
        prepTimeMinutes: 25,
      },
    ],
  },
  {
    pl: 'Napoje',
    en: 'Drinks',
    items: [
      {
        pl: { name: 'Lemoniada domowa', description: 'Cytryna, mięta, syrop z bzu' },
        en: { name: 'Homemade lemonade', description: 'Lemon, mint, elderflower syrup' },
        priceCents: 1600,
        dietaryTags: ['vegan', 'gluten-free'],
        prepTimeMinutes: 3,
      },
      {
        pl: { name: 'Kawa', description: 'Ziarno z lokalnej palarni' },
        en: { name: 'Coffee', description: 'Beans from a local roastery' },
        priceCents: 1200,
        dietaryTags: ['vegan'],
        prepTimeMinutes: 3,
      },
      {
        pl: { name: 'Wino domu, kieliszek', description: 'Białe wytrawne, 150 ml' },
        en: { name: 'House wine, glass', description: 'Dry white, 150 ml' },
        priceCents: 2200,
        vatRate: VAT_ALCOHOL,
        prepTimeMinutes: 2,
      },
    ],
  },
];

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
