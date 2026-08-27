import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { escapeHtml, ramka, tekstem, type Ramka } from '../mail/templates';

/**
 * Ile razy jeden gość może wysłać zestawienie ze swojej wizyty.
 *
 * Limit jest **na sesję gościa, nie na adres IP**. Cały lokal wychodzi zwykle
 * przez jedno łącze, więc limit po IP dławiłby dwudziestu gości z powodu
 * pierwszego — a to jest wejście, które **wysyła pocztę na cudze polecenie**
 * i bez żadnego limitu zostawiać go nie można.
 *
 * Trzy, bo człowiek wysyła raz, czasem drugi po literówce w adresie.
 */
const LIMIT_NA_GOSCIA = 3;

/** Nagłówek listy pozycji jednego uczestnika. */
interface Grupa {
  nazwa: string;
  pozycje: { nazwa: string; ilosc: number; kwotaCents: number }[];
  sumaCents: number;
}

/**
 * Zestawienie rachunku wysyłane gościowi na e-mail.
 *
 * Scenariusz jest jeden i konkretny: kolację służbową płaci jedna osoba, a
 * rozliczyć trzeba, kto co zamówił (docs/03 §3.6c). Dlatego **każdy uczestnik
 * może wysłać sobie własną kopię**, niezależnie od tego, kto zapłacił — to jego
 * rozliczenie, nie przywilej płatnika.
 *
 * **Adresu nie zapisujemy nigdzie.** Nie jest kolumną w bazie, nie trafia do
 * dziennika ani do logu — przechodzi przez pamięć procesu do serwera poczty
 * i znika. Tak opisuje to polityka prywatności §9 ust. 1 i tak ma zostać:
 * zapisanie go zamieniłoby wysyłkę zestawienia w zbieranie bazy adresowej.
 *
 * Dokument **nie jest paragonem fiskalnym** i mówi to wprost w treści. Paragon
 * wystawia kasa lokalu; zestawienie z kelbroo służy rozliczeniu delegacji.
 */
@Injectable()
export class BillSummaryService {
  private readonly logger = new Logger(BillSummaryService.name);

  /**
   * Licznik wysyłek per sesja gościa.
   *
   * W pamięci procesu, tak jak licznik żądań i zadania cykliczne — przy jednej
   * instancji API to wystarcza. Restart kasuje licznik, więc uparty nadawca
   * zyskuje kolejne trzy wysyłki; przy koszcie „trzy wiadomości na restart"
   * nie warto za to płacić zapisem w bazie przy każdym rachunku.
   */
  private readonly wyslane = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async send(organizationId: string, guestSessionId: string, email: string): Promise<void> {
    const adres = email.trim();

    const zuzyte = this.wyslane.get(guestSessionId) ?? 0;
    if (zuzyte >= LIMIT_NA_GOSCIA) {
      throw new ConflictException(
        'Wysłaliśmy już to zestawienie kilka razy. Poproś obsługę, jeśli nie dotarło.',
      );
    }

    const tresc = await this.zbierz(organizationId, guestSessionId);

    const poszlo = await this.mail.send({
      to: adres,
      subject: `Zestawienie rachunku — ${tresc.lokal}`,
      text: tekstem(tresc.ramka),
      html: ramka(tresc.ramka),
    });

    /**
     * Tu wiadomość **jest** operacją, więc jej niepowodzenie nie może zniknąć
     * w logu — inaczej gość czyta „wysłane", czeka na coś, co nigdy nie przyjdzie,
     * i dowiaduje się o tym dopiero przy rozliczaniu delegacji.
     *
     * Brak skonfigurowanego SMTP to co innego niż nieudana wysyłka: lokalnie
     * i w testach poczty nie ma i to normalny stan, ten sam co w całej reszcie
     * aplikacji. Awarią jest dopiero odmowa serwera, który miał działać.
     */
    if (!poszlo && this.mail.skonfigurowana) {
      throw new ServiceUnavailableException(
        'Nie udało się wysłać zestawienia. Spróbuj za chwilę albo poproś obsługę.',
      );
    }

    // Licznik rośnie dopiero po wysyłce: nieudana próba nie zabiera gościowi
    // limitu, a nadużyciem nie jest, bo żadna wiadomość wtedy nie wyszła.
    this.wyslane.set(guestSessionId, zuzyte + 1);

    // Bez adresu w logu. Wystarczy, że wiadomo, z której wizyty poszło.
    this.logger.log(`Zestawienie wysłane z wizyty ${tresc.sessionId}`);
  }

  private async zbierz(organizationId: string, guestSessionId: string) {
    return this.prisma.withTenant(organizationId, async (tx) => {
      const guestSession = await tx.guestSession.findUnique({
        where: { id: guestSessionId },
        select: { tableSessionId: true },
      });
      if (!guestSession) {
        throw new BadRequestException('Sesja gościa wygasła — zeskanuj kod QR ponownie.');
      }

      const wizyta = await tx.tableSession.findUniqueOrThrow({
        where: { id: guestSession.tableSessionId },
        include: {
          table: { select: { label: true } },
          restaurant: { select: { name: true } },
        },
      });

      // Odrzucone i anulowane nie wchodzą — dokładnie ta sama reguła, którą
      // liczy się kwoty wizyty. Rozjechanie się tych dwóch miejsc dałoby
      // zestawienie, które nie sumuje się do rachunku.
      const zamowienia = await tx.order.findMany({
        where: {
          tableSessionId: wizyta.id,
          status: { notIn: ['rejected', 'canceled'] },
        },
        orderBy: { createdAt: 'asc' },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
            include: { forParticipant: { select: { id: true, displayName: true } } },
          },
        },
      });

      if (zamowienia.length === 0) {
        throw new ConflictException('Na tej wizycie nie ma jeszcze żadnego zamówienia.');
      }

      const grupy = new Map<string, Grupa>();
      const WSPOLNE = 'wspolne';

      for (const zamowienie of zamowienia) {
        for (const pozycja of zamowienie.items) {
          if (pozycja.status === 'canceled') continue;

          const klucz = pozycja.forParticipant?.id ?? WSPOLNE;
          const grupa = grupy.get(klucz) ?? {
            // Pozycje bez wskazanego uczestnika to zwykle wspólna butelka wody
            // albo zamówienie złożone przez kelnera „na stolik".
            nazwa: pozycja.forParticipant?.displayName ?? 'Wspólne',
            pozycje: [],
            sumaCents: 0,
          };

          const kwota = pozycja.unitPriceCents * pozycja.quantity;
          grupa.pozycje.push({
            nazwa: pozycja.nameSnapshot,
            ilosc: pozycja.quantity,
            kwotaCents: kwota,
          });
          grupa.sumaCents += kwota;
          grupy.set(klucz, grupa);
        }
      }

      const waluta = wizyta.currency;
      const akapity = [
        `<strong>${escapeHtml(wizyta.restaurant.name)}</strong><br>` +
          `${escapeHtml(wizyta.table.label)} · rachunek #${wizyta.sessionNumber} · ` +
          this.dataPolska(wizyta.openedAt),
        ...[...grupy.values()].map((grupa) => this.grupaHtml(grupa, waluta)),
        `<strong>Razem: ${this.kwota(wizyta.totalCents, waluta)}</strong>` +
          (wizyta.tipCents > 0 ? `<br>w tym napiwek ${this.kwota(wizyta.tipCents, waluta)}` : ''),
      ];

      const ramkaMaila: Ramka = {
        adresStrony: this.mail.adresStrony,
        naglowek: 'Zestawienie rachunku',
        akapity,
        stopka: [
          'To zestawienie ma charakter <strong>informacyjny i nie jest paragonem ' +
            'fiskalnym</strong>. Paragon wystawia kasa lokalu.',
          'Adresu, na który przyszła ta wiadomość, nie zapisaliśmy. Użyliśmy go ' +
            'wyłącznie do tej jednej wysyłki.',
        ],
      };

      return { ramka: ramkaMaila, lokal: wizyta.restaurant.name, sessionId: wizyta.id };
    });
  }

  private grupaHtml(grupa: Grupa, waluta: string): string {
    // Nazwa uczestnika i nazwa dania pochodzą od gościa — obie przez ucieczkę.
    // Szablon wstawia akapity surowo, więc to jedyne miejsce, które je chroni.
    const pozycje = grupa.pozycje
      .map(
        (pozycja) =>
          `${pozycja.ilosc}× ${escapeHtml(pozycja.nazwa)} — ${this.kwota(pozycja.kwotaCents, waluta)}`,
      )
      .join('<br>');

    return (
      `<strong>${escapeHtml(grupa.nazwa)}</strong><br>${pozycje}<br>` +
      `<strong>Razem: ${this.kwota(grupa.sumaCents, waluta)}</strong>`
    );
  }

  /** Kwoty są w groszach — dzielimy dopiero przy wyświetleniu. */
  private kwota(cents: number, waluta: string): string {
    return `${(cents / 100).toFixed(2).replace('.', ',')} ${waluta}`;
  }

  private dataPolska(data: Date): string {
    return data.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Warsaw',
    });
  }
}
