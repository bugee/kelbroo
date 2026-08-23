import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { StaffContext } from '../auth/auth.types';
import type { RestaurantSettingsDto } from './dto';

@Injectable()
export class RestaurantAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private restaurantOf(staff: StaffContext): string {
    if (!staff.restaurantId) {
      throw new ForbiddenException('Konto nie jest przypisane do lokalu.');
    }
    return staff.restaurantId;
  }

  async get(staff: StaffContext) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const restaurant = await tx.restaurant.findUniqueOrThrow({
        where: { id: this.restaurantOf(staff) },
      });
      const subscription = await tx.subscription.findUnique({
        where: { organizationId: staff.organizationId },
      });

      return {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        address: restaurant.address,
        currency: restaurant.currency,
        timezone: restaurant.timezone,
        defaultLocale: restaurant.defaultLocale,
        supportedLocales: restaurant.supportedLocales,
        orderingMode: restaurant.orderingMode,
        requireStaffConfirmation: restaurant.requireStaffConfirmation,
        tableActivationRequired: restaurant.tableActivationRequired,
        hostApprovesGuests: restaurant.hostApprovesGuests,
        partialSettlementEnabled: restaurant.partialSettlementEnabled,
        minOrderCents: restaurant.minOrderCents,
        openBillLimitCents: restaurant.openBillLimitCents,
        businessDayStartHour: restaurant.businessDayStartHour,
        fiscalizationMode: restaurant.fiscalizationMode,
        subscription: subscription
          ? {
              plan: subscription.plan,
              status: subscription.status,
              tableLimit: subscription.tableLimit,
              languageLimit: subscription.languageLimit,
              currentPeriodEnd: subscription.currentPeriodEnd,
            }
          : null,
      };
    });
  }

  async update(staff: StaffContext, dto: RestaurantSettingsDto) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const restaurantId = this.restaurantOf(staff);
      const current = await tx.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
      const subscription = await tx.subscription.findUnique({
        where: { organizationId: staff.organizationId },
      });

      const supportedLocales = dto.supportedLocales ?? current.supportedLocales;
      const defaultLocale = dto.defaultLocale ?? current.defaultLocale;

      if (!supportedLocales.includes(defaultLocale)) {
        throw new BadRequestException(
          'Język domyślny musi być na liście obsługiwanych — to on jest fallbackiem dla brakujących tłumaczeń.',
        );
      }
      if (subscription && supportedLocales.length > subscription.languageLimit) {
        throw new BadRequestException(
          `Plan ${subscription.plan} obejmuje ${subscription.languageLimit} języków.`,
        );
      }

      // Usunięcie języka osieroca tłumaczenia — ostrzegamy, zamiast po cichu
      // zostawiać martwe dane w bazie.
      const removed = current.supportedLocales.filter(
        (locale) => !supportedLocales.includes(locale),
      );

      // Tryb prepaid wymaga płatności online, których etap 1 nie obsługuje.
      if (dto.orderingMode && dto.orderingMode !== 'pay_at_table') {
        throw new BadRequestException(
          'Płatności online nie są jeszcze dostępne — lokal może działać wyłącznie w trybie „płatność u kelnera".',
        );
      }

      const updated = await tx.restaurant.update({
        where: { id: restaurantId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.requireStaffConfirmation !== undefined
            ? { requireStaffConfirmation: dto.requireStaffConfirmation }
            : {}),
          ...(dto.tableActivationRequired !== undefined
            ? { tableActivationRequired: dto.tableActivationRequired }
            : {}),
          ...(dto.hostApprovesGuests !== undefined
            ? { hostApprovesGuests: dto.hostApprovesGuests }
            : {}),
          ...(dto.partialSettlementEnabled !== undefined
            ? { partialSettlementEnabled: dto.partialSettlementEnabled }
            : {}),
          ...(dto.minOrderCents !== undefined ? { minOrderCents: dto.minOrderCents } : {}),
          ...(dto.openBillLimitCents !== undefined
            ? { openBillLimitCents: dto.openBillLimitCents }
            : {}),
          ...(dto.businessDayStartHour !== undefined
            ? { businessDayStartHour: dto.businessDayStartHour }
            : {}),
          supportedLocales,
          defaultLocale,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: staff.organizationId,
          actorStaffId: staff.staffId,
          action: 'restaurant.settings_changed',
          entity: 'Restaurant',
          entityId: restaurantId,
          payload: { changes: dto } as unknown as Prisma.InputJsonValue,
        },
      });

      return { id: updated.id, removedLocales: removed };
    });
  }
}
