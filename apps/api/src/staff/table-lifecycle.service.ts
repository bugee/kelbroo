import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isTerminal } from '@kelbroo/types';
import { PrismaService } from '../prisma/prisma.service';
import { DailyCounterService } from '../common/daily-counter.service';
import { businessDateFor, toDateColumn } from '../common/business-date';
import { GuestGateway } from '../realtime/guest.gateway';
import type { StaffContext } from '../auth/auth.types';

/**
 * Blokada trwa krótko celowo: ma pokryć minutę między wyjściem jednych gości
 * a przyjściem następnych, a nie zamykać stolik na resztę zmiany. Jeśli obsługa
 * potrzebuje dłużej, blokuje ponownie.
 */
export const BLOCK_MINUTES = 2;

/**
 * Cykl życia stolika: sprzątanie, usuwanie gości i blokada.
 *
 * Wizyta powstawała dotąd sama, przy pierwszym skanie, i nie miała żadnej drogi
 * powrotnej — obsługa nie mogła jej posprzątać, a odświeżenie strony po
 * zapłaceniu otwierało kolejną. To jest ta droga powrotna.
 */
@Injectable()
export class TableLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guests: GuestGateway,
    private readonly counters: DailyCounterService,
  ) {}

  private restaurantOf(staff: StaffContext): string {
    if (!staff.restaurantId) {
      throw new ForbiddenException('Konto nie jest przypisane do lokalu.');
    }
    return staff.restaurantId;
  }

  /** Termin, do którego stolik jest zamknięty dla nowych gości. */
  static blockUntil(from = new Date()): Date {
    return new Date(from.getTime() + BLOCK_MINUTES * 60_000);
  }

  /**
   * Sprzątnięcie stolika: goście zeskanowali kod, po czym zrezygnowali.
   *
   * Anuluje to, czego nie zdążono zrealizować, i zamyka wizytę jako `abandoned` —
   * nie `closed`, bo nikt nic nie zapłacił i nie ma czego rozliczać. Zamówienia
   * już wydane blokują sprzątanie: za nie ktoś musi zapłacić.
   */
  async reset(staff: StaffContext, tableId: string, reason: string) {
    if (!reason.trim()) {
      throw new BadRequestException('Sprzątnięcie stolika wymaga podania powodu.');
    }

    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const table = await this.loadTable(tx, staff, tableId);
      const session = await tx.tableSession.findFirst({
        where: { tableId: table.id, status: { in: ['open', 'awaiting_settlement'] } },
        orderBy: { openedAt: 'desc' },
      });

      if (session) {
        if (session.paidCents > 0) {
          throw new ConflictException(
            'Na tej wizycie są już płatności — rozlicz ją zamiast sprzątać stolik.',
          );
        }

        const orders = await tx.order.findMany({ where: { tableSessionId: session.id } });
        const served = orders.filter((order) => order.status === 'served');
        if (served.length > 0) {
          throw new ConflictException(
            'Zamówienie zostało już wydane — rozlicz rachunek zamiast sprzątać stolik.',
          );
        }

        for (const order of orders) {
          if (isTerminal(order.status)) continue;
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'canceled', paymentStatus: 'not_required' },
          });
          await tx.orderEvent.create({
            data: {
              organizationId: staff.organizationId,
              orderId: order.id,
              type: 'canceled',
              actorType: 'staff',
              actorStaffId: staff.staffId,
              before: { status: order.status } as Prisma.InputJsonValue,
              after: { status: 'canceled' } as Prisma.InputJsonValue,
              reason,
            },
          });
        }

        // Uczestnicy odchodzą, ale wierszy nie kasujemy: historia zamówień,
        // nawet anulowanych, wskazuje na nich i ma zostać czytelna.
        await tx.tableParticipant.updateMany({
          where: { tableSessionId: session.id, leftAt: null },
          data: { leftAt: new Date() },
        });
        await tx.guestSession.updateMany({
          where: { tableSessionId: session.id },
          data: { expiresAt: new Date() },
        });

        await tx.tableSession.update({
          where: { id: session.id },
          data: {
            status: 'abandoned',
            subtotalCents: 0,
            vatCents: 0,
            totalCents: 0,
            closedAt: new Date(),
            closedByStaffId: staff.staffId,
          },
        });

        this.guests.publish(session.id, { kind: 'orders' });
      }

      await this.closeOpenCalls(tx, table.id, staff.staffId);
      return this.block(tx, staff, table.id, reason);
    });
  }

  /**
   * Usunięcie jednego gościa — ktoś kliknął kod przez przypadek i wyszedł.
   *
   * Znika z listy wizyty, ale jego pozycje na rachunku zostają: rachunek, z którego
   * da się po cichu wymazać, komu co przypisano, przestaje być weryfikowalny.
   */
  async removeParticipant(staff: StaffContext, sessionId: string, participantId: string) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const session = await tx.tableSession.findFirst({
        where: { id: sessionId, restaurantId: this.restaurantOf(staff) },
      });
      if (!session) {
        throw new NotFoundException('Wizyta nie istnieje.');
      }

      const participant = await tx.tableParticipant.findFirst({
        where: { id: participantId, tableSessionId: session.id, leftAt: null },
      });
      if (!participant) {
        throw new NotFoundException('Gość nie należy do tej wizyty.');
      }

      await tx.tableParticipant.update({
        where: { id: participant.id },
        data: { leftAt: new Date(), settlementGroupId: null },
      });
      await tx.guestSession.updateMany({
        where: { participantId: participant.id },
        data: { expiresAt: new Date() },
      });

      // Rola hosta musi mieć właściciela: to do niego trafia nierozdzielony grosz
      // przy podziale rachunku i on jest domyślnym płatnikiem.
      if (participant.isHost) {
        const nastepny = await tx.tableParticipant.findFirst({
          where: { tableSessionId: session.id, leftAt: null },
          orderBy: { joinedAt: 'asc' },
        });
        if (nastepny) {
          await tx.tableParticipant.update({
            where: { id: nastepny.id },
            data: { isHost: true },
          });
        }
      }

      this.guests.publish(session.id, { kind: 'orders' });

      const pozostali = await tx.tableParticipant.findMany({
        where: { tableSessionId: session.id, leftAt: null },
        orderBy: [{ isHost: 'desc' }, { joinedAt: 'asc' }],
        select: { id: true, displayName: true, symbol: true, color: true, isHost: true },
      });
      return { sessionId: session.id, participants: pozostali };
    });
  }

  /** Ręczna blokada. Kuchnia jej nie dotyka — nie stoi przy stolikach. */
  async blockTable(staff: StaffContext, tableId: string, reason?: string) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const table = await this.loadTable(tx, staff, tableId);
      return this.block(tx, staff, table.id, reason);
    });
  }

  /**
   * Otwarcie stolika dla gości — jedna decyzja, więc jedna akcja.
   *
   * Zdejmuje blokadę **i** zakłada wizytę, jeśli jeszcze jej nie ma. Samo zdjęcie
   * blokady nie wystarczało: przy włączonej aktywacji przez obsługę gość po skanie
   * i tak trafiał na „poproś obsługę", bo wizyty nikt nie otworzył, a obsługa nie
   * miała czym jej otworzyć. Zamyka też zgłoszenie gościa, żeby nie zostawało
   * w kolejce jako niezałatwione.
   */
  async openTable(staff: StaffContext, tableId: string) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const table = await this.loadTable(tx, staff, tableId);
      const restaurant = await tx.restaurant.findUniqueOrThrow({
        where: { id: table.restaurantId },
      });

      await tx.table.update({ where: { id: table.id }, data: { blockedUntil: null } });
      await this.closeOpenCalls(tx, table.id, staff.staffId, 'open_table');

      let session = await tx.tableSession.findFirst({
        where: { tableId: table.id, status: { in: ['open', 'awaiting_settlement'] } },
        orderBy: { openedAt: 'desc' },
      });

      if (!session) {
        const businessDate = businessDateFor(
          new Date(),
          restaurant.timezone,
          restaurant.businessDayStartHour,
        );
        session = await tx.tableSession.create({
          data: {
            organizationId: staff.organizationId,
            restaurantId: restaurant.id,
            tableId: table.id,
            businessDate: toDateColumn(businessDate),
            sessionNumber: await this.counters.next(tx, {
              organizationId: staff.organizationId,
              restaurantId: restaurant.id,
              businessDate,
              scope: 'table_session',
            }),
            openedBy: 'staff',
            openedByStaffId: staff.staffId,
            currency: restaurant.currency,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: staff.organizationId,
          actorStaffId: staff.staffId,
          action: 'table.opened',
          entity: 'Table',
          entityId: table.id,
          payload: { tableSessionId: session.id } as Prisma.InputJsonValue,
        },
      });

      return {
        id: table.id,
        label: table.label,
        blockedUntil: null,
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
      };
    });
  }

  private async block(
    tx: Prisma.TransactionClient,
    staff: StaffContext,
    tableId: string,
    reason?: string,
  ) {
    const blockedUntil = TableLifecycleService.blockUntil();
    const updated = await tx.table.update({
      where: { id: tableId },
      data: { blockedUntil },
    });

    await tx.auditLog.create({
      data: {
        organizationId: staff.organizationId,
        actorStaffId: staff.staffId,
        action: 'table.blocked',
        entity: 'Table',
        entityId: tableId,
        payload: { blockedUntil, reason: reason ?? null } as Prisma.InputJsonValue,
      },
    });

    return { id: updated.id, label: updated.label, blockedUntil: updated.blockedUntil };
  }

  private async loadTable(tx: Prisma.TransactionClient, staff: StaffContext, tableId: string) {
    const table = await tx.table.findFirst({
      where: { id: tableId, restaurantId: this.restaurantOf(staff) },
    });
    if (!table) {
      throw new NotFoundException('Stolik nie istnieje.');
    }
    return table;
  }

  private async closeOpenCalls(
    tx: Prisma.TransactionClient,
    tableId: string,
    staffId: string,
    reason?: 'open_table',
  ): Promise<void> {
    await tx.waiterCall.updateMany({
      where: {
        tableId,
        status: { in: ['open', 'acknowledged'] },
        ...(reason ? { reason } : {}),
      },
      data: { status: 'resolved', resolvedAt: new Date(), acknowledgedByStaffId: staffId },
    });
  }
}
