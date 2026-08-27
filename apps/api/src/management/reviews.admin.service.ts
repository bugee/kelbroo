import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { StaffContext } from '../auth/auth.types';

/** Ile opinii pokazujemy naraz. Feedback czyta się partiami, nie archiwizuje. */
const NA_STRONIE = 60;

/**
 * Opinie gości w panelu.
 *
 * Powód, dla którego to w ogóle istnieje: niezadowolony gość ma powiedzieć
 * restauracji, zanim powie internetowi. Jeśli nikt tego nie czyta, mechanizm
 * jest pozorny — dlatego nieprzeczytane idą na górę i mają swój licznik.
 */
@Injectable()
export class ReviewsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(staff: StaffContext) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const reviews = await tx.review.findMany({
        where: { restaurantId: this.restaurantOf(staff) },
        // Nieprzeczytane najpierw, w obrębie każdej grupy od najnowszych.
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        take: NA_STRONIE,
        include: {
          menuItem: { select: { translations: { select: { locale: true, name: true } } } },
          participant: { select: { displayName: true, symbol: true, color: true } },
          tableSession: { select: { sessionNumber: true, table: { select: { label: true } } } },
        },
      });

      return reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        target: review.target,
        isRead: review.isRead,
        createdAt: review.createdAt,
        // Nazwa dania w języku domyślnym lokalu wystarcza: to ekran dla obsługi,
        // nie dla gościa.
        dishName: review.menuItem?.translations[0]?.name ?? null,
        guestName: review.participant?.displayName ?? null,
        guestSymbol: review.participant?.symbol ?? null,
        guestColor: review.participant?.color ?? null,
        tableLabel: review.tableSession?.table.label ?? null,
        sessionNumber: review.tableSession?.sessionNumber ?? null,
      }));
    });
  }

  /** Licznik do plakietki w nawigacji — nieprzeczytane opinie. */
  async unreadCount(staff: StaffContext): Promise<number> {
    return this.prisma.withTenant(staff.organizationId, (tx) =>
      tx.review.count({ where: { restaurantId: this.restaurantOf(staff), isRead: false } }),
    );
  }

  async markRead(staff: StaffContext, id: string) {
    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const zmienione = await tx.review.updateMany({
        where: { id, restaurantId: this.restaurantOf(staff) },
        data: { isRead: true },
      });
      if (zmienione.count === 0) throw new NotFoundException('Nie ma takiej opinii.');
      return { id, isRead: true };
    });
  }

  private restaurantOf(staff: StaffContext): string {
    if (!staff.restaurantId) {
      throw new NotFoundException('Konto nie jest przypisane do lokalu.');
    }
    return staff.restaurantId;
  }
}
