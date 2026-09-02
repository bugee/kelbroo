import { existsSync } from 'node:fs';
import path from 'node:path';
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Kroje pisma wkompilowane w obraz, nie pobierane z sieci.
 *
 * Wbudowane kroje PDF-a nie mają polskich znaków — „Żurek" wyszedłby jako
 * „urek". IBM Plex Sans jest krojem tekstowym marki (CLAUDE.md) i ma komplet
 * diakrytyków; leży w `assets/fonts` razem z licencją OFL, bo dokument
 * z rozjechanymi nazwami dań nie nadaje się do rozliczenia delegacji.
 */
/**
 * Skompilowana aplikacja ma je w `dist/assets`, a testy chodzą po źródłach
 * i widzą `apps/api/assets`. Sprawdzamy oba, zamiast liczyć na jeden —
 * ścieżka dobra tylko w testach to awaria widoczna dopiero na produkcji.
 */
function font(nazwa: string): string {
  const kandydaci = [
    path.join(__dirname, '..', 'assets', 'fonts', nazwa),
    path.join(__dirname, '..', '..', 'assets', 'fonts', nazwa),
  ];
  const znaleziony = kandydaci.find((sciezka) => existsSync(sciezka));
  if (!znaleziony) {
    throw new Error(`Brak kroju pisma ${nazwa}. Szukano w: ${kandydaci.join(', ')}`);
  }
  return znaleziony;
}

const FONT = font('IBMPlexSans_400Regular.ttf');
const FONT_POGRUBIONY = font('IBMPlexSans_600SemiBold.ttf');

/** Nagłówek listy pozycji jednego uczestnika. */
interface Grupa {
  nazwa: string;
  pozycje: { nazwa: string; ilosc: number; kwotaCents: number }[];
  sumaCents: number;
}

/**
 * Zestawienie rachunku jako plik PDF na telefon gościa.
 *
 * Scenariusz jest jeden i konkretny: kolację służbową płaci jedna osoba, a
 * rozliczyć trzeba, kto co zamówił (docs/03 §3.6c). Dlatego **każdy uczestnik
 * może pobrać własną kopię**, niezależnie od tego, kto zapłacił — to jego
 * rozliczenie, nie przywilej płatnika.
 *
 * **Plik powstaje i znika w jednym żądaniu.** Nie zapisujemy go na dysku, nie
 * zbieramy adresu e-mail, nie zostaje po nim żaden ślad poza wpisem w logu
 * z identyfikatorem wizyty. Wcześniej to samo zestawienie szło pocztą; ścieżka
 * e-mailowa jest wstrzymana, bo zbierała adres osoby fizycznej, którego nie
 * opisuje żaden dokument — patrz [analiza](../../../../docs/analiza-zgoda-na-zestawienie.md).
 * Pobranie omija ten problem w całości: gość dostaje plik, a my nie dostajemy nic.
 *
 * Dokument **nie jest paragonem fiskalnym** i mówi to wprost w treści. Paragon
 * wystawia kasa lokalu; zestawienie z kelbroo służy rozliczeniu delegacji.
 */
@Injectable()
export class BillSummaryService {
  private readonly logger = new Logger(BillSummaryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Nazwa pliku, po której gość pozna go w katalogu pobranych. */
  static nazwaPliku(lokal: string, data: Date): string {
    const slug = lokal
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/gi, 'l')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const dzien = data.toISOString().slice(0, 10);
    return `zestawienie-${slug || 'rachunek'}-${dzien}.pdf`;
  }

  async pdf(
    organizationId: string,
    guestSessionId: string,
  ): Promise<{ plik: Buffer; nazwa: string }> {
    const dane = await this.zestawienie(organizationId, guestSessionId);
    const plik = await this.rysuj(dane);

    // Bez adresu, bo żadnego nie ma. Wystarczy, że wiadomo, z której wizyty.
    this.logger.log(`Zestawienie pobrane z wizyty ${dane.sessionId}`);
    return { plik, nazwa: BillSummaryService.nazwaPliku(dane.lokal, dane.otwarta) };
  }

  /**
   * Treść dokumentu, osobno od jego rysowania.
   *
   * Publiczna, bo to **ona** jest tym, co musi się zgadzać co do grosza —
   * i to ją sprawdzają testy. Rysowanie jest warstwą prezentacji: da się je
   * obejrzeć, ale nie da się go sensownie zasertować przez bajty PDF-a,
   * w którym tekst siedzi w podzbiorze kroju pisma.
   */
  async zestawienie(organizationId: string, guestSessionId: string) {
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

      return {
        sessionId: wizyta.id,
        lokal: wizyta.restaurant.name,
        stolik: wizyta.table.label,
        numer: wizyta.sessionNumber,
        otwarta: wizyta.openedAt,
        waluta: wizyta.currency,
        totalCents: wizyta.totalCents,
        tipCents: wizyta.tipCents,
        grupy: [...grupy.values()],
      };
    });
  }

  private rysuj(dane: Awaited<ReturnType<BillSummaryService['zestawienie']>>): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    doc.registerFont('plex', FONT);
    doc.registerFont('plex-bold', FONT_POGRUBIONY);

    const szerokosc = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const kwota = (cents: number) => this.kwota(cents, dane.waluta);

    /** Wiersz z nazwą po lewej i kwotą po prawej, w jednej linii bazowej. */
    const wiersz = (opis: string, wartosc: string, pogrubiony = false) => {
      const y = doc.y;
      doc.font(pogrubiony ? 'plex-bold' : 'plex');
      // Kwota najpierw: `text` przesuwa `doc.y`, więc opis rysowany wcześniej
      // zepchnąłby ją o wiersz niżej przy dłuższej nazwie dania.
      doc.text(wartosc, doc.page.margins.left, y, { width: szerokosc, align: 'right' });
      doc.text(opis, doc.page.margins.left, y, { width: szerokosc - 90 });
    };

    doc.font('plex-bold').fontSize(20).text('Zestawienie rachunku');
    doc.moveDown(0.4);
    doc.font('plex').fontSize(11).text(dane.lokal);
    doc
      .fillColor('#6b807e')
      .text(`${dane.stolik} · rachunek #${dane.numer} · ${this.dataPolska(dane.otwarta)}`);
    doc.fillColor('#000000');

    for (const grupa of dane.grupy) {
      doc.moveDown(1);
      doc.fontSize(12).font('plex-bold').text(grupa.nazwa);
      doc.moveDown(0.3).fontSize(11);
      for (const pozycja of grupa.pozycje) {
        wiersz(`${pozycja.ilosc}× ${pozycja.nazwa}`, kwota(pozycja.kwotaCents));
      }
      doc.moveDown(0.2);
      wiersz('Razem', kwota(grupa.sumaCents), true);
    }

    doc.moveDown(1.2);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.margins.left + szerokosc, doc.y)
      .strokeColor('#d8e4e2')
      .stroke();
    doc.moveDown(0.6).fontSize(13);
    wiersz('Razem', kwota(dane.totalCents), true);
    if (dane.tipCents > 0) {
      doc.fontSize(10).fillColor('#6b807e');
      wiersz('w tym napiwek', kwota(dane.tipCents));
      doc.fillColor('#000000');
    }

    doc.moveDown(2);
    doc
      .font('plex')
      .fontSize(9)
      .fillColor('#6b807e')
      .text(
        'To zestawienie ma charakter informacyjny i nie jest paragonem fiskalnym. ' +
          'Paragon wystawia kasa lokalu.',
        { width: szerokosc },
      )
      .moveDown(0.4)
      .text('Dokument powstał na Twoje żądanie i nie zostawiliśmy po nim żadnych danych.', {
        width: szerokosc,
      });

    return new Promise((resolve, reject) => {
      const kawalki: Buffer[] = [];
      doc.on('data', (kawalek: Buffer) => kawalki.push(kawalek));
      doc.on('end', () => resolve(Buffer.concat(kawalki)));
      doc.on('error', reject);
      doc.end();
    });
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
