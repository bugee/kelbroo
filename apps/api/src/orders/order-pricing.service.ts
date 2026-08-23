import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface ModifierSnapshot {
  id: string;
  name: string;
  priceDeltaCents: number;
}

export interface RequestedItem {
  menuItemId: string;
  quantity: number;
  modifierIds?: string[];
  note?: string | null;
}

export interface PricedItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  /** Stawka z chwili zamówienia — trafia do snapshotu pozycji. */
  vatRate: Prisma.Decimal;
  modifiers: ModifierSnapshot[];
  note: string | null;
}

/**
 * Wycena pozycji zamówienia — jedno miejsce dla gościa i dla kelnera.
 *
 * Klient przysyła wyłącznie identyfikatory; cena z żądania nigdy nie jest brana
 * pod uwagę. To, co wychodzi, jest snapshotem: późniejsza zmiana cennika nie
 * może ruszyć historycznego rachunku.
 */
@Injectable()
export class OrderPricingService {
  async price(
    tx: Prisma.TransactionClient,
    options: {
      restaurantId: string;
      currency: string;
      locale: string;
      defaultLocale: string;
      items: RequestedItem[];
    },
  ): Promise<{ items: PricedItem[]; subtotalCents: number; vatCents: number }> {
    const { restaurantId, currency, locale, defaultLocale } = options;

    const menuItemIds = [...new Set(options.items.map((item) => item.menuItemId))];
    const menuItems = await tx.menuItem.findMany({
      where: { id: { in: menuItemIds }, restaurantId },
      include: {
        translations: true,
        modifierGroups: { include: { modifiers: { include: { translations: true } } } },
      },
    });

    const byId = new Map(menuItems.map((item) => [item.id, item]));

    const name = (translations: { locale: string; name: string }[]): string =>
      translations.find((t) => t.locale === locale)?.name ??
      translations.find((t) => t.locale === defaultLocale)?.name ??
      translations[0]?.name ??
      '';

    let subtotalCents = 0;
    let vatCents = 0;

    const items = options.items.map((requested) => {
      const menuItem = byId.get(requested.menuItemId);
      if (!menuItem) {
        throw new BadRequestException('Pozycja nie należy do menu tej restauracji.');
      }
      if (!menuItem.isAvailable) {
        throw new ConflictException(`„${name(menuItem.translations)}" jest chwilowo niedostępne.`);
      }
      if (menuItem.currency !== currency) {
        throw new ConflictException('Niespójna waluta w menu restauracji.');
      }

      const selected = new Set(requested.modifierIds ?? []);
      const modifiers: ModifierSnapshot[] = [];

      for (const group of menuItem.modifierGroups) {
        const chosen = group.modifiers.filter((modifier) => selected.has(modifier.id));

        if (chosen.length < group.minSelect || (group.isRequired && chosen.length === 0)) {
          throw new BadRequestException('Nie wybrano wymaganych dodatków.');
        }
        if (chosen.length > group.maxSelect) {
          throw new BadRequestException('Wybrano za dużo dodatków.');
        }
        for (const modifier of chosen) {
          if (!modifier.isAvailable) {
            throw new ConflictException('Wybrany dodatek jest chwilowo niedostępny.');
          }
          selected.delete(modifier.id);
          modifiers.push({
            id: modifier.id,
            name: name(modifier.translations),
            priceDeltaCents: modifier.priceDeltaCents,
          });
        }
      }

      if (selected.size > 0) {
        throw new BadRequestException('Wybrano dodatek spoza tego dania.');
      }

      const unitPriceCents =
        menuItem.priceCents + modifiers.reduce((sum, m) => sum + m.priceDeltaCents, 0);
      const lineTotal = unitPriceCents * requested.quantity;

      subtotalCents += lineTotal;
      // Ceny w menu są brutto, więc VAT wyliczamy z kwoty brutto, nie doliczamy.
      vatCents += vatFromGross(lineTotal, menuItem.vatRate);

      return {
        menuItemId: menuItem.id,
        name: name(menuItem.translations),
        quantity: requested.quantity,
        unitPriceCents,
        vatRate: menuItem.vatRate,
        modifiers,
        note: requested.note ?? null,
      };
    });

    return { items, subtotalCents, vatCents };
  }
}

/**
 * VAT zawarty w kwocie brutto: brutto × stawka / (1 + stawka).
 * Liczone na liczbach całkowitych, zaokrąglane raz, na całej pozycji.
 */
export function vatFromGross(grossCents: number, rate: Prisma.Decimal): number {
  const numerator = rate.toNumber();
  return Math.round((grossCents * numerator) / (1 + numerator));
}
