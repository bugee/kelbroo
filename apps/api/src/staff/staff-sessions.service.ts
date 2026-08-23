import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { StaffContext } from '../auth/auth.types';

export type OfflineMethod = 'cash' | 'card_terminal';

@Injectable()
export class StaffSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private restaurantOf(staff: StaffContext): string {
    if (!staff.restaurantId) {
      throw new ForbiddenException('Konto nie jest przypisane do lokalu.');
    }
    return staff.restaurantId;
  }

  /** Widok sali: otwarte wizyty z kwotą do rozliczenia. */
  async openSessions(staff: StaffContext) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const sessions = await tx.tableSession.findMany({
        where: {
          restaurantId: this.restaurantOf(staff),
          status: { in: ['open', 'awaiting_settlement'] },
        },
        orderBy: { openedAt: 'asc' },
        include: {
          table: { select: { label: true, zone: true } },
          participants: {
            select: { id: true, displayName: true, symbol: true, color: true, isHost: true },
          },
          _count: { select: { orders: true } },
        },
      });

      return sessions.map((session) => ({
        id: session.id,
        number: session.sessionNumber,
        tableLabel: session.table.label,
        zone: session.table.zone,
        status: session.status,
        openedAt: session.openedAt,
        totalCents: session.totalCents,
        paidCents: session.paidCents,
        dueCents: session.totalCents - session.paidCents,
        currency: session.currency,
        orderCount: session._count.orders,
        participants: session.participants,
      }));
    });
  }

  /**
   * Rozliczenie u kelnera. Płatność jest tu zapisem ewidencyjnym — fiskalizacja
   * dzieje się na kasie lokalu, poza kelbroo (docs/architecture.md §12, opcja A).
   * Rachunek zamyka wyłącznie personel; gość nie może oznaczyć wizyty jako
   * rozliczonej.
   */
  async settle(
    staff: StaffContext,
    sessionId: string,
    method: OfflineMethod,
    amountCents: number,
    reason?: string,
  ) {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new BadRequestException('Kwota rozliczenia musi być dodatnią liczbą groszy.');
    }

    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const session = await tx.tableSession.findFirst({
        where: { id: sessionId, restaurantId: this.restaurantOf(staff) },
      });
      if (!session) {
        throw new NotFoundException('Wizyta nie istnieje.');
      }
      if (session.status === 'closed' || session.status === 'settled') {
        throw new BadRequestException('Wizyta jest już rozliczona.');
      }

      const paidAfter = session.paidCents + amountCents;
      const underpaid = paidAfter < session.totalCents;

      // Zamknięcie z niedopłatą to strata lokalu — decyzja managera, z powodem.
      if (underpaid && !['owner', 'manager'].includes(staff.role)) {
        throw new ForbiddenException(
          'Rozliczenie poniżej kwoty rachunku wymaga uprawnień managera.',
        );
      }
      if (underpaid && !reason?.trim()) {
        throw new BadRequestException('Niedopłata wymaga podania powodu.');
      }

      await tx.payment.create({
        data: {
          organizationId: staff.organizationId,
          tableSessionId: session.id,
          provider: 'offline',
          method,
          status: 'succeeded',
          amountCents,
          currency: session.currency,
          paidAt: new Date(),
          collectedByStaffId: staff.staffId,
        },
      });

      const fullyPaid = paidAfter >= session.totalCents;
      const updated = await tx.tableSession.update({
        where: { id: session.id },
        data: {
          paidCents: paidAfter,
          status: fullyPaid ? 'closed' : 'awaiting_settlement',
          ...(fullyPaid ? { closedAt: new Date(), closedByStaffId: staff.staffId } : {}),
        },
      });

      if (fullyPaid) {
        // Realizacja i rozliczenie to niezależne cykle — zamykamy oba dopiero tu.
        await tx.order.updateMany({
          where: { tableSessionId: session.id, status: { notIn: ['rejected', 'canceled'] } },
          data: { paymentStatus: 'settled' },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: staff.organizationId,
          actorStaffId: staff.staffId,
          action: underpaid ? 'session.settled_underpaid' : 'session.settled',
          entity: 'TableSession',
          entityId: session.id,
          payload: {
            amountCents,
            method,
            totalCents: session.totalCents,
            paidCents: paidAfter,
            reason: reason ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        id: updated.id,
        status: updated.status,
        totalCents: updated.totalCents,
        paidCents: updated.paidCents,
        dueCents: Math.max(0, updated.totalCents - updated.paidCents),
        currency: updated.currency,
      };
    });
  }
}
