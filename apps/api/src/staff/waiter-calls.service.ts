import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { StaffContext } from '../auth/auth.types';

/**
 * Wezwania kelnera po stronie obsługi.
 *
 * Zgłoszenie ma dwa kroki, nie jeden: „widzę" i „załatwione". Bez tego dwóch
 * kelnerów idzie do tego samego stolika, a trzeci sądzi, że ktoś już poszedł.
 */
@Injectable()
export class WaiterCallsService {
  constructor(private readonly prisma: PrismaService) {}

  private restaurantOf(staff: StaffContext): string {
    if (!staff.restaurantId) {
      throw new ForbiddenException('Konto nie jest przypisane do lokalu.');
    }
    return staff.restaurantId;
  }

  /** Otwarte i przyjęte zgłoszenia — załatwione znikają z widoku. */
  async open(staff: StaffContext) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const calls = await tx.waiterCall.findMany({
        where: {
          restaurantId: this.restaurantOf(staff),
          status: { in: ['open', 'acknowledged'] },
        },
        orderBy: { createdAt: 'asc' },
        include: {
          table: { select: { label: true } },
          acknowledgedByStaff: { select: { name: true } },
        },
      });

      return calls.map((call) => ({
        id: call.id,
        tableLabel: call.table.label,
        reason: call.reason,
        status: call.status,
        createdAt: call.createdAt,
        acknowledgedBy: call.acknowledgedByStaff?.name ?? null,
      }));
    });
  }

  /** „Idę" — reszta zmiany widzi, że ktoś już się tym zajął. */
  async acknowledge(staff: StaffContext, callId: string) {
    return this.update(staff, callId, {
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedByStaffId: staff.staffId,
    });
  }

  async resolve(staff: StaffContext, callId: string) {
    return this.update(staff, callId, { status: 'resolved', resolvedAt: new Date() });
  }

  private async update(
    staff: StaffContext,
    callId: string,
    data: {
      status: 'acknowledged' | 'resolved';
      acknowledgedAt?: Date;
      acknowledgedByStaffId?: string;
      resolvedAt?: Date;
    },
  ) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const call = await tx.waiterCall.findFirst({
        where: { id: callId, restaurantId: this.restaurantOf(staff) },
      });
      if (!call) {
        throw new NotFoundException('Wezwanie nie istnieje.');
      }

      const updated = await tx.waiterCall.update({ where: { id: call.id }, data });
      return { id: updated.id, status: updated.status };
    });
  }
}
