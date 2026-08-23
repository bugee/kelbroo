import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GuestGateway } from '../realtime/guest.gateway';
import type { StaffContext } from '../auth/auth.types';

export interface PendingGuest {
  id: string;
  displayName: string;
  symbol: string;
  color: string;
  joinedAt: Date;
}

/**
 * Wpuszczanie gości do wizyty, gdy lokal włączył `hostApprovesGuests`.
 *
 * Stolik jest miejscem publicznym, a kod QR leży na nim na widoku — przy stoliku
 * przy oknie kod odczyta ktoś z chodnika. Host jest jedyną osobą, która wie, kto
 * naprawdę siedzi przy stole, więc to on decyduje. Obsługa może zdecydować
 * zastępczo: host bywa zajęty jedzeniem, a czasem po prostu odchodzi od stolika.
 */
@Injectable()
export class TableAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guests: GuestGateway,
  ) {}

  /** Kolejka oczekujących — widoczna dla hosta i dla panelu. */
  async pending(organizationId: string, tableSessionId: string): Promise<PendingGuest[]> {
    return this.prisma.withTenant(organizationId, (tx) => this.pendingWithin(tx, tableSessionId));
  }

  /** Kolejka dla gościa: wyłącznie host ją widzi i wyłącznie dla swojej wizyty. */
  async pendingForGuest(organizationId: string, guestSessionId: string): Promise<PendingGuest[]> {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const { participant } = await this.loadGuest(tx, guestSessionId);
      if (!participant.isHost) return [];
      return this.pendingWithin(tx, participant.tableSessionId);
    });
  }

  /**
   * Host wpuszcza albo odsyła. Odesłanie to `leftAt`, ta sama droga co usunięcie
   * przez kelnera — wiersz zostaje, żeby historia stolika się zgadzała.
   */
  async decideAsHost(
    organizationId: string,
    guestSessionId: string,
    participantId: string,
    decision: 'approve' | 'reject',
  ) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const { participant: host } = await this.loadGuest(tx, guestSessionId);
      if (!host.isHost) {
        throw new ForbiddenException('Tylko host wizyty wpuszcza gości do stolika.');
      }
      return this.decide(tx, organizationId, host.tableSessionId, participantId, decision, {
        actorParticipantId: host.id,
      });
    }).then((wynik) => this.announce(wynik));
  }

  /** Ta sama decyzja z panelu. Kuchnia nie ma tu wstępu — nie stoi przy stolikach. */
  async decideAsStaff(
    staff: StaffContext,
    sessionId: string,
    participantId: string,
    decision: 'approve' | 'reject',
  ) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const session = await tx.tableSession.findFirst({
        where: { id: sessionId, restaurantId: staff.restaurantId ?? undefined },
      });
      if (!session) {
        throw new NotFoundException('Wizyta nie istnieje.');
      }
      return this.decide(tx, staff.organizationId, session.id, participantId, decision, {
        actorStaffId: staff.staffId,
      });
    }).then((wynik) => this.announce(wynik));
  }

  /**
   * Sygnał leci dopiero po zatwierdzeniu transakcji.
   *
   * Wysłany w środku wyprzedza własny zapis: telefon czekającego gościa wczytuje
   * wizytę od nowa i widzi jeszcze niezatwierdzoną zgodę, po czym nie przychodzi
   * już nic — ekran zostaje zablokowany mimo wpuszczenia.
   */
  private announce<T extends { tableSessionId: string }>(wynik: T): Omit<T, 'tableSessionId'> {
    const { tableSessionId, ...reszta } = wynik;
    this.guests.publish(tableSessionId, { kind: 'access' });
    return reszta;
  }

  private async decide(
    tx: Prisma.TransactionClient,
    organizationId: string,
    tableSessionId: string,
    participantId: string,
    decision: 'approve' | 'reject',
    actor: { actorParticipantId?: string; actorStaffId?: string },
  ) {
    const participant = await tx.tableParticipant.findFirst({
      where: { id: participantId, tableSessionId, leftAt: null },
    });
    if (!participant) {
      throw new NotFoundException('Gość nie czeka przy tym stoliku.');
    }
    if (participant.approvedAt !== null) {
      throw new ConflictException('Ten gość jest już przy stoliku.');
    }

    if (decision === 'approve') {
      await tx.tableParticipant.update({
        where: { id: participant.id },
        data: { approvedAt: new Date() },
      });
    } else {
      await tx.tableParticipant.update({
        where: { id: participant.id },
        data: { leftAt: new Date() },
      });
      await tx.guestSession.updateMany({
        where: { participantId: participant.id },
        data: { expiresAt: new Date() },
      });
    }

    await tx.auditLog.create({
      data: {
        organizationId,
        actorStaffId: actor.actorStaffId ?? null,
        action: decision === 'approve' ? 'participant.approved' : 'participant.rejected',
        entity: 'TableParticipant',
        entityId: participant.id,
        payload: {
          tableSessionId,
          byParticipantId: actor.actorParticipantId ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      tableSessionId,
      id: participant.id,
      displayName: participant.displayName,
      symbol: participant.symbol,
      color: participant.color,
      approved: decision === 'approve',
    };
  }

  private async pendingWithin(
    tx: Prisma.TransactionClient,
    tableSessionId: string,
  ): Promise<PendingGuest[]> {
    return tx.tableParticipant.findMany({
      where: { tableSessionId, leftAt: null, approvedAt: null },
      orderBy: { joinedAt: 'asc' },
      select: { id: true, displayName: true, symbol: true, color: true, joinedAt: true },
    });
  }

  private async loadGuest(tx: Prisma.TransactionClient, guestSessionId: string) {
    const guestSession = await tx.guestSession.findUnique({
      where: { id: guestSessionId },
      include: { participant: true },
    });
    if (!guestSession?.participant) {
      throw new NotFoundException('Sesja gościa wygasła — zeskanuj kod QR ponownie.');
    }
    return { guestSession, participant: guestSession.participant };
  }
}
