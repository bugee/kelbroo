import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { StaffContext } from '../auth/auth.types';
import type { TableDto } from './dto';

/** 128 bitów losowości. Nigdy sekwencyjny numer stolika — patrz §8 architektury. */
const newQrToken = () => randomBytes(16).toString('base64url');

@Injectable()
export class TablesAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private restaurantOf(staff: StaffContext): string {
    if (!staff.restaurantId) {
      throw new ForbiddenException('Konto nie jest przypisane do lokalu.');
    }
    return staff.restaurantId;
  }

  async list(staff: StaffContext) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const restaurantId = this.restaurantOf(staff);
      const [tables, subscription] = await Promise.all([
        tx.table.findMany({
          where: { restaurantId },
          orderBy: [{ zone: 'asc' }, { label: 'asc' }],
        }),
        tx.subscription.findUnique({ where: { organizationId: staff.organizationId } }),
      ]);

      return {
        tableLimit: subscription?.tableLimit ?? 0,
        activeCount: tables.filter((table) => table.isActive).length,
        tables: tables.map((table) => ({
          id: table.id,
          label: table.label,
          zone: table.zone,
          seats: table.seats,
          isActive: table.isActive,
          qrToken: table.qrToken,
          qrVersion: table.qrVersion,
        })),
      };
    });
  }

  async create(staff: StaffContext, dto: TableDto) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const restaurantId = this.restaurantOf(staff);
      await this.assertWithinPlan(tx, staff, restaurantId);

      try {
        const table = await tx.table.create({
          data: {
            organizationId: staff.organizationId,
            restaurantId,
            label: dto.label,
            zone: dto.zone ?? null,
            seats: dto.seats ?? null,
            qrToken: newQrToken(),
          },
        });
        return { id: table.id, qrToken: table.qrToken };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(`Stolik „${dto.label}" już istnieje.`);
        }
        throw error;
      }
    });
  }

  async update(staff: StaffContext, id: string, dto: TableDto) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const table = await tx.table.findFirst({
        where: { id, restaurantId: this.restaurantOf(staff) },
      });
      if (!table) throw new NotFoundException('Stolik nie istnieje.');

      try {
        await tx.table.update({
          where: { id },
          data: { label: dto.label, zone: dto.zone ?? null, seats: dto.seats ?? null },
        });
      } catch (error) {
        // Ta sama kolizja co przy zakładaniu, tylko trafia się częściej:
        // numery poprawia się zwykle po to, żeby przenumerować salę, a wtedy
        // nowa nazwa bywa zajęta przez stolik, który dopiero ma ją oddać.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(`Stolik „${dto.label}" już istnieje.`);
        }
        throw error;
      }
      return { id };
    });
  }

  /**
   * Nowy token unieważnia stary wydruk — do tego właśnie służy.
   *
   * Goście, którzy już zeskanowali, mają własne tokeny sesji i zamawiają
   * dalej bez przeszkód; przestaje działać wyłącznie naklejka na stoliku.
   * Operacja jest nieodwracalna i wymaga uprawnień managera.
   */
  async regenerateQr(staff: StaffContext, id: string) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const table = await tx.table.findFirst({
        where: { id, restaurantId: this.restaurantOf(staff) },
      });
      if (!table) throw new NotFoundException('Stolik nie istnieje.');

      const updated = await tx.table.update({
        where: { id },
        data: { qrToken: newQrToken(), qrVersion: { increment: 1 } },
      });

      await tx.auditLog.create({
        data: {
          organizationId: staff.organizationId,
          actorStaffId: staff.staffId,
          action: 'table.qr_regenerated',
          entity: 'Table',
          entityId: id,
          payload: { label: table.label, version: updated.qrVersion } as Prisma.InputJsonValue,
        },
      });

      return { id, qrToken: updated.qrToken, qrVersion: updated.qrVersion };
    });
  }

  async setActive(staff: StaffContext, id: string, isActive: boolean) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const restaurantId = this.restaurantOf(staff);
      const table = await tx.table.findFirst({ where: { id, restaurantId } });
      if (!table) throw new NotFoundException('Stolik nie istnieje.');

      if (isActive && !table.isActive) {
        await this.assertWithinPlan(tx, staff, restaurantId);
      }

      if (!isActive) {
        // Wyłączenie stolika z otwartym rachunkiem zostawiłoby gości bez
        // możliwości dozamówienia i bez rozliczenia.
        const open = await tx.tableSession.count({
          where: { tableId: id, status: { in: ['open', 'awaiting_settlement'] } },
        });
        if (open > 0) {
          throw new ConflictException('Stolik ma otwarty rachunek — najpierw go rozlicz.');
        }
      }

      await tx.table.update({ where: { id }, data: { isActive } });
      return { id, isActive };
    });
  }

  private async assertWithinPlan(
    tx: Prisma.TransactionClient,
    staff: StaffContext,
    restaurantId: string,
  ): Promise<void> {
    const subscription = await tx.subscription.findUnique({
      where: { organizationId: staff.organizationId },
    });
    const active = await tx.table.count({ where: { restaurantId, isActive: true } });

    if (subscription && active >= subscription.tableLimit) {
      throw new ConflictException(
        `Plan ${subscription.plan} obejmuje ${subscription.tableLimit} stolików. Wyłącz inny stolik albo zmień plan.`,
      );
    }
  }
}
