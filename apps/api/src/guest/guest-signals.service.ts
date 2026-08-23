import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { SplitMode } from '@kelbroo/types';
import { PrismaService } from '../prisma/prisma.service';
import { SplitService } from '../staff/split.service';
import { StaffSignalsGateway } from '../realtime/staff-signals.gateway';
import { GuestGateway } from '../realtime/guest.gateway';

export type CallReason = 'help' | 'bill' | 'water' | 'open_table' | 'other';

/**
 * Sygnały od gościa do obsługi: wezwanie kelnera i prośba o rachunek.
 *
 * Do tej pory gość musiał złapać kelnera wzrokiem. Wezwanie jest zapisem w bazie,
 * nie tylko powiadomieniem — po zgubionym połączeniu albo przeładowanym tablecie
 * nadal widać, że ktoś czeka.
 */
@Injectable()
export class GuestSignalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly split: SplitService,
    private readonly signals: StaffSignalsGateway,
    private readonly visits: GuestGateway,
  ) {}

  /**
   * Aktywne wezwania tego stolika.
   *
   * Gość musi widzieć, czy jego zgłoszenie tylko poszło, czy ktoś je już przyjął —
   * bez tego przycisk kłamałby, twierdząc „kelner idzie", zanim ktokolwiek to
   * potwierdził. Stan pochodzi z bazy, więc przeżywa przeładowanie strony.
   */
  async activeCalls(organizationId: string, guestSessionId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const guestSession = await tx.guestSession.findUnique({ where: { id: guestSessionId } });
      if (!guestSession) {
        throw new BadRequestException('Sesja gościa wygasła — zeskanuj kod QR ponownie.');
      }

      const calls = await tx.waiterCall.findMany({
        where: {
          tableSessionId: guestSession.tableSessionId,
          status: { in: ['open', 'acknowledged'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      return calls.map((call) => ({
        id: call.id,
        reason: call.reason,
        status: call.status,
      }));
    });
  }

  /**
   * Prośba o otwarcie zablokowanego stolika.
   *
   * Osobno od wezwania kelnera, bo gość nie ma tu jeszcze sesji — stolik jest
   * zamknięty właśnie po to, żeby jej nie zakładał. Zgłoszenie wisi na stoliku,
   * nie na wizycie.
   */
  async requestTableOpen(qrToken: string) {
    // Skan QR jest z definicji bez kontekstu tenanta, a poza `withTenant` rola
    // aplikacyjna nie widzi ani jednego wiersza. Organizację ustala wąska
    // funkcja SECURITY DEFINER — tą samą drogą, co wejście po kodzie QR.
    const located = await this.prisma.$queryRaw<
      { organization_id: string; restaurant_id: string; table_id: string }[]
    >`SELECT * FROM app.resolve_qr_token(${qrToken})`;

    const table = located[0];
    if (!table) {
      throw new BadRequestException('Nieaktywny lub nieznany kod QR.');
    }

    return this.prisma.withTenant(table.organization_id, async (tx) => {
      const existing = await tx.waiterCall.findFirst({
        where: {
          tableId: table.table_id,
          reason: 'open_table',
          status: { in: ['open', 'acknowledged'] },
        },
      });
      if (existing) {
        return { status: existing.status };
      }

      const call = await tx.waiterCall.create({
        data: {
          organizationId: table.organization_id,
          restaurantId: table.restaurant_id,
          tableId: table.table_id,
          reason: 'open_table',
        },
      });

      const row = await tx.table.findUniqueOrThrow({
        where: { id: table.table_id },
        select: { label: true },
      });
      this.signals.publishWaiterCall(table.restaurant_id, {
        callId: call.id,
        tableLabel: row.label,
        reason: 'open_table',
      });

      return { status: call.status };
    });
  }

  /** Wezwanie kelnera. Powtórzone przy otwartym zgłoszeniu nie tworzy drugiego. */
  async call(organizationId: string, guestSessionId: string, reason: CallReason) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const guestSession = await tx.guestSession.findUnique({
        where: { id: guestSessionId },
        include: { tableSession: true },
      });
      if (!guestSession) {
        throw new BadRequestException('Sesja gościa wygasła — zeskanuj kod QR ponownie.');
      }

      const existing = await tx.waiterCall.findFirst({
        where: {
          tableSessionId: guestSession.tableSessionId,
          reason,
          status: { in: ['open', 'acknowledged'] },
        },
      });
      if (existing) {
        // Wielokrotne stuknięcie w przycisk nie ma zasypywać kelnera zgłoszeniami.
        return { id: existing.id, status: existing.status, reason: existing.reason };
      }

      const call = await tx.waiterCall.create({
        data: {
          organizationId,
          restaurantId: guestSession.restaurantId,
          tableId: guestSession.tableId,
          tableSessionId: guestSession.tableSessionId,
          guestSessionId: guestSession.id,
          reason,
        },
      });

      const table = await tx.table.findUniqueOrThrow({
        where: { id: guestSession.tableId },
        select: { label: true },
      });

      this.signals.publishWaiterCall(guestSession.restaurantId, {
        callId: call.id,
        tableLabel: table.label,
        reason,
      });

      return { id: call.id, status: call.status, reason: call.reason };
    });
  }

  /**
   * Wycofanie wezwania — gość stuknął w przycisk i zaraz się rozmyślił.
   *
   * Wyłącznie dopóki nikt zgłoszenia nie przyjął: kelner, który już idzie przez
   * salę, nie może zniknąć z ekranu gościa, bo za chwilę przy nim stanie.
   * Zapisujemy `canceled`, nie `resolved` — nikt niczego nie załatwił.
   */
  async cancelCall(organizationId: string, guestSessionId: string, reason: CallReason) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const guestSession = await tx.guestSession.findUnique({ where: { id: guestSessionId } });
      if (!guestSession) {
        throw new BadRequestException('Sesja gościa wygasła — zeskanuj kod QR ponownie.');
      }

      const call = await tx.waiterCall.findFirst({
        where: {
          tableSessionId: guestSession.tableSessionId,
          reason,
          status: { in: ['open', 'acknowledged'] },
        },
      });
      if (!call) {
        // Nie ma czego wycofywać — stan po tej operacji i tak jest ten oczekiwany.
        return { canceled: false as const };
      }
      if (call.status === 'acknowledged') {
        throw new ConflictException('Kelner już idzie — tego zgłoszenia nie da się wycofać.');
      }

      await tx.waiterCall.update({
        where: { id: call.id },
        data: { status: 'canceled', resolvedAt: new Date() },
      });

      // Panel ma zdjąć zgłoszenie z kolejki, a pozostałe telefony przy stoliku
      // odświeżyć swój przycisk — wezwanie jest wspólne dla całej wizyty.
      this.signals.publishWaiterCall(guestSession.restaurantId, {
        callId: call.id,
        tableLabel: '',
        reason,
      });
      this.visits.publish(guestSession.tableSessionId, { kind: 'call' });

      return { canceled: true as const };
    });
  }

  /**
   * Prośba o rachunek z wyborem podziału.
   *
   * Wybór gościa przechodzi tą samą ścieżką co ustawienie podziału przez kelnera,
   * więc obowiązuje ten sam niezmiennik. `groups` zostaje po stronie panelu —
   * kto z kim płaci, wie kelner przy stoliku, nie aplikacja.
   */
  async requestBill(
    organizationId: string,
    guestSessionId: string,
    splitMode: Extract<SplitMode, 'none' | 'per_person' | 'equal'>,
  ) {
    const guestSession = await this.prisma.withTenant(organizationId, async (tx) => {
      const found = await tx.guestSession.findUnique({
        where: { id: guestSessionId },
        include: { tableSession: true },
      });
      if (!found) {
        throw new BadRequestException('Sesja gościa wygasła — zeskanuj kod QR ponownie.');
      }
      if (found.tableSession.status === 'closed' || found.tableSession.status === 'settled') {
        throw new ConflictException('Rachunek jest już rozliczony.');
      }
      return found;
    });

    const plan = await this.split.setModeForGuest(
      organizationId,
      guestSession.tableSessionId,
      splitMode,
    );

    // Rachunek zamyka wyłącznie personel — prośba gościa przestawia wizytę
    // w oczekiwanie na rozliczenie, nigdy nie oznacza jej jako zapłaconej.
    await this.prisma.withTenant(organizationId, async (tx) => {
      await tx.tableSession.update({
        where: { id: guestSession.tableSessionId },
        data: { status: 'awaiting_settlement' },
      });
    });

    await this.call(organizationId, guestSessionId, 'bill');

    return {
      splitMode: plan.splitMode,
      totalCents: plan.totalCents,
      currency: plan.currency,
      groups: plan.groups.map((group) => ({
        label: group.label,
        totalCents: group.totalCents,
        members: group.members.map((member) => member.displayName),
      })),
    };
  }
}
