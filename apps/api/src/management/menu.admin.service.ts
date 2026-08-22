import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { StaffContext } from '../auth/auth.types';
import type { CategoryDto, MenuItemDto, ModifierGroupDto, TranslationDto } from './dto';

@Injectable()
export class MenuAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private restaurantOf(staff: StaffContext): string {
    if (!staff.restaurantId) {
      throw new ForbiddenException('Konto nie jest przypisane do lokalu.');
    }
    return staff.restaurantId;
  }

  /**
   * Widok managera: wszystkie języki naraz i pozycje wycofane włącznie.
   * To celowo co innego niż menu gościa, które pokazuje jeden język
   * i ukrywa archiwum.
   */
  async fullMenu(staff: StaffContext) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const restaurant = await tx.restaurant.findUniqueOrThrow({
        where: { id: this.restaurantOf(staff) },
      });

      const categories = await tx.menuCategory.findMany({
        where: { restaurantId: restaurant.id },
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

      return {
        defaultLocale: restaurant.defaultLocale,
        supportedLocales: restaurant.supportedLocales,
        currency: restaurant.currency,
        categories: categories.map((category) => ({
          id: category.id,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          isArchived: category.isArchived,
          translations: strip(category.translations),
          items: category.items.map((item) => ({
            id: item.id,
            priceCents: item.priceCents,
            vatPercent: Math.round(item.vatRate.toNumber() * 100),
            sortOrder: item.sortOrder,
            isAvailable: item.isAvailable,
            isArchived: item.isArchived,
            isFeatured: item.isFeatured,
            allergens: item.allergens,
            dietaryTags: item.dietaryTags,
            prepTimeMinutes: item.prepTimeMinutes,
            translations: strip(item.translations),
            modifierGroups: item.modifierGroups.map((group) => ({
              id: group.id,
              minSelect: group.minSelect,
              maxSelect: group.maxSelect,
              isRequired: group.isRequired,
              translations: strip(group.translations),
              modifiers: group.modifiers.map((modifier) => ({
                id: modifier.id,
                priceDeltaCents: modifier.priceDeltaCents,
                isAvailable: modifier.isAvailable,
                translations: strip(modifier.translations),
              })),
            })),
          })),
        })),
      };
    });
  }

  async createCategory(staff: StaffContext, dto: CategoryDto) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const restaurantId = this.restaurantOf(staff);
      await this.assertLocales(tx, restaurantId, dto.translations);

      const last = await tx.menuCategory.aggregate({
        where: { restaurantId },
        _max: { sortOrder: true },
      });

      const category = await tx.menuCategory.create({
        data: {
          organizationId: staff.organizationId,
          restaurantId,
          sortOrder: dto.sortOrder ?? (last._max.sortOrder ?? -1) + 1,
          isActive: dto.isActive ?? true,
          translations: {
            create: dto.translations.map((translation) => ({
              organizationId: staff.organizationId,
              ...translation,
            })),
          },
        },
      });
      return { id: category.id };
    });
  }

  async updateCategory(staff: StaffContext, id: string, dto: CategoryDto) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const restaurantId = this.restaurantOf(staff);
      const existing = await tx.menuCategory.findFirst({ where: { id, restaurantId } });
      if (!existing) throw new NotFoundException('Kategoria nie istnieje.');

      await this.assertLocales(tx, restaurantId, dto.translations);

      await tx.menuCategory.update({
        where: { id },
        data: {
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          // Tłumaczenia zastępujemy w całości — łatanie po jednym polu
          // zostawiałoby osierocone locale po zmianie listy języków lokalu.
          translations: {
            deleteMany: {},
            create: dto.translations.map((translation) => ({
              organizationId: staff.organizationId,
              ...translation,
            })),
          },
        },
      });
      return { id };
    });
  }

  async archiveCategory(staff: StaffContext, id: string, archived: boolean) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const restaurantId = this.restaurantOf(staff);
      const category = await tx.menuCategory.findFirst({
        where: { id, restaurantId },
        include: { _count: { select: { items: true } } },
      });
      if (!category) throw new NotFoundException('Kategoria nie istnieje.');

      await tx.menuCategory.update({ where: { id }, data: { isArchived: archived } });
      // Danie bez widocznej kategorii zniknęłoby z karty bez śladu w panelu.
      await tx.menuItem.updateMany({ where: { categoryId: id }, data: { isArchived: archived } });

      return { id, isArchived: archived, affectedItems: category._count.items };
    });
  }

  async createItem(staff: StaffContext, dto: MenuItemDto) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const restaurantId = this.restaurantOf(staff);
      const restaurant = await tx.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
      await this.assertLocales(tx, restaurantId, dto.translations);

      const category = await tx.menuCategory.findFirst({
        where: { id: dto.categoryId, restaurantId },
      });
      if (!category) throw new BadRequestException('Kategoria nie należy do tego lokalu.');

      const item = await tx.menuItem.create({
        data: {
          organizationId: staff.organizationId,
          restaurantId,
          categoryId: category.id,
          priceCents: dto.priceCents,
          currency: restaurant.currency,
          vatRate: percentToRate(dto.vatPercent),
          sortOrder: dto.sortOrder ?? 0,
          isAvailable: dto.isAvailable ?? true,
          isFeatured: dto.isFeatured ?? false,
          allergens: dto.allergens ?? [],
          dietaryTags: dto.dietaryTags ?? [],
          prepTimeMinutes: dto.prepTimeMinutes ?? null,
          translations: {
            create: dto.translations.map((translation) => ({
              organizationId: staff.organizationId,
              ...translation,
            })),
          },
        },
      });

      await this.replaceModifierGroups(tx, staff, item.id, dto.modifierGroups ?? []);
      return { id: item.id };
    });
  }

  async updateItem(staff: StaffContext, id: string, dto: MenuItemDto) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const restaurantId = this.restaurantOf(staff);
      const existing = await tx.menuItem.findFirst({ where: { id, restaurantId } });
      if (!existing) throw new NotFoundException('Pozycja nie istnieje.');

      await this.assertLocales(tx, restaurantId, dto.translations);

      const category = await tx.menuCategory.findFirst({
        where: { id: dto.categoryId, restaurantId },
      });
      if (!category) throw new BadRequestException('Kategoria nie należy do tego lokalu.');

      await tx.menuItem.update({
        where: { id },
        data: {
          categoryId: category.id,
          priceCents: dto.priceCents,
          vatRate: percentToRate(dto.vatPercent),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isAvailable !== undefined ? { isAvailable: dto.isAvailable } : {}),
          ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
          allergens: dto.allergens ?? [],
          dietaryTags: dto.dietaryTags ?? [],
          prepTimeMinutes: dto.prepTimeMinutes ?? null,
          translations: {
            deleteMany: {},
            create: dto.translations.map((translation) => ({
              organizationId: staff.organizationId,
              ...translation,
            })),
          },
        },
      });

      // PATCH: brak klucza znaczy „nie ruszaj", pusta tablica znaczy „usuń
      // wszystkie". Bez tego rozróżnienia korekta samej ceny kasowałaby
      // modyfikatory dania.
      if (dto.modifierGroups !== undefined) {
        await this.replaceModifierGroups(tx, staff, id, dto.modifierGroups);
      }

      // Zmiana ceny jest akcją wrażliwą — bez śladu nie da się rozstrzygnąć
      // sporu o rachunek ani wykryć nadużycia.
      if (existing.priceCents !== dto.priceCents) {
        await tx.auditLog.create({
          data: {
            organizationId: staff.organizationId,
            actorStaffId: staff.staffId,
            action: 'menu_item.price_changed',
            entity: 'MenuItem',
            entityId: id,
            payload: {
              from: existing.priceCents,
              to: dto.priceCents,
            } as Prisma.InputJsonValue,
          },
        });
      }

      return { id };
    });
  }

  async setAvailability(staff: StaffContext, id: string, isAvailable: boolean) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const existing = await tx.menuItem.findFirst({
        where: { id, restaurantId: this.restaurantOf(staff) },
      });
      if (!existing) throw new NotFoundException('Pozycja nie istnieje.');

      await tx.menuItem.update({ where: { id }, data: { isAvailable } });
      return { id, isAvailable };
    });
  }

  /**
   * Wycofanie zamiast usunięcia. `OrderItem` trzyma snapshot nazwy i ceny, więc
   * skasowanie dania nie zepsułoby historycznego rachunku — ale zerwałoby
   * powiązanie potrzebne do analityki „ile sprzedaliśmy tego dania".
   */
  async archiveItem(staff: StaffContext, id: string, archived: boolean) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const existing = await tx.menuItem.findFirst({
        where: { id, restaurantId: this.restaurantOf(staff) },
      });
      if (!existing) throw new NotFoundException('Pozycja nie istnieje.');

      await tx.menuItem.update({ where: { id }, data: { isArchived: archived } });
      return { id, isArchived: archived };
    });
  }

  private async replaceModifierGroups(
    tx: Prisma.TransactionClient,
    staff: StaffContext,
    menuItemId: string,
    groups: ModifierGroupDto[],
  ): Promise<void> {
    await tx.menuItemModifierGroup.deleteMany({ where: { menuItemId } });

    for (const [index, group] of groups.entries()) {
      if (group.minSelect > group.maxSelect) {
        throw new BadRequestException('Minimalna liczba wyborów przekracza maksymalną.');
      }
      if (group.isRequired && group.minSelect < 1) {
        throw new BadRequestException('Grupa wymagana musi mieć minimum jeden wybór.');
      }
      if (group.minSelect > group.modifiers.length) {
        throw new BadRequestException('Grupa wymaga więcej wyborów, niż ma opcji.');
      }

      const created = await tx.menuItemModifierGroup.create({
        data: {
          organizationId: staff.organizationId,
          menuItemId,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          isRequired: group.isRequired ?? false,
          sortOrder: index,
          translations: {
            create: group.translations.map((translation) => ({
              organizationId: staff.organizationId,
              locale: translation.locale,
              name: translation.name,
            })),
          },
        },
      });

      for (const [position, modifier] of group.modifiers.entries()) {
        await tx.menuItemModifier.create({
          data: {
            organizationId: staff.organizationId,
            groupId: created.id,
            priceDeltaCents: modifier.priceDeltaCents,
            isAvailable: modifier.isAvailable ?? true,
            sortOrder: position,
            translations: {
              create: modifier.translations.map((translation) => ({
                organizationId: staff.organizationId,
                locale: translation.locale,
                name: translation.name,
              })),
            },
          },
        });
      }
    }
  }

  /**
   * Tłumaczenie w języku, którego lokal nie obsługuje, byłoby martwe — nikt go
   * nigdy nie zobaczy. Brak języka domyślnego jest gorszy: gość dostałby pusty
   * ekran zamiast fallbacku.
   */
  private async assertLocales(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    translations: TranslationDto[],
  ): Promise<void> {
    const restaurant = await tx.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });

    const seen = new Set<string>();
    for (const translation of translations) {
      if (seen.has(translation.locale)) {
        throw new BadRequestException(`Zduplikowany język: ${translation.locale}.`);
      }
      seen.add(translation.locale);

      if (!restaurant.supportedLocales.includes(translation.locale)) {
        throw new BadRequestException(
          `Lokal nie obsługuje języka „${translation.locale}". Dodaj go najpierw w ustawieniach.`,
        );
      }
    }

    if (!seen.has(restaurant.defaultLocale)) {
      throw new ConflictException(
        `Brakuje tłumaczenia w języku domyślnym lokalu („${restaurant.defaultLocale}") — bez niego gość zobaczy pustą pozycję.`,
      );
    }
  }
}

const strip = (translations: { locale: string; name: string; description?: string | null }[]) =>
  translations.map((translation) => ({
    locale: translation.locale,
    name: translation.name,
    description: translation.description ?? null,
  }));

/** 8% → 0.0800. Trzymamy Decimal, nie float — stawka bierze udział w kwotach. */
const percentToRate = (percent: number) => new Prisma.Decimal(percent).dividedBy(100).toFixed(4);
