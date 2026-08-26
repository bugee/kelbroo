import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Granice nicka.
 *
 * Dolna: dwa znaki, bo jedna litera nie odróżnia nikogo przy stoliku. Górna:
 * dwadzieścia cztery, bo nick stoi w nagłówku telefonu, na liście gości i przy
 * każdej pozycji rachunku na ekranie kelnera — dłuższy zaczyna się urywać
 * w każdym z tych miejsc.
 */
const MIN_ZNAKOW = 2;
const MAX_ZNAKOW = 24;

/**
 * Nick gościa wpisany ręcznie.
 *
 * Domyślnie nick jest losowany, bo gość ma zamawiać, a nie wypełniać formularz.
 * Kto chce, może go raz zmienić — i tylko raz: nick jest podpisem pod pozycjami
 * rachunku, więc nazwa zmieniana w trakcie wizyty rozjeżdżałaby to, co inni przy
 * stoliku zdążyli zobaczyć.
 *
 * Awatara nie wybiera się wcale. Znak rozpoznawczy (kształt i kolor) służy do
 * wypowiedzenia kelnerowi i musi być **niepowtarzalny przy stoliku** — wybór
 * gościa psułby tę gwarancję, a niczego nie dodawał.
 */
@Injectable()
export class GuestNameService {
  private readonly logger = new Logger(GuestNameService.name);

  constructor(private readonly prisma: PrismaService) {}

  async setName(organizationId: string, guestSessionId: string, wpisany: string) {
    const nick = this.oczysc(wpisany);

    return this.prisma.withTenant(organizationId, async (tx) => {
      const guestSession = await tx.guestSession.findUnique({
        where: { id: guestSessionId },
        include: { participant: true },
      });
      if (!guestSession?.participant) {
        throw new BadRequestException('Sesja gościa wygasła — zeskanuj kod QR ponownie.');
      }

      const participant = guestSession.participant;
      if (participant.nameChosenAt) {
        throw new ConflictException('Nazwę można ustawić raz na wizytę.');
      }

      // Nick musi odróżniać gości przy **tym** stoliku — na nim opiera się
      // przypisanie pozycji do osoby. Porównanie bez względu na wielkość liter,
      // bo „Ala" i „ala" na ekranie kelnera to ten sam człowiek.
      const zajety = await tx.tableParticipant.findFirst({
        where: {
          tableSessionId: participant.tableSessionId,
          id: { not: participant.id },
          displayName: { equals: nick, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (zajety) {
        throw new ConflictException('Ktoś przy stoliku już się tak nazywa. Wybierz inną nazwę.');
      }

      const zapisany = await tx.tableParticipant.update({
        where: { id: participant.id },
        data: { displayName: nick, nameChosenAt: new Date() },
        select: { id: true, displayName: true, symbol: true, color: true, isHost: true },
      });

      this.logger.log(`Gość ustawił własną nazwę przy wizycie ${participant.tableSessionId}`);
      return zapisany;
    });
  }

  /**
   * Sprząta wpisany tekst.
   *
   * Nick pisze ktoś obcy, a czytają go inni goście i obsługa — więc odrzucamy
   * znaki sterujące (mogą zepsuć układ wiersza) i ściągamy ciągi spacji do
   * jednej, żeby „A          B" nie rozpychało listy.
   */
  private oczysc(wpisany: string): string {
    const nick = wpisany
      // Znaki sterujące i niewidoczne: potrafią zepsuć układ wiersza albo
      // udawać pustą nazwę. Zamieniamy na spację, nie wycinamy, żeby „A\u0000B"
      // nie skleiło się w „AB".
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (nick.length < MIN_ZNAKOW) {
      throw new BadRequestException(`Nazwa musi mieć co najmniej ${MIN_ZNAKOW} znaki.`);
    }
    if (nick.length > MAX_ZNAKOW) {
      throw new BadRequestException(`Nazwa może mieć najwyżej ${MAX_ZNAKOW} znaki.`);
    }
    return nick;
  }
}
