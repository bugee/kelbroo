import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Prisma, ReviewTarget } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Skala z dokumentu Systemu 3 (§3.8): pięć gwiazdek, bez połówek. */
const MIN_OCENA = 1;
const MAX_OCENA = 5;

/** Komentarz jest opcjonalny — ale jeśli już jest, ma się mieścić na ekranie managera. */
const MAX_KOMENTARZ = 1000;

export interface OcenaDania {
  menuItemId: string;
  rating: number;
  comment?: string;
}

export interface OcenaWizyty {
  rating: number;
  /** Do kogo gość mówi: o jedzeniu czy o obsłudze. */
  target: Extract<ReviewTarget, 'kitchen' | 'service'>;
  /** „Wiadomość do managera" — niewidoczna dla nikogo poza panelem. */
  comment?: string;
}

/**
 * Oceny dań i wizyty.
 *
 * Sens tej funkcji nie jest w gwiazdkach, tylko w tym, co robi z niezadowolonym
 * gościem: daje mu miejsce, w którym powie o tym **restauracji**, zanim powie
 * o tym internetowi (docs/03 §3.8).
 *
 * Ocena jest **anonimowa wobec konta, ale nie wobec wizyty**: wiąże się
 * z uczestnikiem, żeby dało się przyjąć jedno zgłoszenie na gościa i żeby manager
 * wiedział, którego stolika dotyczy. Uczestnik znika razem z wizytą, więc po
 * zamknięciu rachunku zostaje sama treść.
 */
@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Co gość może ocenić.
   *
   * Wyłącznie **jego** dania i wyłącznie **wydane**: ocena rzeczy, której nie
   * dostał, nie niesie żadnej informacji, a pytanie o nią w trakcie serwisu
   * wygląda jak pomyłka.
   */
  /**
   * Czy lokal w ogóle zbiera oceny.
   *
   * Funkcja planu Pro i wyższych, z możliwością ręcznego włączenia z zaplecza.
   * Sprawdzana **po stronie serwera przy każdym zgłoszeniu**, nie tylko przy
   * rysowaniu przycisku: ukrycie kontrolki jest wygodą, nie zabezpieczeniem.
   */
  private async wlaczone(tx: Prisma.TransactionClient, organizationId: string): Promise<boolean> {
    const subscription = await tx.subscription.findUnique({ where: { organizationId } });
    return subscription?.reviewsEnabled === true;
  }

  async reviewable(organizationId: string, guestSessionId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      // Wyłączona funkcja znaczy „nie ma czego oceniać" — gość nie zobaczy
      // wtedy u siebie żadnego zaproszenia.
      if (!(await this.wlaczone(tx, organizationId))) {
        return { dishes: [], alreadySubmitted: false };
      }

      const guestSession = await tx.guestSession.findUnique({
        where: { id: guestSessionId },
        select: { tableSessionId: true, participantId: true },
      });
      if (!guestSession?.participantId) return { dishes: [], alreadySubmitted: false };

      const juz = await tx.review.count({
        where: {
          tableSessionId: guestSession.tableSessionId,
          participantId: guestSession.participantId,
        },
      });

      const items = await tx.orderItem.findMany({
        where: {
          order: { tableSessionId: guestSession.tableSessionId },
          forParticipantId: guestSession.participantId,
          status: 'served',
          menuItemId: { not: null },
        },
        select: { menuItemId: true, nameSnapshot: true },
      });

      // Jedno danie zamówione dwa razy to wciąż jedno danie do oceny.
      const unikalne = new Map(items.map((item) => [item.menuItemId!, item.nameSnapshot]));

      return {
        dishes: [...unikalne].map(([menuItemId, name]) => ({ menuItemId, name })),
        alreadySubmitted: juz > 0,
      };
    });
  }

  async submit(
    organizationId: string,
    guestSessionId: string,
    zgloszenie: { dishes?: OcenaDania[]; visit?: OcenaWizyty },
  ) {
    const dania = zgloszenie.dishes ?? [];
    if (dania.length === 0 && !zgloszenie.visit) {
      throw new BadRequestException('Nie ma czego zapisać — oceń danie albo całą wizytę.');
    }
    for (const ocena of [...dania, ...(zgloszenie.visit ? [zgloszenie.visit] : [])]) {
      this.sprawdzOcene(ocena.rating, ocena.comment);
    }

    return this.prisma.withTenant(organizationId, async (tx) => {
      if (!(await this.wlaczone(tx, organizationId))) {
        throw new ForbiddenException('Ten lokal nie zbiera ocen.');
      }

      const guestSession = await tx.guestSession.findUnique({
        where: { id: guestSessionId },
        select: {
          tableSessionId: true,
          participantId: true,
          restaurantId: true,
        },
      });
      if (!guestSession?.participantId) {
        throw new BadRequestException('Sesja gościa wygasła — zeskanuj kod QR ponownie.');
      }

      // Jedno zgłoszenie na gościa i wizytę (docs/03 §3.8). Bez tego jeden
      // niezadowolony wieczór potrafi zamienić się w dwadzieścia jedynek.
      const juz = await tx.review.count({
        where: {
          tableSessionId: guestSession.tableSessionId,
          participantId: guestSession.participantId,
        },
      });
      if (juz > 0) {
        throw new ConflictException('Ocenę można wystawić raz na wizytę. Dziękujemy!');
      }

      const wspolne = {
        organizationId,
        restaurantId: guestSession.restaurantId,
        tableSessionId: guestSession.tableSessionId,
        participantId: guestSession.participantId,
      };

      await tx.review.createMany({
        data: [
          ...dania.map((ocena) => ({
            ...wspolne,
            menuItemId: ocena.menuItemId,
            rating: ocena.rating,
            comment: ocena.comment?.trim() || null,
            target: 'dish' as const,
          })),
          ...(zgloszenie.visit
            ? [
                {
                  ...wspolne,
                  rating: zgloszenie.visit.rating,
                  comment: zgloszenie.visit.comment?.trim() || null,
                  target: zgloszenie.visit.target,
                },
              ]
            : []),
        ],
      });

      this.logger.log(`Ocena z wizyty ${guestSession.tableSessionId}: ${dania.length} dań`);
      return { saved: dania.length + (zgloszenie.visit ? 1 : 0) };
    });
  }

  private sprawdzOcene(rating: number, comment?: string): void {
    if (!Number.isInteger(rating) || rating < MIN_OCENA || rating > MAX_OCENA) {
      throw new BadRequestException(`Ocena to liczba od ${MIN_OCENA} do ${MAX_OCENA}.`);
    }
    if (comment && comment.length > MAX_KOMENTARZ) {
      throw new BadRequestException(`Komentarz może mieć najwyżej ${MAX_KOMENTARZ} znaków.`);
    }
  }
}
