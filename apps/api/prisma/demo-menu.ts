/**
 * Karta menu używana przez dane demonstracyjne.
 *
 * Jedno źródło dla dwóch rzeczy: lokalnego seeda (`prisma/seed.ts`) i publicznej
 * restauracji pokazowej wystawionej pod `/t/demo`. Dwie kopie tej karty
 * rozjechałyby się przy pierwszej poprawce, a pokazowa jest tą, którą widzą
 * ludzie z zewnątrz.
 */
import { Prisma } from '@prisma/client';

export const CURRENCY = 'PLN';
export const VAT_FOOD = new Prisma.Decimal('0.0800');
export const VAT_ALCOHOL = new Prisma.Decimal('0.2300');

export interface SeedItem {
  pl: { name: string; description?: string };
  en: { name: string; description?: string };
  priceCents: number;
  vatRate?: Prisma.Decimal;
  allergens?: string[];
  dietaryTags?: string[];
  prepTimeMinutes?: number;
  isFeatured?: boolean;
}

export const MENU: { pl: string; en: string; items: SeedItem[] }[] = [
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
