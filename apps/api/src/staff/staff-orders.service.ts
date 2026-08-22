import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertTransition,
  cancellationRequiresManager,
  isVisibleToKitchen,
  KITCHEN_VISIBLE_STATUSES,
  type OrderStatus,
} from '@kelbroo/types';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import type { StaffContext } from '../auth/auth.types';

const ORDER_VIEW = {
  items: true,
  table: { select: { label: true } },
  createdByParticipant: { select: { displayName: true, color: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class StaffOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OrdersGateway,
  ) {}

  private restaurantOf(staff: StaffContext): string {
    if (!staff.restaurantId) {
      throw new ForbiddenException('Konto nie jest przypisane do lokalu.');
    }
    return staff.restaurantId;
  }

  /** Kolejka kelnera: zamówienia czekające na potwierdzenie przy stoliku. */
  async confirmationQueue(staff: StaffContext) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const orders = await tx.order.findMany({
        where: {
          restaurantId: this.restaurantOf(staff),
          status: { in: ['submitted', 'awaiting_confirmation'] },
        },
        orderBy: { createdAt: 'asc' },
        include: ORDER_VIEW,
      });
      return orders.map(toStaffView);
    });
  }

  /**
   * KDS widzi wyłącznie zamówienia za bramką `confirmed`. Filtr pochodzi
   * z tej samej stałej co reszta systemu — kuchnia nie ma własnej definicji
   * tego, co jest „do zrobienia".
   */
  async kitchenBoard(staff: StaffContext) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const orders = await tx.order.findMany({
        where: {
          restaurantId: this.restaurantOf(staff),
          status: { in: [...KITCHEN_VISIBLE_STATUSES] },
        },
        orderBy: { confirmedAt: 'asc' },
        include: ORDER_VIEW,
      });
      return orders.map(toStaffView);
    });
  }

  async confirm(staff: StaffContext, orderId: string) {
    // Potwierdzenie dotyczy wyłącznie realizacji — payment_status biegnie
    // własnym cyklem i zmienia go dopiero rozliczenie u kelnera.
    return this.change(staff, orderId, 'confirmed', 'confirmed', () => ({
      confirmedAt: new Date(),
      confirmedByStaff: { connect: { id: staff.staffId } },
      status: 'confirmed' as const,
    }));
  }

  async reject(staff: StaffContext, orderId: string, reason: string) {
    if (!reason.trim()) {
      throw new BadRequestException('Odrzucenie zamówienia wymaga podania powodu.');
    }
    return this.change(
      staff,
      orderId,
      'rejected',
      'rejected',
      () => ({ status: 'rejected' as const, rejectedReason: reason }),
      reason,
    );
  }

  async advance(staff: StaffContext, orderId: string, to: OrderStatus) {
    if (!isVisibleToKitchen(to) && to !== 'served') {
      throw new BadRequestException('Nieobsługiwana zmiana statusu.');
    }
    return this.change(staff, orderId, to, 'status_changed', () => ({
      status: to,
      ...(to === 'ready' ? { readyAt: new Date() } : {}),
      ...(to === 'served' ? { servedAt: new Date() } : {}),
    }));
  }

  async cancel(staff: StaffContext, orderId: string, reason: string) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const order = await this.load(tx, staff, orderId);

      // Anulowanie po starcie kuchni to strata produktu — decyzja managera,
      // zawsze z powodem, zawsze do dziennika audytu.
      if (cancellationRequiresManager(order.status) && !['owner', 'manager'].includes(staff.role)) {
        throw new ForbiddenException(
          'Anulowanie zamówienia w przygotowaniu wymaga uprawnień managera.',
        );
      }
      if (!reason.trim()) {
        throw new BadRequestException('Anulowanie wymaga podania powodu.');
      }

      assertTransition(order.status, 'canceled');
      return this.applyChange(tx, staff, order, { status: 'canceled' }, 'canceled', reason);
    });
  }

  private async change(
    staff: StaffContext,
    orderId: string,
    to: OrderStatus,
    eventType: 'confirmed' | 'rejected' | 'status_changed' | 'canceled',
    data: (order: { paymentStatus: string; status: OrderStatus }) => Prisma.OrderUpdateInput,
    reason?: string,
  ) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const order = await this.load(tx, staff, orderId);
      assertTransition(order.status, to);
      return this.applyChange(tx, staff, order, data(order), eventType, reason);
    });
  }

  private async load(tx: Prisma.TransactionClient, staff: StaffContext, orderId: string) {
    const order = await tx.order.findFirst({
      where: { id: orderId, restaurantId: this.restaurantOf(staff) },
      include: ORDER_VIEW,
    });
    if (!order) {
      throw new NotFoundException('Zamówienie nie istnieje.');
    }
    return order;
  }

  private async applyChange(
    tx: Prisma.TransactionClient,
    staff: StaffContext,
    order: Prisma.OrderGetPayload<{ include: typeof ORDER_VIEW }>,
    data: Prisma.OrderUpdateInput,
    eventType: 'confirmed' | 'rejected' | 'status_changed' | 'canceled',
    reason?: string,
  ) {
    const updated = await tx.order.update({
      where: { id: order.id },
      data,
      include: ORDER_VIEW,
    });

    await tx.orderEvent.create({
      data: {
        organizationId: staff.organizationId,
        orderId: order.id,
        type: eventType,
        actorType: 'staff',
        actorStaffId: staff.staffId,
        before: { status: order.status } as Prisma.InputJsonValue,
        after: { status: updated.status } as Prisma.InputJsonValue,
        reason: reason ?? null,
      },
    });

    // Anulowanie i odrzucenie wypadają z sumy rachunku wizyty.
    if (updated.status === 'canceled' || updated.status === 'rejected') {
      const aggregate = await tx.order.aggregate({
        where: {
          tableSessionId: updated.tableSessionId,
          status: { notIn: ['rejected', 'canceled'] },
        },
        _sum: { subtotalCents: true, vatCents: true, totalCents: true },
      });
      await tx.tableSession.update({
        where: { id: updated.tableSessionId },
        data: {
          subtotalCents: aggregate._sum.subtotalCents ?? 0,
          vatCents: aggregate._sum.vatCents ?? 0,
          totalCents: aggregate._sum.totalCents ?? 0,
        },
      });
    }

    this.gateway.publish(updated.restaurantId, {
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      status: updated.status,
      tableLabel: updated.table.label,
      reason: eventType === 'canceled' ? 'status_changed' : eventType,
    });

    return toStaffView(updated);
  }
}

function toStaffView(order: Prisma.OrderGetPayload<{ include: typeof ORDER_VIEW }>) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    tableLabel: order.table.label,
    guestName: order.createdByParticipant?.displayName ?? null,
    guestColor: order.createdByParticipant?.color ?? null,
    guestNote: order.guestNote,
    totalCents: order.totalCents,
    currency: order.currency,
    createdAt: order.createdAt,
    confirmedAt: order.confirmedAt,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.nameSnapshot,
      quantity: item.quantity,
      note: item.itemNote,
      modifiers: (item.modifiersSnapshot as unknown as { name: string }[]).map((m) => m.name),
      addedByStaff: item.addedBy === 'staff',
    })),
  };
}
