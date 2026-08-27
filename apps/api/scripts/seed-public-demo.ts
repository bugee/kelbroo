/**
 * Publiczna restauracja pokazowa — ta spod `/t/demo`.
 *
 * Uruchamiana ręcznie, raz na środowisko:
 *   docker compose -f docker-compose.prod.yml --env-file .env.prod \
 *     run --rm migrate pnpm exec tsx scripts/seed-public-demo.ts
 *
 * Idempotentna: powtórzone uruchomienie odświeża menu i ustawienia, ale nie
 * tworzy drugiej restauracji.
 *
 * **To nie jest seed lokalny.** Ta restauracja jest widoczna z internetu dla
 * każdego, kto kliknie „Zobacz demo", więc nie ma w niej ani jednego konta
 * pracownika i nie da się przez nią wejść do panelu.
 */
import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { CURRENCY, MENU, VAT_FOOD } from '../prisma/demo-menu';
import { LocalDiskImageStorage } from '../src/media/menu-image.storage';

loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const datasourceUrl = process.env.DIRECT_DATABASE_URL;
if (!datasourceUrl) {
  throw new Error('Brak DIRECT_DATABASE_URL — skrypt musi działać rolą omijającą RLS.');
}

const prisma = new PrismaClient({ datasourceUrl });

/** Adres jest wpisywany w treść strony produktowej, więc musi być stały. */
export const DEMO_QR_TOKEN = 'demo';
export const DEMO_SLUG = 'demo-kelbroo';

async function main() {
  const istniejaca = await prisma.restaurant.findUnique({ where: { slug: DEMO_SLUG } });

  const organizationId =
    istniejaca?.organizationId ??
    (
      await prisma.organization.create({
        data: {
          name: 'kelbroo — restauracja pokazowa',
          billingEmail: 'kontakt@kelbroo.com',
          isDemo: true,
          subscription: {
            create: {
              plan: 'pro',
              status: 'active',
              // Data odległa, nie `null`: pusty termin znaczy „abonament bez końca",
              // a chcemy, żeby pokazowa przechodziła tę samą ścieżkę co klienci.
              currentPeriodEnd: new Date('2099-12-31T00:00:00Z'),
              tableLimit: 40,
              languageLimit: 6,
              // Pokazowa restauracja ma pokazywać także zdjęcia dań — to jedna
              // z rzeczy, dla których restaurator w ogóle otwiera demo.
              menuPhotosEnabled: true,
            },
          },
        },
      })
    ).id;

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: DEMO_SLUG },
    update: {},
    create: {
      organizationId,
      name: 'Bistro Widok',
      slug: DEMO_SLUG,
      address: 'ul. Próżna 12, 00-107 Warszawa',
      currency: CURRENCY,
      defaultLocale: 'pl',
      supportedLocales: ['pl', 'en'],
      orderingMode: 'pay_at_table',
      // **Wyłączone celowo.** Potwierdzenie czeka na kelnera, a przy pokazowej
      // restauracji nie ma żadnego — zwiedzający zobaczyłby zamówienie, które
      // wisi w nieskończoność, i uznał, że produkt nie działa.
      requireStaffConfirmation: false,
      tableActivationRequired: false,
      // Gospodarz nie zatwierdza wchodzących: przy stoliku pokazowym siedzą
      // nieznajomi z całego internetu i nikt nikogo nie wpuści.
      hostApprovesGuests: false,
      fiscalizationMode: 'none',
      minOrderCents: 0,
      openBillLimitCents: 30000,
    },
  });

  await prisma.table.upsert({
    where: { qrToken: DEMO_QR_TOKEN },
    update: { restaurantId: restaurant.id, organizationId },
    create: {
      organizationId,
      restaurantId: restaurant.id,
      label: 'Stolik pokazowy',
      zone: 'Sala',
      seats: 4,
      qrToken: DEMO_QR_TOKEN,
    },
  });

  // Menu budujemy tylko raz — powtórzone uruchomienie nie ma go duplikować.
  const maMenu = await prisma.menuCategory.count({ where: { restaurantId: restaurant.id } });
  if (maMenu === 0) {
    for (const [categoryIndex, category] of MENU.entries()) {
      const created = await prisma.menuCategory.create({
        data: {
          organizationId,
          restaurantId: restaurant.id,
          sortOrder: categoryIndex,
          translations: {
            create: [
              { organizationId, locale: 'pl', name: category.pl },
              { organizationId, locale: 'en', name: category.en },
            ],
          },
        },
      });

      for (const [itemIndex, item] of category.items.entries()) {
        await prisma.menuItem.create({
          data: {
            organizationId,
            restaurantId: restaurant.id,
            categoryId: created.id,
            sortOrder: itemIndex,
            priceCents: item.priceCents,
            currency: CURRENCY,
            vatRate: item.vatRate ?? VAT_FOOD,
            allergens: item.allergens ?? [],
            dietaryTags: item.dietaryTags ?? [],
            prepTimeMinutes: item.prepTimeMinutes,
            isFeatured: item.isFeatured ?? false,
            translations: {
              create: [
                { organizationId, locale: 'pl', ...item.pl },
                { organizationId, locale: 'en', ...item.en },
              ],
            },
          },
        });
      }
    }
  }

  await wgrajZdjecia(organizationId, restaurant.id);

  console.log(`Restauracja pokazowa: ${restaurant.name} (${restaurant.slug})`);
  console.log(`Adres dla gościa: /t/${DEMO_QR_TOKEN}`);
  console.log(maMenu === 0 ? 'Menu utworzone.' : 'Menu już istniało — pominięte.');
}

/** Do porównania nazwy pliku z nazwą dania: bez ogonków, wielkości liter i interpunkcji. */
const uprosc = (tekst: string) =>
  tekst
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Zdjęcia dań dla restauracji pokazowej.
 *
 * Pliki leżą w repozytorium już **zmniejszone** (dłuższy bok 1400 px, JPEG) —
 * tą samą arytmetyką, którą stosuje panel przy wgrywaniu. Oryginały z aparatu
 * ważą po ~1,8 MB każdy; niezmniejszone dałyby kartę demo ważącą osiemnaście
 * megabajtów na telefonie kogoś, kto ogląda ją na komórkowym internecie.
 *
 * Dopasowanie po nazwie pliku. **Brak dopasowania jest błędem, nie ciszą**:
 * przemianowane danie inaczej po cichu zostałoby bez zdjęcia i nikt by tego
 * nie zauważył, dopóki nie zajrzałby do demo.
 */
async function wgrajZdjecia(organizationId: string, restaurantId: string) {
  const katalog = path.join(__dirname, '..', 'prisma', 'demo-images');
  const pliki = (await readdir(katalog).catch(() => [])).filter((n) => n.endsWith('.jpg'));
  if (pliki.length === 0) {
    console.log('Brak katalogu ze zdjęciami — pomijam.');
    return;
  }

  const storage = new LocalDiskImageStorage();
  const dania = await prisma.menuItem.findMany({
    where: { restaurantId },
    select: { id: true, imageUrl: true, translations: { select: { locale: true, name: true } } },
  });

  let wgrane = 0;
  const nieznane: string[] = [];

  for (const plik of pliki) {
    const szukane = uprosc(plik.replace(/\.jpg$/, ''));
    const danie = dania.find((pozycja) => {
      const nazwa = uprosc(pozycja.translations.find((t) => t.locale === 'pl')?.name ?? '');
      // Pełna zgodność albo nazwa pliku jako początek nazwy dania — „wino"
      // opisuje „Wino domu, kieliszek".
      return nazwa === szukane || nazwa.startsWith(`${szukane} `);
    });

    if (!danie) {
      nieznane.push(plik);
      continue;
    }
    if (danie.imageUrl) continue;

    const nazwa = await storage.save(await readFile(path.join(katalog, plik)));
    await prisma.menuItem.update({ where: { id: danie.id }, data: { imageUrl: nazwa } });
    wgrane += 1;
  }

  console.log(`Zdjęcia: wgrano ${wgrane}, pominięto ${pliki.length - wgrane - nieznane.length}.`);
  if (nieznane.length > 0) {
    throw new Error(
      `Te zdjęcia nie pasują do żadnego dania: ${nieznane.join(', ')}. ` +
        'Sprawdź nazwy plików albo nazwy pozycji w karcie.',
    );
  }
}

main()
  .catch((przyczyna) => {
    console.error(przyczyna);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
