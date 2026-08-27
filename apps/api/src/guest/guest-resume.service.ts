import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GuestSessionService } from './guest-session.service';

/**
 * Czy gość może wrócić do swojej wizyty bez ponownego skanowania.
 *
 * Powód istnienia jest wąski i wart wypisania. Wejście z nieaktualnym tokenem
 * **nie kończy się dziś błędem**: serwer zakłada wtedy nową tożsamość przy
 * bieżącej wizycie stolika. Przy skanowaniu to jest w porządku — skan jest
 * świadomym „dosiadam się tutaj, teraz". Ale ciche przekierowanie z historii
 * przeglądarki takim aktem **nie jest**: gość wracający po trzech godzinach
 * wylądowałby przy stoliku obcych ludzi, z ich rachunkiem, nie robiąc nic poza
 * kliknięciem w zakładkę.
 *
 * Dlatego strona startowa pyta najpierw tutaj i przekierowuje **wyłącznie**,
 * gdy to wciąż ta sama wizyta.
 */
@Injectable()
export class GuestResumeService {
  constructor(private readonly prisma: PrismaService) {}

  async canResume(qrToken: string, guestToken: string): Promise<boolean> {
    if (!qrToken || !guestToken) return false;

    // Skan QR jest bez kontekstu najemcy — najpierw wąska funkcja
    // SECURITY DEFINER, dopiero potem wchodzimy w RLS. Ta sama droga,
    // którą idzie zwykłe wejście do stolika.
    const located = await this.prisma.$queryRaw<
      { organization_id: string; restaurant_id: string; table_id: string }[]
    >`SELECT * FROM app.resolve_qr_token(${qrToken})`;

    const target = located[0];
    if (!target) return false;

    return this.prisma.withTenant(target.organization_id, async (tx) => {
      const openSession = await tx.tableSession.findFirst({
        where: { tableId: target.table_id, status: 'open' },
        select: { id: true },
      });
      if (!openSession) return false;

      // Trzy warunki naraz, wszystkie konieczne: token jest nasz, wizyta jest
      // **ta sama**, a sesja jeszcze nie wygasła. Rozliczony rachunek albo
      // nowa wizyta przy tym stoliku znaczą, że wracać nie ma do czego.
      const guestSession = await tx.guestSession.findFirst({
        where: {
          tokenHash: GuestSessionService.hash(guestToken),
          tableSessionId: openSession.id,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });

      return guestSession !== null;
    });
  }
}
