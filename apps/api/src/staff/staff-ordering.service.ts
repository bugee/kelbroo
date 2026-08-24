import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isTerminal, statusAfterSubmission } from '@kelbroo/types';
import { PrismaService } from '../prisma/prisma.service';
import { DailyCounterService } from '../common/daily-counter.service';
import { businessDateFor, toDateColumn, type BusinessDate } from '../common/business-date';
import { recalculateSessionTotals } from '../common/session-totals';
import { subscriptionActive } from '../common/subscription';
import { MenuService } from '../menu/menu.service';
import {
  OrderPricingService,
  vatFromGross,
  type RequestedItem,
} from '../orders/order-pricing.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import { GuestGateway } from '../realtime/guest.gateway';
import type { StaffContext } from '../auth/auth.types';

/**
 * Zamawianie i edycja w imieniu gościa.
 *
 * Gość bez telefonu, gość który woli zamówić ustnie, pomyłka do poprawienia przy
 * stoliku — bez tego kelner nie ma jak nic zrobić. Wymóg nadrzędny z
 * docs/product.md §5: w każdym momencie musi być widoczne, co dodał gość, a co
 * obsługa. Dlatego każda pozycja niesie trzy niezależne atrybucje, a każda zmiana
 * dopisuje się do append-only `OrderEvent` — nigdy go nie nadpisujemy.
 */
@Injectable()
export class StaffOrderingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: DailyCounterService,
    private readonly pricing: OrderPricingService,
    private readonly menu: MenuService,
    private readonly gateway: OrdersGateway,
    private readonly guests: GuestGateway,
  ) {}

  /**
   * Bramka abonamentowa dla panelu.
   *
   * Wygaśnięcie abonamentu zatrzymuje **przyjmowanie nowych zamówień**, a nie
   * cały panel. Rozliczanie otwartych rachunków, wydawanie z kuchni i zamykanie
   * wizyt zostaje dostępne — lokal, któremu abonament skończył się w środku
   * serwisu, musi móc dokończyć to, co już przyjął, i wziąć za to pieniądze.
   * Zablokowanie rozliczeń uwięziłoby gotówkę w systemie i zrobiłoby z awarii
   * płatności awarię lokalu.
   */
  private async wymagajAbonamentu(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<void> {
    const subscription = await tx.subscription.findUnique({ where: { organizationId } });
    if (subscriptionActive(subscription)) return;

    throw new ForbiddenException(
      'Abonament wygasł — nowe zamówienia są wstrzymane. Otwarte rachunki możesz rozliczyć normalnie.',
    );
  }

  private restaurantOf(staff: StaffContext): string {
    if (!staff.restaurantId) {
      throw new ForbiddenException('Konto nie jest przypisane do lokalu.');
    }
    return staff.restaurantId;
  }

  /** Stoliki do wyboru przy zamawianiu — z otwartą wizytą i jej uczestnikami. */
  async tables(staff: StaffContext) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const tables = await tx.table.findMany({
        where: { restaurantId: this.restaurantOf(staff), isActive: true },
        orderBy: [{ zone: 'asc' }, { label: 'asc' }],
        include: {
          tableSessions: {
            where: { status: 'open' },
            orderBy: { openedAt: 'desc' },
            take: 1,
            include: {
              participants: {
                // Kelner zamawia za tych, którzy siedzą przy stoliku, nie za
                // tych, którzy już wyszli albo czekają na wpuszczenie.
                where: { leftAt: null, approvedAt: { not: null } },
                orderBy: [{ isHost: 'desc' }, { joinedAt: 'asc' }],
                select: { id: true, displayName: true, symbol: true, color: true, isHost: true },
              },
            },
          },
        },
      });

      return tables.map((table) => {
        const session = table.tableSessions[0];
        return {
          id: table.id,
          label: table.label,
          zone: table.zone,
          openSession: session
            ? {
                id: session.id,
                number: session.sessionNumber,
                totalCents: session.totalCents,
                participants: session.participants,
              }
            : null,
        };
      });
    });
  }

  /** Karta w języku domyślnym lokalu — kelner wybiera z tej samej co gość. */
  async menuForOrdering(staff: StaffContext) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const restaurant = await tx.restaurant.findUniqueOrThrow({
        where: { id: this.restaurantOf(staff) },
      });
      return {
        currency: restaurant.currency,
        categories: await this.menu.forRestaurant(
          tx,
          restaurant.id,
          restaurant.defaultLocale,
          restaurant.defaultLocale,
        ),
      };
    });
  }

  async createOnBehalf(
    staff: StaffContext,
    dto: { tableId: string; forParticipantId?: string; note?: string; items: RequestedItem[] },
  ) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      await this.wymagajAbonamentu(tx, staff.organizationId);
      const restaurantId = this.restaurantOf(staff);
      const table = await tx.table.findFirst({ where: { id: dto.tableId, restaurantId } });
      if (!table) {
        throw new NotFoundException('Stolik nie istnieje.');
      }

      const restaurant = await tx.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
      const businessDate = businessDateFor(
        new Date(),
        restaurant.timezone,
        restaurant.businessDayStartHour,
      );

      const session = await this.openSessionFor(tx, {
        staff,
        restaurant,
        tableId: table.id,
        businessDate,
      });

      if (dto.forParticipantId) {
        const participant = await tx.tableParticipant.findFirst({
          where: { id: dto.forParticipantId, tableSessionId: session.id },
        });
        if (!participant) {
          throw new BadRequestException('Ten gość nie należy do tej wizyty.');
        }
      }

      const priced = await this.pricing.price(tx, {
        restaurantId,
        currency: restaurant.currency,
        locale: restaurant.defaultLocale,
        defaultLocale: restaurant.defaultLocale,
        items: dto.items,
      });

      // Minimalna wartość zamówienia dotyczy gościa zamawiającego z telefonu.
      // Kelner stoi przy stoliku i widzi rachunek — blokowanie go tutaj tylko
      // przeszkadzałoby w dołożeniu jednej kawy.
      const status = statusAfterSubmission({
        orderingMode: restaurant.orderingMode,
        requireStaffConfirmation: restaurant.requireStaffConfirmation,
        paymentConfirmed: false,
        placedByStaff: true,
        openBillLimitExceeded: false,
      });

      const orderNumber = await this.counters.next(tx, {
        organizationId: staff.organizationId,
        restaurantId,
        businessDate,
        scope: 'order',
      });

      const order = await tx.order.create({
        data: {
          organizationId: staff.organizationId,
          restaurantId,
          tableId: table.id,
          tableSessionId: session.id,
          businessDate: toDateColumn(businessDate),
          orderNumber,
          source: 'staff',
          createdByStaffId: staff.staffId,
          status,
          // Kelner stoi przy stoliku, więc zamówienie jest potwierdzone od razu.
          ...(status === 'confirmed'
            ? { confirmedAt: new Date(), confirmedByStaffId: staff.staffId }
            : {}),
          paymentStatus:
            restaurant.orderingMode === 'prepaid' ? 'awaiting_payment' : 'awaiting_settlement',
          subtotalCents: priced.subtotalCents,
          vatCents: priced.vatCents,
          totalCents: priced.subtotalCents,
          currency: restaurant.currency,
          guestNote: dto.note ?? null,
          items: {
            create: priced.items.map((item) => ({
              organizationId: staff.organizationId,
              menuItemId: item.menuItemId,
              nameSnapshot: item.name,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              vatRate: item.vatRate,
              modifiersSnapshot: item.modifiers as unknown as Prisma.InputJsonValue,
              itemNote: item.note,
              forParticipantId: dto.forParticipantId ?? null,
              addedBy: 'staff',
              addedByStaffId: staff.staffId,
            })),
          },
        },
        include: ORDER_DETAIL,
      });

      await this.record(tx, staff, order.id, null, 'created', null, {
        status,
        orderNumber,
        totalCents: priced.subtotalCents,
        items: priced.items.map((item) => ({ name: item.name, quantity: item.quantity })),
      });

      await recalculateSessionTotals(tx, session.id);
      this.announce(order);
      return toDetailView(order);
    });
  }

  async addItems(staff: StaffContext, orderId: string, dto: { items: RequestedItem[] }) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      await this.wymagajAbonamentu(tx, staff.organizationId);
      const order = await this.loadEditable(tx, staff, orderId);
      const restaurant = await tx.restaurant.findUniqueOrThrow({
        where: { id: order.restaurantId },
      });

      const priced = await this.pricing.price(tx, {
        restaurantId: order.restaurantId,
        currency: restaurant.currency,
        locale: restaurant.defaultLocale,
        defaultLocale: restaurant.defaultLocale,
        items: dto.items,
      });

      for (const item of priced.items) {
        const created = await tx.orderItem.create({
          data: {
            organizationId: staff.organizationId,
            orderId: order.id,
            menuItemId: item.menuItemId,
            nameSnapshot: item.name,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            vatRate: item.vatRate,
            modifiersSnapshot: item.modifiers as unknown as Prisma.InputJsonValue,
            itemNote: item.note,
            // Pozycja dołożona do cudzego zamówienia dziedziczy adresata po
            // zamówieniu; kto ją dodał, zapisuje się osobno.
            forParticipantId: order.createdByParticipantId,
            addedBy: 'staff',
            addedByStaffId: staff.staffId,
          },
        });

        await this.record(tx, staff, order.id, created.id, 'item_added', null, {
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        });
      }

      return this.settleTotals(tx, staff, order.id, order.tableSessionId);
    });
  }

  async changeQuantity(staff: StaffContext, orderId: string, itemId: string, quantity: number) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const order = await this.loadEditable(tx, staff, orderId);
      const item = order.items.find((candidate) => candidate.id === itemId);
      if (!item) {
        throw new NotFoundException('Pozycja nie należy do tego zamówienia.');
      }
      if (item.quantity === quantity) {
        return toDetailView(order);
      }

      // Bramka dopiero tutaj, bo liczy się **kierunek** zmiany, a ten znamy
      // po wczytaniu pozycji. Zmniejszenie to poprawianie pomyłki na rachunku,
      // który już powstał — nie nowa praca do opłacenia.
      if (quantity > item.quantity) {
        await this.wymagajAbonamentu(tx, staff.organizationId);
      }

      await tx.orderItem.update({
        where: { id: item.id },
        data: {
          quantity,
          lastEditedBy: 'staff',
          lastEditedByStaffId: staff.staffId,
          lastEditedAt: new Date(),
        },
      });

      await this.record(
        tx,
        staff,
        order.id,
        item.id,
        'quantity_changed',
        { name: item.nameSnapshot, quantity: item.quantity },
        { name: item.nameSnapshot, quantity },
      );

      return this.settleTotals(tx, staff, order.id, order.tableSessionId);
    });
  }

  async removeItem(staff: StaffContext, orderId: string, itemId: string, reason?: string) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const order = await this.loadEditable(tx, staff, orderId);
      const item = order.items.find((candidate) => candidate.id === itemId);
      if (!item) {
        throw new NotFoundException('Pozycja nie należy do tego zamówienia.');
      }
      if (order.items.length === 1) {
        throw new BadRequestException(
          'Nie da się usunąć ostatniej pozycji — anuluj całe zamówienie.',
        );
      }

      // Zdarzenie zapisujemy PRZED skasowaniem: `order_item_id` ma `ON DELETE SET NULL`,
      // więc po usunięciu pozycji historia straciłaby wskazanie, czego dotyczyła.
      await this.record(
        tx,
        staff,
        order.id,
        item.id,
        'item_removed',
        { name: item.nameSnapshot, quantity: item.quantity },
        null,
        reason,
      );
      await tx.orderItem.delete({ where: { id: item.id } });

      return this.settleTotals(tx, staff, order.id, order.tableSessionId);
    });
  }

  /** Historia zamówienia — źródło prawdy o tym, kto co zrobił i kiedy. */
  async history(staff: StaffContext, orderId: string) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, restaurantId: this.restaurantOf(staff) },
      });
      if (!order) {
        throw new NotFoundException('Zamówienie nie istnieje.');
      }

      const events = await tx.orderEvent.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
        include: {
          actorStaff: { select: { name: true } },
          actorParticipant: { select: { displayName: true } },
        },
      });

      return events.map((event) => ({
        id: event.id,
        type: event.type,
        at: event.createdAt,
        actorType: event.actorType,
        // Gość widnieje pod nickiem z wizyty, obsługa pod imieniem z konta.
        actorName: event.actorStaff?.name ?? event.actorParticipant?.displayName ?? null,
        before: event.before,
        after: event.after,
        reason: event.reason,
      }));
    });
  }

  private async openSessionFor(
    tx: Prisma.TransactionClient,
    context: {
      staff: StaffContext;
      restaurant: { id: string; currency: string };
      tableId: string;
      businessDate: BusinessDate;
    },
  ) {
    const existing = await tx.tableSession.findFirst({
      where: { tableId: context.tableId, status: 'open' },
      orderBy: { openedAt: 'desc' },
    });
    if (existing) return existing;

    const sessionNumber = await this.counters.next(tx, {
      organizationId: context.staff.organizationId,
      restaurantId: context.restaurant.id,
      businessDate: context.businessDate,
      scope: 'table_session',
    });

    return tx.tableSession.create({
      data: {
        organizationId: context.staff.organizationId,
        restaurantId: context.restaurant.id,
        tableId: context.tableId,
        businessDate: toDateColumn(context.businessDate),
        sessionNumber,
        // Wizytę otworzył kelner, nie skan kodu QR.
        openedBy: 'staff',
        openedByStaffId: context.staff.staffId,
        currency: context.restaurant.currency,
      },
    });
  }

  /**
   * Zamówienie, które wolno jeszcze zmieniać.
   *
   * Wydane i zamknięte są poza zasięgiem: rachunek gościa nie może się zmienić
   * po tym, jak talerz stanął na stole. Poprawka po tym momencie to anulowanie
   * z powodem, nie cicha edycja.
   */
  private async loadEditable(tx: Prisma.TransactionClient, staff: StaffContext, orderId: string) {
    const order = await tx.order.findFirst({
      where: { id: orderId, restaurantId: this.restaurantOf(staff) },
      include: ORDER_DETAIL,
    });
    if (!order) {
      throw new NotFoundException('Zamówienie nie istnieje.');
    }
    if (isTerminal(order.status) || order.status === 'served') {
      throw new ConflictException('Tego zamówienia nie da się już zmienić.');
    }
    return order;
  }

  /** Sumy zamówienia liczone z pozycji, sumy wizyty z zamówień. */
  private async settleTotals(
    tx: Prisma.TransactionClient,
    staff: StaffContext,
    orderId: string,
    tableSessionId: string,
  ) {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const vatCents = items.reduce(
      (sum, item) => sum + vatFromGross(item.unitPriceCents * item.quantity, item.vatRate),
      0,
    );

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { subtotalCents, vatCents, totalCents: subtotalCents },
      include: ORDER_DETAIL,
    });

    await recalculateSessionTotals(tx, tableSessionId);
    this.announce(updated);
    return toDetailView(updated);
  }

  private async record(
    tx: Prisma.TransactionClient,
    staff: StaffContext,
    orderId: string,
    orderItemId: string | null,
    type: 'created' | 'item_added' | 'item_removed' | 'quantity_changed',
    before: unknown,
    after: unknown,
    reason?: string,
  ) {
    await tx.orderEvent.create({
      data: {
        organizationId: staff.organizationId,
        orderId,
        orderItemId,
        type,
        actorType: 'staff',
        actorStaffId: staff.staffId,
        before: (before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        after: (after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        reason: reason ?? null,
      },
    });
  }

  private announce(order: Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL }>): void {
    // Pozycja dołożona przez kelnera ma pojawić się na telefonie gościa sama.
    this.guests.publish(order.tableSessionId, { kind: 'orders' });
    this.gateway.publish(order.restaurantId, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      tableLabel: order.table.label,
      reason: 'status_changed',
    });
  }
}

const ORDER_DETAIL = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      addedByStaff: { select: { name: true } },
      lastEditedByStaff: { select: { name: true } },
      forParticipant: { select: { displayName: true, symbol: true, color: true } },
    },
  },
  table: { select: { label: true } },
  createdByStaff: { select: { name: true } },
  createdByParticipant: { select: { displayName: true, symbol: true, color: true } },
} satisfies Prisma.OrderInclude;

function toDetailView(order: Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL }>) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    tableLabel: order.table.label,
    source: order.source,
    placedByStaffName: order.createdByStaff?.name ?? null,
    guestName: order.createdByParticipant?.displayName ?? null,
    subtotalCents: order.subtotalCents,
    vatCents: order.vatCents,
    totalCents: order.totalCents,
    currency: order.currency,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.nameSnapshot,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.unitPriceCents * item.quantity,
      note: item.itemNote,
      modifiers: (item.modifiersSnapshot as unknown as { name: string }[]).map((m) => m.name),
      // Trzy atrybucje z docs/architecture.md §13.1 — zwykle trzy różne osoby.
      addedByStaff: item.addedBy === 'staff',
      addedByName: item.addedByStaff?.name ?? null,
      forGuestName: item.forParticipant?.displayName ?? null,
      forGuestSymbol: item.forParticipant?.symbol ?? null,
      forGuestColor: item.forParticipant?.color ?? null,
      lastEditedByName: item.lastEditedByStaff?.name ?? null,
      lastEditedAt: item.lastEditedAt,
    })),
  };
}
