import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MoneySplitError, type SplitMode } from '@kelbroo/types';
import { PrismaService } from '../prisma/prisma.service';
import { planSplit, type SplitGroupInput } from './split-plan';
import { TableLifecycleService } from './table-lifecycle.service';
import type { StaffContext } from '../auth/auth.types';
import type { OfflineMethod } from './staff-sessions.service';

/**
 * Podział rachunku wizyty.
 *
 * `TableSession` jest jednostką rachunku, więc podział jest funkcją wizyty, nie
 * zamówienia — kilka zamówień i kilka telefonów składa się na jeden rachunek.
 * Grupa rozliczeniowa jest jednostką płatności; `per_person` to grupy jednoosobowe.
 *
 * Kwoty przeliczamy przy każdym odczycie, dopóki nikt nie zapłacił. Po pierwszej
 * płatności podział jest zamrożony: przeliczenie kwoty komuś, kto już zapłacił,
 * oznaczałoby cichą zmianę rachunku po fakcie.
 */
@Injectable()
export class SplitService {
  constructor(private readonly prisma: PrismaService) {}

  private restaurantOf(staff: StaffContext): string {
    if (!staff.restaurantId) {
      throw new ForbiddenException('Konto nie jest przypisane do lokalu.');
    }
    return staff.restaurantId;
  }

  /** Aktualny podział wizyty, przeliczony jeśli jeszcze nikt nie zapłacił. */
  async get(staff: StaffContext, sessionId: string) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const session = await this.load(tx, staff, sessionId);
      if (session.splitMode !== 'none' && !(await this.hasPayments(tx, session.id))) {
        await this.recompute(tx, session.id, session.splitMode, session.totalCents);
      }
      return this.view(tx, session.id);
    });
  }

  /**
   * Ustawia tryb podziału i skład grup.
   *
   * `per_person` i `equal` tworzą grupy automatycznie — po jednej na gościa.
   * `groups` przyjmuje skład od kelnera, bo tylko on wie, kto z kim płaci.
   */
  async setMode(
    staff: StaffContext,
    sessionId: string,
    dto: { splitMode: SplitMode; groups?: { label?: string; participantIds: string[] }[] },
  ) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const session = await this.load(tx, staff, sessionId);
      return this.applyMode(tx, staff.organizationId, 'staff', session, dto);
    });
  }

  /**
   * Wybór podziału zgłoszony przez gościa przy prośbie o rachunek.
   *
   * Gość wybiera spośród trybów, które nie wymagają układania składu grup —
   * `groups` zostaje po stronie kelnera, bo tylko on wie, kto z kim płaci.
   * To ta sama ścieżka co w panelu, więc niezmiennik podziału obowiązuje tak samo.
   */
  async setModeForGuest(
    organizationId: string,
    tableSessionId: string,
    splitMode: Extract<SplitMode, 'none' | 'per_person' | 'equal'>,
  ) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const session = await tx.tableSession.findUnique({ where: { id: tableSessionId } });
      if (!session) {
        throw new NotFoundException('Wizyta nie istnieje.');
      }
      if (session.status === 'closed' || session.status === 'settled') {
        throw new ConflictException('Wizyta jest już rozliczona.');
      }
      return this.applyMode(tx, organizationId, 'guest', session, { splitMode });
    });
  }

  private async applyMode(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actor: 'staff' | 'guest',
    session: { id: string; totalCents: number },
    dto: { splitMode: SplitMode; groups?: { label?: string; participantIds: string[] }[] },
  ) {
    if (await this.hasPayments(tx, session.id)) {
      throw new ConflictException(
        'Rachunek jest już częściowo zapłacony — podziału nie da się zmienić.',
      );
    }

    const participants = await tx.tableParticipant.findMany({
      where: { tableSessionId: session.id, leftAt: null },
      orderBy: [{ isHost: 'desc' }, { joinedAt: 'asc' }],
    });

    // Stary podział znika w całości — grupy są wyliczane od nowa, nie łatane.
    await tx.tableParticipant.updateMany({
      where: { tableSessionId: session.id },
      data: { settlementGroupId: null },
    });
    await tx.settlementGroup.deleteMany({ where: { tableSessionId: session.id } });

    if (dto.splitMode === 'none') {
      await tx.tableSession.update({
        where: { id: session.id },
        data: { splitMode: 'none' },
      });
      return this.view(tx, session.id);
    }

    if (participants.length === 0) {
      throw new BadRequestException(
        'Wizyta nie ma gości — rachunku nie ma na kogo podzielić. Rozlicz go w całości.',
      );
    }

    const requested =
      dto.splitMode === 'groups'
        ? (dto.groups ?? [])
        : participants.map((participant) => ({
            label: participant.displayName,
            participantIds: [participant.id],
          }));

    this.assertCoversEveryone(requested, participants);

    const hostId = participants.find((participant) => participant.isHost)?.id ?? null;
    const created: SplitGroupInput[] = [];

    for (const group of requested) {
      const row = await tx.settlementGroup.create({
        data: {
          organizationId,
          tableSessionId: session.id,
          label: group.label ?? null,
          createdBy: actor,
          // Domyślnym płatnikiem grupy jest jej pierwszy uczestnik.
          payerParticipantId: group.participantIds[0] ?? null,
        },
      });
      await tx.tableParticipant.updateMany({
        where: { id: { in: group.participantIds } },
        data: { settlementGroupId: row.id },
      });
      created.push({
        id: row.id,
        participantIds: group.participantIds,
        hasHost: hostId !== null && group.participantIds.includes(hostId),
      });
    }

    await tx.tableSession.update({
      where: { id: session.id },
      data: { splitMode: dto.splitMode },
    });

    await this.applyPlan(tx, session.id, dto.splitMode, session.totalCents, created);
    return this.view(tx, session.id);
  }

  /**
   * Rozliczenie jednej grupy. Płatność jest zapisem ewidencyjnym — fiskalizacja
   * dzieje się na kasie lokalu, poza kelbroo.
   */
  async settleGroup(
    staff: StaffContext,
    sessionId: string,
    groupId: string,
    method: OfflineMethod,
    reason?: string,
  ) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const session = await this.load(tx, staff, sessionId);
      const group = await tx.settlementGroup.findFirst({
        where: { id: groupId, tableSessionId: session.id },
      });
      if (!group) {
        throw new NotFoundException('Grupa nie należy do tej wizyty.');
      }
      if (group.status === 'paid' || group.status === 'settled') {
        throw new ConflictException('Ta grupa jest już rozliczona.');
      }

      await tx.payment.create({
        data: {
          organizationId: staff.organizationId,
          tableSessionId: session.id,
          settlementGroupId: group.id,
          provider: 'offline',
          method,
          status: 'succeeded',
          amountCents: group.totalCents,
          currency: session.currency,
          paidAt: new Date(),
          collectedByStaffId: staff.staffId,
        },
      });

      await tx.settlementGroup.update({
        where: { id: group.id },
        data: { status: 'settled' },
      });

      const paidAfter = session.paidCents + group.totalCents;
      const fullyPaid = paidAfter >= session.totalCents;

      await tx.tableSession.update({
        where: { id: session.id },
        data: {
          paidCents: paidAfter,
          status: fullyPaid ? 'closed' : 'awaiting_settlement',
          ...(fullyPaid ? { closedAt: new Date(), closedByStaffId: staff.staffId } : {}),
        },
      });

      if (fullyPaid) {
        // Zamknięty rachunek blokuje stolik na chwilę: odświeżenie strony przez
        // gości, którzy właśnie zapłacili, nie może otworzyć kolejnej wizyty,
        // a następni goście nie wejdą w połowie sprzątania.
        await tx.table.update({
          where: { id: session.tableId },
          data: { blockedUntil: TableLifecycleService.blockUntil() },
        });
        await tx.order.updateMany({
          where: { tableSessionId: session.id, status: { notIn: ['rejected', 'canceled'] } },
          data: { paymentStatus: 'settled' },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: staff.organizationId,
          actorStaffId: staff.staffId,
          action: 'session.group_settled',
          entity: 'SettlementGroup',
          entityId: group.id,
          payload: {
            amountCents: group.totalCents,
            method,
            sessionTotalCents: session.totalCents,
            sessionPaidCents: paidAfter,
            reason: reason ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      return this.view(tx, session.id);
    });
  }

  private async load(tx: Prisma.TransactionClient, staff: StaffContext, sessionId: string) {
    const session = await tx.tableSession.findFirst({
      where: { id: sessionId, restaurantId: this.restaurantOf(staff) },
    });
    if (!session) {
      throw new NotFoundException('Wizyta nie istnieje.');
    }
    if (session.status === 'closed' || session.status === 'settled') {
      throw new ConflictException('Wizyta jest już rozliczona.');
    }
    return session;
  }

  private async hasPayments(tx: Prisma.TransactionClient, sessionId: string): Promise<boolean> {
    const count = await tx.payment.count({ where: { tableSessionId: sessionId } });
    return count > 0;
  }

  /** Skład grup musi obejmować każdego gościa dokładnie raz. */
  private assertCoversEveryone(
    groups: { participantIds: string[] }[],
    participants: { id: string }[],
  ): void {
    if (groups.length === 0) {
      throw new BadRequestException('Podział wymaga co najmniej jednej grupy.');
    }

    const seen = new Set<string>();
    for (const group of groups) {
      if (group.participantIds.length === 0) {
        throw new BadRequestException('Grupa bez gości nie ma czego zapłacić.');
      }
      for (const participantId of group.participantIds) {
        if (seen.has(participantId)) {
          throw new BadRequestException('Gość może należeć tylko do jednej grupy.');
        }
        seen.add(participantId);
      }
    }

    const known = new Set(participants.map((participant) => participant.id));
    for (const participantId of seen) {
      if (!known.has(participantId)) {
        throw new BadRequestException('Gość spoza tej wizyty.');
      }
    }
    if (seen.size !== known.size) {
      throw new BadRequestException(
        'Każdy gość musi trafić do jakiejś grupy — inaczej jego część rachunku zniknie.',
      );
    }
  }

  private async recompute(
    tx: Prisma.TransactionClient,
    sessionId: string,
    mode: SplitMode,
    totalCents: number,
  ): Promise<void> {
    const groups = await tx.settlementGroup.findMany({
      where: { tableSessionId: sessionId },
      include: { participants: { select: { id: true, isHost: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (groups.length === 0) return;

    await this.applyPlan(
      tx,
      sessionId,
      mode,
      totalCents,
      groups.map((group) => ({
        id: group.id,
        participantIds: group.participants.map((participant) => participant.id),
        hasHost: group.participants.some((participant) => participant.isHost),
      })),
    );
  }

  private async applyPlan(
    tx: Prisma.TransactionClient,
    sessionId: string,
    mode: SplitMode,
    totalCents: number,
    groups: SplitGroupInput[],
  ): Promise<void> {
    const items = await tx.orderItem.findMany({
      where: {
        order: { tableSessionId: sessionId, status: { notIn: ['rejected', 'canceled'] } },
      },
      select: { forParticipantId: true, unitPriceCents: true, quantity: true },
    });

    const attributedByParticipant: Record<string, number> = {};
    let unattributedCents = 0;
    for (const item of items) {
      const line = item.unitPriceCents * item.quantity;
      if (item.forParticipantId) {
        attributedByParticipant[item.forParticipantId] =
          (attributedByParticipant[item.forParticipantId] ?? 0) + line;
      } else {
        unattributedCents += line;
      }
    }

    let plan;
    try {
      plan = planSplit({ mode, totalCents, groups, attributedByParticipant, unattributedCents });
    } catch (cause) {
      // Błąd podziału jest błędem żądania, nie awarią serwera — kelner ma
      // zobaczyć, co poprawić, a nie „coś poszło nie tak".
      if (cause instanceof MoneySplitError) {
        throw new BadRequestException(cause.message);
      }
      throw cause;
    }

    for (const entry of plan) {
      await tx.settlementGroup.update({
        where: { id: entry.groupId },
        data: { subtotalCents: entry.amountCents, totalCents: entry.amountCents },
      });
    }
  }

  private async view(tx: Prisma.TransactionClient, sessionId: string) {
    const session = await tx.tableSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        table: { select: { label: true } },
        participants: {
          where: { leftAt: null },
          orderBy: [{ isHost: 'desc' }, { joinedAt: 'asc' }],
          select: {
            id: true,
            displayName: true,
            symbol: true,
            color: true,
            isHost: true,
            settlementGroupId: true,
          },
        },
        settlementGroups: {
          orderBy: { createdAt: 'asc' },
          include: {
            participants: { select: { id: true, displayName: true, symbol: true, color: true } },
          },
        },
      },
    });

    return {
      id: session.id,
      number: session.sessionNumber,
      tableLabel: session.table.label,
      status: session.status,
      splitMode: session.splitMode,
      totalCents: session.totalCents,
      paidCents: session.paidCents,
      dueCents: Math.max(0, session.totalCents - session.paidCents),
      currency: session.currency,
      // Po pierwszej płatności kwoty grup są zamrożone.
      locked: session.paidCents > 0,
      participants: session.participants,
      groups: session.settlementGroups.map((group) => ({
        id: group.id,
        label: group.label,
        status: group.status,
        totalCents: group.totalCents,
        members: group.participants,
      })),
    };
  }
}
