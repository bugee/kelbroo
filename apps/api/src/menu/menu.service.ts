import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface LocalizedText {
  name: string;
  description: string | null;
}

export interface MenuModifier extends LocalizedText {
  id: string;
  priceDeltaCents: number;
  isAvailable: boolean;
}

export interface MenuModifierGroup extends LocalizedText {
  id: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  modifiers: MenuModifier[];
}

export interface MenuDish extends LocalizedText {
  id: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  isAvailable: boolean;
  allergens: string[];
  dietaryTags: string[];
  calories: number | null;
  prepTimeMinutes: number | null;
  isFeatured: boolean;
  modifierGroups: MenuModifierGroup[];
}

export interface MenuCategoryView extends LocalizedText {
  id: string;
  items: MenuDish[];
}

interface Translation {
  locale: string;
  name: string;
  description?: string | null;
}

@Injectable()
export class MenuService {
  /**
   * Brak tłumaczenia dla wybranego języka → fallback na język domyślny
   * restauracji, nigdy pusty ekran (docs/architecture.md §5).
   */
  private translate(
    translations: Translation[],
    locale: string,
    defaultLocale: string,
  ): LocalizedText {
    const exact = translations.find((t) => t.locale === locale);
    const fallback = translations.find((t) => t.locale === defaultLocale);
    const chosen = exact ?? fallback ?? translations[0];

    return {
      name: chosen?.name ?? '',
      description: chosen?.description ?? null,
    };
  }

  /** Menu jednego lokalu w wybranym języku, bez pozycji i kategorii wyłączonych. */
  async forRestaurant(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    locale: string,
    defaultLocale: string,
  ): Promise<MenuCategoryView[]> {
    const categories = await tx.menuCategory.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        translations: true,
        items: {
          orderBy: { sortOrder: 'asc' },
          include: {
            translations: true,
            modifierGroups: {
              orderBy: { sortOrder: 'asc' },
              include: {
                translations: true,
                modifiers: { orderBy: { sortOrder: 'asc' }, include: { translations: true } },
              },
            },
          },
        },
      },
    });

    return categories.map((category) => ({
      id: category.id,
      ...this.translate(category.translations, locale, defaultLocale),
      items: category.items.map((item) => ({
        id: item.id,
        ...this.translate(item.translations, locale, defaultLocale),
        priceCents: item.priceCents,
        currency: item.currency,
        imageUrl: item.imageUrl,
        // Dania niedostępne zostają w odpowiedzi — gość ma je zobaczyć
        // wyszarzone, a nie zastanawiać się, czemu menu jest krótsze.
        isAvailable: item.isAvailable,
        allergens: item.allergens,
        dietaryTags: item.dietaryTags,
        calories: item.calories,
        prepTimeMinutes: item.prepTimeMinutes,
        isFeatured: item.isFeatured,
        modifierGroups: item.modifierGroups.map((group) => ({
          id: group.id,
          ...this.translate(group.translations, locale, defaultLocale),
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          isRequired: group.isRequired,
          modifiers: group.modifiers.map((modifier) => ({
            id: modifier.id,
            ...this.translate(modifier.translations, locale, defaultLocale),
            priceDeltaCents: modifier.priceDeltaCents,
            isAvailable: modifier.isAvailable,
          })),
        })),
      })),
    }));
  }

  /** ?lang= → Accept-Language → język domyślny restauracji. */
  resolveLocale(
    requested: string | undefined,
    acceptLanguage: string | undefined,
    supported: string[],
    defaultLocale: string,
  ): string {
    if (requested && supported.includes(requested)) {
      return requested;
    }

    const preferences = (acceptLanguage ?? '')
      .split(',')
      .map((entry) => {
        const [tag = '', quality] = entry.trim().split(';q=');
        return { tag: tag.split('-')[0]?.toLowerCase() ?? '', quality: Number(quality ?? 1) };
      })
      .filter((entry) => entry.tag.length > 0)
      .sort((a, b) => b.quality - a.quality);

    for (const preference of preferences) {
      if (supported.includes(preference.tag)) {
        return preference.tag;
      }
    }

    return defaultLocale;
  }
}
