import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusAfterSubmission } from '@kelbroo/types';
import { PrismaService } from '../prisma/prisma.service';
import { DailyCounterService } from '../common/daily-counter.service';
import { businessDateFor, toDateColumn } from '../common/business-date';
import type { CreateOrderDto } from './dto';

interface ModifierSnapshot {
  id: string;
  name: string;
  priceDeltaCents: number;
}

export interface OrderView {
  id: string;
  orderNumber: number;
  status: string;
  paymentStatus: string;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  currency: string;
  createdAt: Date;
  items: {
    id: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    modifiers: ModifierSnapshot[];
    note: string | null;
  }[];
  session: { id: string; number: number; totalCents: number; paidCents: number };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: DailyCounterService,
  ) {}

  async createForGuest(
    organizationId: string,
    guestSessionId: string,
    dto: CreateOrderDto,
  ): Promise<OrderView> {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const guestSession = await tx.guestSession.findUnique({
        where: { id: guestSessionId },
        include: { tableSession: true },
      });
      if (!guestSession) {
        throw new BadRequestException('Sesja gościa wygasła — zeskanuj kod QR ponownie.');
      }

      const { tableSession } = guestSession;
      if (tableSession.status !== 'open') {
        throw new ConflictException('Rachunek stolika jest już zamykany — poproś obsługę.');
      }

      const restaurant = await tx.restaurant.findUniqueOrThrow({
        where: { id: guestSession.restaurantId },
      });

      const priced = await this.priceItems(
        tx,
        restaurant.id,
        restaurant.currency,
        guestSession.locale,
        restaurant.defaultLocale,
        dto,
      );

      if (priced.subtotalCents < restaurant.minOrderCents) {
        throw new BadRequestException(
          `Minimalna wartość zamówienia to ${(restaurant.minOrderCents / 100).toFixed(2)} ${restaurant.currency}.`,
        );
      }

      const openBillLimitExceeded =
        restaurant.openBillLimitCents !== null &&
        tableSession.totalCents + priced.subtotalCents > restaurant.openBillLimitCents;

      // Bramką do kuchni jest `confirmed`. W trybie pay_at_table decyduje o niej
      // kelner, więc zamówienie gościa nigdy nie trafia tu prosto na KDS,
      // dopóki restauracja wymaga potwierdzenia.
      const status = statusAfterSubmission({
        orderingMode: restaurant.orderingMode,
        requireStaffConfirmation: restaurant.requireStaffConfirmation,
        paymentConfirmed: false,
        placedByStaff: false,
        openBillLimitExceeded,
      });

      const businessDate = businessDateFor(
        new Date(),
        restaurant.timezone,
        restaurant.businessDayStartHour,
      );
      const orderNumber = await this.counters.next(tx, {
        organizationId,
        restaurantId: restaurant.id,
        businessDate,
        scope: 'order',
      });

      const order = await tx.order.create({
        data: {
          organizationId,
          restaurantId: restaurant.id,
          tableId: guestSession.tableId,
          tableSessionId: tableSession.id,
          guestSessionId: guestSession.id,
          businessDate: toDateColumn(businessDate),
          orderNumber,
          source: 'guest',
          createdByParticipantId: guestSession.participantId,
          status,
          // Realizacja i rozliczenie to niezależne cykle życia — w trybie
          // pay_at_table zamówienie bywa `served`, gdy płatność wciąż czeka.
          paymentStatus:
            restaurant.orderingMode === 'prepaid' ? 'awaiting_payment' : 'awaiting_settlement',
          subtotalCents: priced.subtotalCents,
          vatCents: priced.vatCents,
          totalCents: priced.subtotalCents,
          currency: restaurant.currency,
          guestNote: dto.guestNote ?? null,
          items: {
            create: priced.items.map((item) => ({
              organizationId,
              menuItemId: item.menuItemId,
              nameSnapshot: item.name,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              modifiersSnapshot: item.modifiers as unknown as Prisma.InputJsonValue,
              itemNote: item.note,
              forParticipantId: guestSession.participantId,
              addedBy: 'guest',
              addedByParticipantId: guestSession.participantId,
            })),
          },
        },
        include: { items: true },
      });

      // OrderEvent jest źródłem prawdy o historii — dopisujemy przy każdej
      // zmianie, nigdy nie nadpisujemy.
      await tx.orderEvent.create({
        data: {
          organizationId,
          orderId: order.id,
          type: 'created',
          actorType: 'guest',
          actorParticipantId: guestSession.participantId,
          actorGuestSessionId: guestSession.id,
          after: {
            status,
            orderNumber,
            totalCents: priced.subtotalCents,
            items: priced.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
            })),
          } as unknown as Prisma.InputJsonValue,
        },
      });

      const session = await this.recalculateSession(tx, tableSession.id);

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
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
          modifiers: item.modifiersSnapshot as unknown as ModifierSnapshot[],
          note: item.itemNote,
        })),
        session,
      };
    });
  }

  /** Zamówienia bieżącej wizyty — dane ekranu statusu w aplikacji gościa. */
  async listForSession(organizationId: string, guestSessionId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const guestSession = await tx.guestSession.findUnique({ where: { id: guestSessionId } });
      if (!guestSession) {
        throw new BadRequestException('Sesja gościa wygasła — zeskanuj kod QR ponownie.');
      }

      const [session, orders] = await Promise.all([
        tx.tableSession.findUniqueOrThrow({ where: { id: guestSession.tableSessionId } }),
        tx.order.findMany({
          where: { tableSessionId: guestSession.tableSessionId },
          orderBy: { createdAt: 'asc' },
          include: { items: true },
        }),
      ]);

      return {
        session: {
          id: session.id,
          number: session.sessionNumber,
          status: session.status,
          subtotalCents: session.subtotalCents,
          totalCents: session.totalCents,
          paidCents: session.paidCents,
          currency: session.currency,
        },
        orders: orders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalCents: order.totalCents,
          createdAt: order.createdAt,
          /// Gość widzi, że pozycję dodała obsługa — bez nazwiska pracownika.
          /// Bez tego rachunek przestaje być weryfikowalny.
          items: order.items.map((item) => ({
            id: item.id,
            name: item.nameSnapshot,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            status: item.status,
            addedByStaff: item.addedBy === 'staff',
            isMine: item.forParticipantId === guestSession.participantId,
          })),
        })),
      };
    });
  }

  /**
   * Wycena po stronie serwera, zawsze od nowa.
   *
   * Klient przysyła wyłącznie identyfikatory — cena z żądania nigdy nie jest
   * brana pod uwagę. To, co trafia do OrderItem, jest snapshotem: późniejsza
   * zmiana cennika nie może zmienić historycznego rachunku.
   */
  private async priceItems(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    currency: string,
    locale: string,
    defaultLocale: string,
    dto: CreateOrderDto,
  ) {
    const menuItemIds = [...new Set(dto.items.map((item) => item.menuItemId))];
    const menuItems = await tx.menuItem.findMany({
      where: { id: { in: menuItemIds }, restaurantId },
      include: {
        translations: true,
        modifierGroups: { include: { modifiers: { include: { translations: true } } } },
      },
    });

    const byId = new Map(menuItems.map((item) => [item.id, item]));

    const name = (translations: { locale: string; name: string }[]): string =>
      translations.find((t) => t.locale === locale)?.name ??
      translations.find((t) => t.locale === defaultLocale)?.name ??
      translations[0]?.name ??
      '';

    let subtotalCents = 0;
    let vatCents = 0;
    const items = dto.items.map((requested) => {
      const menuItem = byId.get(requested.menuItemId);
      if (!menuItem) {
        throw new BadRequestException('Pozycja nie należy do menu tej restauracji.');
      }
      if (!menuItem.isAvailable) {
        throw new ConflictException(`„${name(menuItem.translations)}" jest chwilowo niedostępne.`);
      }
      if (menuItem.currency !== currency) {
        throw new ConflictException('Niespójna waluta w menu restauracji.');
      }

      const selected = new Set(requested.modifierIds ?? []);
      const modifiers: ModifierSnapshot[] = [];

      for (const group of menuItem.modifierGroups) {
        const chosen = group.modifiers.filter((modifier) => selected.has(modifier.id));

        if (chosen.length < group.minSelect || (group.isRequired && chosen.length === 0)) {
          throw new BadRequestException('Nie wybrano wymaganych dodatków.');
        }
        if (chosen.length > group.maxSelect) {
          throw new BadRequestException('Wybrano za dużo dodatków.');
        }
        for (const modifier of chosen) {
          if (!modifier.isAvailable) {
            throw new ConflictException('Wybrany dodatek jest chwilowo niedostępny.');
          }
          selected.delete(modifier.id);
          modifiers.push({
            id: modifier.id,
            name: name(modifier.translations),
            priceDeltaCents: modifier.priceDeltaCents,
          });
        }
      }

      if (selected.size > 0) {
        throw new BadRequestException('Wybrano dodatek spoza tego dania.');
      }

      const unitPriceCents =
        menuItem.priceCents + modifiers.reduce((sum, m) => sum + m.priceDeltaCents, 0);
      const lineTotal = unitPriceCents * requested.quantity;

      subtotalCents += lineTotal;
      // Ceny w menu są brutto, więc VAT wyliczamy z kwoty brutto, nie doliczamy.
      vatCents += vatFromGross(lineTotal, menuItem.vatRate);

      return {
        menuItemId: menuItem.id,
        name: name(menuItem.translations),
        quantity: requested.quantity,
        unitPriceCents,
        modifiers,
        note: requested.note ?? null,
      };
    });

    return { items, subtotalCents, vatCents };
  }

  /**
   * Kwoty wizyty to suma zamówień innych niż odrzucone i anulowane.
   * TableSession jest jednostką rachunku, więc liczy się tu, nie na Order.
   */
  private async recalculateSession(tx: Prisma.TransactionClient, tableSessionId: string) {
    const aggregate = await tx.order.aggregate({
      where: { tableSessionId, status: { notIn: ['rejected', 'canceled'] } },
      _sum: { subtotalCents: true, vatCents: true, totalCents: true },
    });

    const updated = await tx.tableSession.update({
      where: { id: tableSessionId },
      data: {
        subtotalCents: aggregate._sum.subtotalCents ?? 0,
        vatCents: aggregate._sum.vatCents ?? 0,
        totalCents: aggregate._sum.totalCents ?? 0,
        lastSeenAt: new Date(),
      },
    });

    return {
      id: updated.id,
      number: updated.sessionNumber,
      totalCents: updated.totalCents,
      paidCents: updated.paidCents,
    };
  }
}

/**
 * VAT zawarty w kwocie brutto: brutto × stawka / (1 + stawka).
 * Liczone na liczbach całkowitych, zaokrąglane raz, na całej pozycji.
 */
export function vatFromGross(grossCents: number, rate: Prisma.Decimal): number {
  const numerator = rate.toNumber();
  return Math.round((grossCents * numerator) / (1 + numerator));
}
