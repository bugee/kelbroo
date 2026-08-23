import { ForbiddenException, Injectable } from '@nestjs/common';
import { KITCHEN_VISIBLE_STATUSES, type OrderStatus } from '@kelbroo/types';
import { PrismaService } from '../prisma/prisma.service';
import type { StaffContext } from '../auth/auth.types';

/**
 * Liczniki pracy czekającej na obsługę.
 *
 * Kluczem jest ścieżka pozycji menu, żeby panel nie musiał drugi raz decydować,
 * co komu pokazać — reguła roli mieszka wyłącznie tutaj.
 */
export type Badges = Record<string, number>;

/** Zamówienia gotowe do wydania — to, po co kelner ma pójść. */
const READY: OrderStatus[] = ['ready'];

/** Zamówienia jeszcze do zrobienia — praca kuchni. */
const IN_KITCHEN: OrderStatus[] = ['confirmed', 'preparing'];

/** Czekające na potwierdzenie przy stoliku. */
const AWAITING_CONFIRMATION: OrderStatus[] = ['submitted', 'awaiting_confirmation'];

@Injectable()
export class BadgesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `Kuchnia` znaczy co innego dla kelnera („odbierz") niż dla kuchni („zrób").
   * Właściciel i manager widzą jedno i drugie, bo nadzorują obie strony przejścia.
   * Pomyłka tutaj pokazałaby każdej z ról cudzą robotę.
   */
  async forStaff(staff: StaffContext): Promise<Badges> {
    if (!staff.restaurantId) {
      throw new ForbiddenException('Konto nie jest przypisane do lokalu.');
    }
    const restaurantId = staff.restaurantId;
    const supervises = staff.role === 'owner' || staff.role === 'manager';
    const badges: Badges = {};

    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      if (staff.role !== 'kitchen') {
        // Wezwanie gościa to praca czekająca tak samo jak zamówienie, a pokazujemy
        // je nad kolejką potwierdzeń — więc doliczamy je do tego samego licznika.
        // Gość czekający na wpuszczenie też stoi w miejscu — i to przy stoliku,
        // nie w kuchni. Liczymy go tam, gdzie widać jego zgłoszenie.
        const [orders, calls, waiting] = await Promise.all([
          tx.order.count({
            where: { restaurantId, status: { in: AWAITING_CONFIRMATION } },
          }),
          tx.waiterCall.count({
            where: { restaurantId, status: { in: ['open', 'acknowledged'] } },
          }),
          tx.tableParticipant.count({
            where: {
              leftAt: null,
              approvedAt: null,
              tableSession: { restaurantId, status: { in: ['open', 'awaiting_settlement'] } },
            },
          }),
        ]);
        badges['/queue'] = orders + calls + waiting;
      }

      const kitchenStatuses = supervises
        ? [...KITCHEN_VISIBLE_STATUSES]
        : staff.role === 'kitchen'
          ? IN_KITCHEN
          : READY;

      badges['/kds'] = await tx.order.count({
        where: { restaurantId, status: { in: kitchenStatuses } },
      });

      // Zero nie jest informacją — panel ma nie rysować pustych kropek.
      for (const key of Object.keys(badges)) {
        if (badges[key] === 0) delete badges[key];
      }
      return badges;
    });
  }
}
