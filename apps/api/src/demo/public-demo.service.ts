import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';

/**
 * Po ilu minutach bezczynności wizyta zwiedzającego znika.
 *
 * Krótko, bo przy stoliku pokazowym siedzą nieznajomi z internetu i widzą
 * nawzajem swoje zamówienia razem z notatkami, które sami wpisali. Pół godziny
 * wystarcza na obejrzenie produktu i ogranicza to, co jeden zwiedzający może
 * pokazać drugiemu.
 */
const ZYCIE_WIZYTY_MIN = 30;

/**
 * Sprzątanie po restauracji pokazowej.
 *
 * Bez tego demo psuje się samo: po tygodniu stolik ma dwieście zamówień od
 * obcych ludzi, a nowy zwiedzający zamiast czystej karty widzi cudzy rachunek.
 *
 * Kasujemy wyłącznie **wizyty** — menu, stolik i sama restauracja zostają.
 * Zamówienia, uczestnicy i sesje gości znikają razem z wizytą, bo wiszą na niej
 * kluczem obcym z kasowaniem kaskadowym.
 *
 * Działa na połączeniu katalogowym: zadanie nie ma sesji żadnego najemcy,
 * a zakres jest wąski — wyłącznie organizacje oznaczone jako pokazowe.
 */
@Injectable()
export class PublicDemoService {
  private readonly logger = new Logger(PublicDemoService.name);

  private readonly directory = new PrismaClient({
    datasourceUrl: process.env.DIRECT_DATABASE_URL,
  });

  @Cron(CronExpression.EVERY_30_MINUTES)
  async posprzataj(): Promise<void> {
    // `TableSession` nie ma relacji do organizacji, tylko jej identyfikator,
    // więc najpierw pytamy, które organizacje są pokazowe.
    const pokazowe = await this.directory.organization.findMany({
      where: { isDemo: true },
      select: { id: true },
    });
    if (pokazowe.length === 0) return;

    const granica = new Date(Date.now() - ZYCIE_WIZYTY_MIN * 60_000);
    const usuniete = await this.directory.tableSession.deleteMany({
      where: {
        organizationId: { in: pokazowe.map((organizacja) => organizacja.id) },
        openedAt: { lt: granica },
      },
    });

    if (usuniete.count > 0) {
      this.logger.log(`Restauracja pokazowa: usunięto ${usuniete.count} wizyt zwiedzających`);
    }
  }
}
