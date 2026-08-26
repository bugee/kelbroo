import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OrderingMode } from '@kelbroo/types';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService, type MenuCategoryView } from '../menu/menu.service';
import { DailyCounterService } from '../common/daily-counter.service';
import { businessDateFor, toDateColumn } from '../common/business-date';
import { GuestSessionService } from '../guest/guest-session.service';
import { GuestGateway } from '../realtime/guest.gateway';
import { StaffSignalsGateway } from '../realtime/staff-signals.gateway';
import { generateIdentity } from '../guest/participant-identity';
import { subscriptionActive as czyAbonamentDziala } from '../common/subscription';

export interface EnterOptions {
  requestedLocale?: string;
  acceptLanguage?: string;
  existingGuestToken?: string;
}

export interface TableEntry {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    locale: string;
    supportedLocales: string[];
    orderingMode: OrderingMode;
    tippingEnabled: boolean;
    minOrderCents: number;
    /**
     * Restauracja pokazowa. Gość **musi** to wiedzieć: bez ostrzeżenia ktoś
     * zamawia z przekonaniem, że dostanie jedzenie.
     */
    isDemo: boolean;
  };
  table: { id: string; label: string; zone: string | null };
  session: {
    id: string;
    number: number;
    /** Gość musi wiedzieć, czy może zamawiać — i dlaczego nie może. */
    orderingEnabled: boolean;
    blockedReason:
      | 'subscription_inactive'
      | 'awaiting_staff_activation'
      | 'table_blocked'
      | 'visit_finished'
      | 'awaiting_host_approval'
      | null;
  };
  participant: {
    id: string;
    displayName: string;
    symbol: string;
    color: string;
    isHost: boolean;
    /// `false` znaczy: host jeszcze nie wpuścił. Gość widzi menu, ale nie zamawia.
    approved: boolean;
  };
  /**
   * Wszyscy wpuszczeni przy stoliku, razem z samym pytającym.
   *
   * Rachunek jest wspólny, więc gość musi wiedzieć, z kim go dzieli — także
   * z kimś, kto jeszcze nic nie zamówił. Kto siedzi przy stole, i tak widać
   * gołym okiem; ukrywanie tego przed aplikacją niczego nie chroni.
   */
  participants: {
    id: string;
    displayName: string;
    symbol: string;
    color: string;
    isHost: boolean;
  }[];
  guestToken: string | null;
  menu: MenuCategoryView[];
}

@Injectable()
export class TableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly menu: MenuService,
    private readonly counters: DailyCounterService,
    private readonly guests: GuestSessionService,
    private readonly visits: GuestGateway,
    private readonly staffSignals: StaffSignalsGateway,
  ) {}

  async enter(qrToken: string, options: EnterOptions): Promise<TableEntry> {
    // Skan QR jest z definicji bez kontekstu tenanta — najpierw ustalamy
    // organizację wąską funkcją SECURITY DEFINER, dopiero potem wchodzimy w RLS.
    const located = await this.prisma.$queryRaw<
      { organization_id: string; restaurant_id: string; table_id: string }[]
    >`SELECT * FROM app.resolve_qr_token(${qrToken})`;

    const target = located[0];
    if (!target) {
      throw new NotFoundException('Nieaktywny lub nieznany kod QR.');
    }

    const entry = await this.prisma.withTenant(target.organization_id, async (tx) =>
      this.enterWithinTenant(tx, target, options),
    );

    /**
     * Ktoś właśnie dołączył do stolika — pozostali muszą to zobaczyć sami.
     *
     * Sygnał leci po zatwierdzeniu transakcji — wysłany w środku wyprzedziłby
     * własny zapis i odbiorcy odświeżyliby skład, w którym jeszcze go nie ma.
     *
     * Warunek opisuje **zdarzenie**, nie stan: token wydajemy wyłącznie razem
     * z nowym uczestnikiem, więc `guestToken` niepuste znaczy „ktoś właśnie
     * dołączył", a ponowne wejście tym samym urządzeniem zwraca `null`.
     * Sygnał na sam stan „ktoś czeka" zapętlał wszystkie telefony przy stoliku:
     * każdy odbiorca wczytywał wizytę od nowa, a to wysyłało sygnał ponownie.
     */
    if (entry.guestToken !== null) {
      this.visits.publish(entry.session.id, { kind: 'access' });

      // Do panelu trafia wyłącznie ten, kto utknął w poczekalni — reszta nie
      // wymaga od obsługi żadnej decyzji.
      if (entry.session.blockedReason === 'awaiting_host_approval') {
        this.staffSignals.publishGuestWaiting(target.restaurant_id, {
          participantId: entry.participant.id,
          tableLabel: entry.table.label,
        });
      }
    }

    return entry;
  }

  private async enterWithinTenant(
    tx: Prisma.TransactionClient,
    target: { organization_id: string; restaurant_id: string; table_id: string },
    options: EnterOptions,
  ): Promise<TableEntry> {
    const organizationId = target.organization_id;

    const restaurant = await tx.restaurant.findUnique({ where: { id: target.restaurant_id } });
    const table = await tx.table.findUnique({ where: { id: target.table_id } });
    if (!restaurant || !table) {
      throw new NotFoundException('Nieaktywny lub nieznany kod QR.');
    }

    // Ta sama reguła, którą stosuje panel — jedna definicja „konto jest czynne".
    // Blokada administracyjna liczy się tak samo jak wygasły abonament: gość widzi
    // menu, ale nie zamawia. Nie mówimy mu, który z tych powodów zadziałał —
    // to sprawa między lokalem a nami.
    const [organizacja, subscription] = await Promise.all([
      tx.organization.findUnique({
        where: { id: organizationId },
        select: { blockedAt: true, isDemo: true },
      }),
      tx.subscription.findUnique({ where: { organizationId } }),
    ]);
    const subscriptionActive = czyAbonamentDziala(subscription) && !organizacja?.blockedAt;

    // Flagę doklejamy do obiektu restauracji zamiast przekazywać ją osobnym
    // argumentem przez sześć wywołań — jedno przeoczone i gość zamawia
    // w restauracji pokazowej bez ostrzeżenia.
    const restaurantView = { ...restaurant, isDemo: organizacja?.isDemo ?? false };

    const locale = this.menu.resolveLocale(
      options.requestedLocale,
      options.acceptLanguage,
      restaurant.supportedLocales,
      restaurant.defaultLocale,
    );

    const menu = await this.menu.forRestaurant(tx, restaurant.id, locale, restaurant.defaultLocale);

    // Wygaśnięcie abonamentu wyłącza zamawianie, ale menu zostaje widoczne —
    // gość nie ma wiedzieć, że restauracja nie zapłaciła faktury.
    let openSession = await tx.tableSession.findFirst({
      where: { tableId: table.id, status: { in: ['open', 'awaiting_settlement'] } },
      orderBy: { openedAt: 'desc' },
    });

    /**
     * Wizyta, z którą przyszedł token, jest już rozliczona.
     *
     * Bez tego odświeżenie strony po zapłaceniu zakładało nową wizytę z nowym
     * uczestnikiem — gość, który właśnie zapłacił, stawał się kolejnym gościem
     * przy kolejnym rachunku. Sprawdzamy to przed blokadą, bo ta wygasa po
     * dwóch minutach, a token trzeba rozpoznać także później.
     */
    if (await this.belongsToFinishedVisit(tx, options.existingGuestToken, table.id)) {
      return this.blockedEntry(restaurantView, table, locale, menu, 'visit_finished');
    }

    // Stolik zablokowany: przez obsługę albo automatycznie po zamknięciu rachunku.
    // Gość może wtedy wyłącznie poprosić o otwarcie wizyty.
    if (!openSession && table.blockedUntil && table.blockedUntil > new Date()) {
      return this.blockedEntry(restaurantView, table, locale, menu, 'table_blocked');
    }

    if (!openSession && restaurant.tableActivationRequired) {
      return this.blockedEntry(restaurantView, table, locale, menu, 'awaiting_staff_activation');
    }

    if (!openSession) {
      const businessDate = businessDateFor(
        new Date(),
        restaurant.timezone,
        restaurant.businessDayStartHour,
      );
      const sessionNumber = await this.counters.next(tx, {
        organizationId,
        restaurantId: restaurant.id,
        businessDate,
        scope: 'table_session',
      });

      openSession = await tx.tableSession.create({
        data: {
          organizationId,
          restaurantId: restaurant.id,
          tableId: table.id,
          businessDate: toDateColumn(businessDate),
          sessionNumber,
          openedBy: 'guest',
          currency: restaurant.currency,
        },
      });
    }

    const reused = await this.reuseGuestSession(tx, options.existingGuestToken, openSession.id);
    if (reused) {
      return {
        ...this.baseEntry(restaurantView, table, locale, menu),
        session: {
          id: openSession.id,
          number: openSession.sessionNumber,
          orderingEnabled: subscriptionActive && reused.participant.approved,
          blockedReason: !subscriptionActive
            ? 'subscription_inactive'
            : reused.participant.approved
              ? null
              : 'awaiting_host_approval',
        },
        participant: reused.participant,
        participants: await this.approvedParticipants(tx, openSession.id),
        guestToken: null, // token gościa pozostaje ten, którym przyszedł
      };
    }

    // Generator potrzebuje pełnych tożsamości: nick nie może się powtórzyć,
    // a para symbol + kolor jest tym, czym gość przedstawia się kelnerowi.
    const existing = await tx.tableParticipant.findMany({
      where: { tableSessionId: openSession.id },
      select: { displayName: true, symbol: true, color: true },
    });
    const identity = generateIdentity(existing);
    // Zgody musi mieć kto udzielić. Jeśli przy stoliku nie siedzi już nikt
    // wpuszczony, kolejny skanujący wchodzi jako host — inaczej czekałby
    // w nieskończoność na osobę, która wyszła.
    const obecni = await tx.tableParticipant.count({
      where: { tableSessionId: openSession.id, leftAt: null, approvedAt: { not: null } },
    });
    const awaitsApproval = restaurant.hostApprovesGuests && obecni > 0;

    const participant = await tx.tableParticipant.create({
      data: {
        organizationId,
        tableSessionId: openSession.id,
        displayName: identity.displayName,
        symbol: identity.symbol,
        color: identity.color,
        // Pierwszy skanujący jest hostem: domyślnym płatnikiem i adresatem
        // nierozdzielonych groszy przy podziale rachunku.
        isHost: obecni === 0,
        // Host wchodzi zawsze — gdyby czekał na zgodę, nie miałby jej od kogo
        // dostać i stolik nie dałby się otworzyć.
        approvedAt: awaitsApproval ? null : new Date(),
        createdBy: 'guest',
      },
    });

    const { token, tokenHash } = GuestSessionService.issueToken();
    const now = new Date();
    await tx.guestSession.create({
      data: {
        organizationId,
        restaurantId: restaurant.id,
        tableId: table.id,
        tableSessionId: openSession.id,
        participantId: participant.id,
        tokenHash,
        locale,
        expiresAt: GuestSessionService.expiryFrom(now),
      },
    });

    return {
      ...this.baseEntry(restaurantView, table, locale, menu),
      session: {
        id: openSession.id,
        number: openSession.sessionNumber,
        orderingEnabled: subscriptionActive && !awaitsApproval,
        blockedReason: !subscriptionActive
          ? 'subscription_inactive'
          : awaitsApproval
            ? 'awaiting_host_approval'
            : null,
      },
      participant: {
        id: participant.id,
        displayName: participant.displayName,
        symbol: participant.symbol,
        color: participant.color,
        isHost: participant.isHost,
        approved: !awaitsApproval,
      },
      participants: await this.approvedParticipants(tx, openSession.id),
      guestToken: token,
    };
  }

  /**
   * Czy token gościa należy do wizyty przy tym stoliku, która już się skończyła.
   *
   * Rozpoznajemy własny token, a nie samą obecność otwartej wizyty: gość po
   * zapłaceniu ma zobaczyć „rachunek rozliczony", a nie zostać po cichu wpisany
   * do rachunku następnych gości.
   */
  private async belongsToFinishedVisit(
    tx: Prisma.TransactionClient,
    token: string | undefined,
    tableId: string,
  ): Promise<boolean> {
    if (!token) return false;

    const guestSession = await tx.guestSession.findFirst({
      where: { tokenHash: GuestSessionService.hash(token), tableId },
      orderBy: { createdAt: 'desc' },
      include: { tableSession: { select: { status: true } } },
    });

    const status = guestSession?.tableSession.status;
    return status === 'closed' || status === 'settled' || status === 'abandoned';
  }

  /**
   * Wpuszczeni i wciąż obecni, hostem od góry.
   *
   * Czekających na zgodę tu nie ma: nie są jeszcze przy stoliku, a kolejkę
   * wpuszczania widzi wyłącznie host, osobną drogą.
   */
  private async approvedParticipants(tx: Prisma.TransactionClient, tableSessionId: string) {
    return tx.tableParticipant.findMany({
      where: { tableSessionId, leftAt: null, approvedAt: { not: null } },
      orderBy: [{ isHost: 'desc' }, { joinedAt: 'asc' }],
      select: { id: true, displayName: true, symbol: true, color: true, isHost: true },
    });
  }

  /** Ponowny skan tym samym urządzeniem nie tworzy drugiego uczestnika. */
  private async reuseGuestSession(
    tx: Prisma.TransactionClient,
    token: string | undefined,
    tableSessionId: string,
  ): Promise<{ participant: TableEntry['participant'] } | null> {
    if (!token) return null;

    const guestSession = await tx.guestSession.findFirst({
      where: {
        tokenHash: GuestSessionService.hash(token),
        tableSessionId,
        expiresAt: { gt: new Date() },
      },
      include: { participant: true },
    });

    if (!guestSession?.participant) return null;

    await tx.guestSession.update({
      where: { id: guestSession.id },
      data: { lastSeenAt: new Date() },
    });

    const { participant } = guestSession;
    return {
      participant: {
        id: participant.id,
        displayName: participant.displayName,
        symbol: participant.symbol,
        color: participant.color,
        isHost: participant.isHost,
        approved: participant.approvedAt !== null,
      },
    };
  }

  private baseEntry(
    restaurant: {
      id: string;
      name: string;
      slug: string;
      currency: string;
      supportedLocales: string[];
      orderingMode: string;
      tippingEnabled: boolean;
      minOrderCents: number;
      isDemo: boolean;
    },
    table: { id: string; label: string; zone: string | null },
    locale: string,
    menu: MenuCategoryView[],
  ): Pick<TableEntry, 'restaurant' | 'table' | 'menu'> {
    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        currency: restaurant.currency,
        locale,
        supportedLocales: restaurant.supportedLocales,
        orderingMode: restaurant.orderingMode as OrderingMode,
        tippingEnabled: restaurant.tippingEnabled,
        minOrderCents: restaurant.minOrderCents,
        isDemo: restaurant.isDemo,
      },
      table: { id: table.id, label: table.label, zone: table.zone },
      menu,
    };
  }

  private blockedEntry(
    restaurant: Parameters<TableService['baseEntry']>[0],
    table: Parameters<TableService['baseEntry']>[1],
    locale: string,
    menu: MenuCategoryView[],
    reason: 'awaiting_staff_activation' | 'table_blocked' | 'visit_finished',
  ): TableEntry {
    return {
      ...this.baseEntry(restaurant, table, locale, menu),
      session: { id: '', number: 0, orderingEnabled: false, blockedReason: reason },
      participant: {
        id: '',
        displayName: '',
        symbol: '',
        color: '',
        isHost: false,
        approved: false,
      },
      participants: [],
      guestToken: null,
    };
  }
}
