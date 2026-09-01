import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { businessDateFor, toDateColumn, type BusinessDate } from '../common/business-date';
import type { StaffContext } from '../auth/auth.types';

/**
 * Ile dób biznesowych wolno objąć jednym raportem.
 *
 * Nie z powodu wydajności, tylko czytelności: wykres z półrocza na tablecie
 * kelnera jest paskiem szumu. Dłuższe okresy należą do eksportu, nie do ekranu.
 */
const MAX_DNI = 92;

/** Ile pozycji pokazujemy w rankingach. Dłuższa lista przestaje być rankingiem. */
const ILE_W_RANKINGU = 15;

/**
 * Zamówienia, które liczą się do sprzedaży.
 *
 * Ta sama reguła, którą liczy się kwoty wizyty i podział rachunku. Rozjechanie
 * się tych miejsc dałoby raport, który nie zgadza się z rachunkami — a wtedy
 * lepiej nie mieć raportu wcale.
 */
const SPRZEDANE: Prisma.OrderWhereInput['status'] = { notIn: ['rejected', 'canceled'] };

export interface RaportSprzedazy {
  od: BusinessDate;
  do: BusinessDate;
  currency: string;
  razem: { zamowien: number; sprzedazCents: number; sredniRachunekCents: number };
  dni: { data: BusinessDate; zamowien: number; sprzedazCents: number }[];
  dania: { nazwa: string; sztuk: number; sprzedazCents: number }[];
  /** Pozycje w karcie, których w tym okresie nikt nie zamówił. */
  martwe: { nazwa: string }[];
  godziny: { godzina: number; zamowien: number }[];
}

/**
 * Raport sprzedaży — jeden ekran, trzy pytania.
 *
 * Świadomie **wąski**: ile sprzedaliśmy, co się sprzedaje, o których godzinach.
 * To są pytania, które restaurator zadaje po dwóch tygodniach pracy; reszta
 * z [docs/02 §3.10](../../../docs/02-admin-panel.md) — rozliczenia kelnerów,
 * czasy realizacji, heatmapy — czeka, aż okaże się, których naprawdę brakuje.
 *
 * **Liczymy po dobie biznesowej, nie po kalendarzu.** Zamówienie z 00:30 należy
 * do wieczoru, który się jeszcze nie skończył; raport idący za kalendarzem
 * rozcinałby każdą nocną zmianę na pół i nie zgadzałby się z tym, co obsługa
 * pamięta z pracy.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async sprzedaz(staff: StaffContext, dni: number): Promise<RaportSprzedazy> {
    const restaurantId = staff.restaurantId;
    if (!restaurantId) {
      throw new ForbiddenException('Konto nie jest przypisane do lokalu.');
    }

    const okno = Math.min(Math.max(Math.trunc(dni) || 7, 1), MAX_DNI);

    return this.prisma.withTenant(staff.organizationId, async (tx) => {
      const restaurant = await tx.restaurant.findUniqueOrThrow({
        where: { id: restaurantId },
        select: { currency: true, timezone: true, businessDayStartHour: true },
      });

      const doDnia = businessDateFor(
        new Date(),
        restaurant.timezone,
        restaurant.businessDayStartHour,
      );
      const odDnia = przesun(doDnia, -(okno - 1));
      const zakres = { gte: toDateColumn(odDnia), lte: toDateColumn(doDnia) };

      const [suma, poDniach, poDaniach, godziny, martwe] = await Promise.all([
        tx.order.aggregate({
          where: { restaurantId, status: SPRZEDANE, businessDate: zakres },
          _count: { _all: true },
          _sum: { totalCents: true },
        }),
        tx.order.groupBy({
          by: ['businessDate'],
          where: { restaurantId, status: SPRZEDANE, businessDate: zakres },
          _count: { _all: true },
          _sum: { totalCents: true },
        }),
        this.ranking(tx, restaurantId, zakres),
        this.rozkladGodzin(tx, restaurantId, zakres, restaurant.timezone),
        this.martwePozycje(tx, restaurantId, zakres),
      ]);

      const zamowien = suma._count._all;
      const sprzedazCents = suma._sum.totalCents ?? 0;

      return {
        od: odDnia,
        do: doDnia,
        currency: restaurant.currency,
        razem: {
          zamowien,
          sprzedazCents,
          // Średnia z zaokrągleniem w dół: wartość „na oko", nie pozycja rachunku.
          sredniRachunekCents: zamowien > 0 ? Math.round(sprzedazCents / zamowien) : 0,
        },
        dni: this.uzupelnijDni(odDnia, doDnia, poDniach),
        dania: poDaniach,
        martwe,
        godziny,
      };
    });
  }

  /**
   * Ten sam raport jako plik CSV.
   *
   * Dwa zakresy zamiast jednego pliku z sekcjami: arkusze nie radzą sobie
   * z plikiem, w którym co kilkanaście wierszy zmienia się liczba kolumn.
   */
  async csv(
    staff: StaffContext,
    dni: number,
    zakres: 'dni' | 'dania',
  ): Promise<{ nazwaPliku: string; tresc: string }> {
    await this.wymagajEksportu(staff.organizationId);
    const raport = await this.sprzedaz(staff, dni);

    const tresc =
      zakres === 'dni'
        ? doCsv(
            ['Doba biznesowa', 'Zamówienia', `Sprzedaż (${raport.currency})`],
            raport.dni.map((dzien) => [dzien.data, dzien.zamowien, dzien.sprzedazCents / 100]),
          )
        : doCsv(
            ['Danie', 'Sztuk', `Sprzedaż (${raport.currency})`],
            raport.dania.map((danie) => [danie.nazwa, danie.sztuk, danie.sprzedazCents / 100]),
          );

    return { nazwaPliku: `kelbroo-${zakres}-${raport.od}_${raport.do}.csv`, tresc };
  }

  /**
   * Bramka planu **po stronie serwera**.
   *
   * Ukrycie przycisku w panelu jest wygodą, nie zabezpieczeniem — ta sama
   * zasada, co przy zdjęciach dań i ocenach.
   */
  private async wymagajEksportu(organizationId: string): Promise<void> {
    const wolno = await this.prisma.withTenant(organizationId, async (tx) => {
      const subscription = await tx.subscription.findUnique({ where: { organizationId } });
      return subscription?.reportsExportEnabled === true;
    });

    if (!wolno) {
      throw new ForbiddenException('Eksport raportów jest dostępny w planie Pro i wyższych.');
    }
  }

  /**
   * Ranking dań po nazwie ze snapshotu, nie po identyfikatorze pozycji z karty.
   *
   * Snapshot jest tym, co gość widział i za co zapłacił — a pozycja usunięta
   * z karty nie ma już wiersza, do którego dałoby się dołączyć. Cena zmieniona
   * w międzyczasie nie psuje przy tym sumy, bo liczymy z ceny zapisanej przy
   * zamówieniu, nie z bieżącego cennika.
   */
  private async ranking(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    zakres: { gte: Date; lte: Date },
  ): Promise<{ nazwa: string; sztuk: number; sprzedazCents: number }[]> {
    const wiersze = await tx.$queryRaw<{ nazwa: string; sztuk: bigint; kwota: bigint }[]>`
      SELECT i.name_snapshot AS nazwa,
             SUM(i.quantity)::bigint AS sztuk,
             SUM(i.quantity * i.unit_price_cents)::bigint AS kwota
        FROM public.order_item i
        JOIN public."order" o ON o.id = i.order_id
       WHERE o.restaurant_id = ${restaurantId}::uuid
         AND o.status NOT IN ('rejected', 'canceled')
         AND i.status <> 'canceled'
         AND o.business_date BETWEEN ${zakres.gte} AND ${zakres.lte}
       GROUP BY i.name_snapshot
       ORDER BY kwota DESC
       LIMIT ${ILE_W_RANKINGU}
    `;

    return wiersze.map((wiersz) => ({
      nazwa: wiersz.nazwa,
      sztuk: Number(wiersz.sztuk),
      sprzedazCents: Number(wiersz.kwota),
    }));
  }

  /**
   * Pozycje w karcie, których w tym okresie nikt nie zamówił.
   *
   * Liczone w bazie, **nie przez odjęcie od rankingu** — ranking jest obcięty
   * do kilkunastu pozycji, więc wszystko poza czołówką wypadałoby jako martwe.
   * To był pierwszy kształt tej funkcji i mylił dokładnie w tę stronę, w którą
   * nie wolno: „nikt tego nie zamawia" o daniu, które sprzedaje się codziennie.
   *
   * Nazwę bierzemy w języku domyślnym lokalu — to ten, którym obsługa mówi
   * o karcie między sobą.
   */
  private async martwePozycje(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    zakres: { gte: Date; lte: Date },
  ): Promise<{ nazwa: string }[]> {
    const wiersze = await tx.$queryRaw<{ nazwa: string }[]>`
      SELECT COALESCE(t.name, t_any.name) AS nazwa
        FROM public.menu_item m
        JOIN public.restaurant r ON r.id = m.restaurant_id
        LEFT JOIN public.menu_item_translation t
               ON t.menu_item_id = m.id AND t.locale = r.default_locale
        LEFT JOIN LATERAL (
               SELECT name FROM public.menu_item_translation
                WHERE menu_item_id = m.id ORDER BY locale LIMIT 1
             ) t_any ON true
       WHERE m.restaurant_id = ${restaurantId}::uuid
         AND m.is_archived = false
         AND NOT EXISTS (
               SELECT 1
                 FROM public.order_item i
                 JOIN public."order" o ON o.id = i.order_id
                WHERE i.menu_item_id = m.id
                  AND o.status NOT IN ('rejected', 'canceled')
                  AND i.status <> 'canceled'
                  AND o.business_date BETWEEN ${zakres.gte} AND ${zakres.lte}
             )
       ORDER BY nazwa
       LIMIT ${ILE_W_RANKINGU}
    `;

    return wiersze.filter((wiersz) => wiersz.nazwa !== null);
  }

  /**
   * Rozkład zamówień na godziny **w strefie lokalu**.
   *
   * Baza trzyma znaczniki w UTC; wykres godzinowy liczony bez przeliczenia
   * przesuwałby szczyt obiadowy o dwie godziny latem i o godzinę zimą.
   *
   * **Konwersja jest dwustopniowa i to nie jest ozdobnik.** Kolumna ma typ
   * `timestamp without time zone`, więc samo `AT TIME ZONE 'Europe/Warsaw'`
   * potraktowałoby zapisaną wartość jako **czas warszawski** i przeliczyło ją
   * na UTC — czyli w drugą stronę niż trzeba. Pierwsze `AT TIME ZONE 'UTC'`
   * mówi bazie, w jakiej strefie ta wartość jest; dopiero drugie przelicza.
   * Pierwsza wersja miała jedno i pokazywała południe o ósmej rano.
   */
  private async rozkladGodzin(
    tx: Prisma.TransactionClient,
    restaurantId: string,
    zakres: { gte: Date; lte: Date },
    timezone: string,
  ): Promise<{ godzina: number; zamowien: number }[]> {
    const wiersze = await tx.$queryRaw<{ godzina: number; ile: bigint }[]>`
      SELECT EXTRACT(
               HOUR FROM (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}
             )::int AS godzina,
             COUNT(*)::bigint AS ile
        FROM public."order" o
       WHERE o.restaurant_id = ${restaurantId}::uuid
         AND o.status NOT IN ('rejected', 'canceled')
         AND o.business_date BETWEEN ${zakres.gte} AND ${zakres.lte}
       GROUP BY 1
       ORDER BY 1
    `;

    const znalezione = new Map(wiersze.map((wiersz) => [wiersz.godzina, Number(wiersz.ile)]));
    // Pełna doba, także godziny puste — wykres z dziurami czyta się jak awaria.
    return Array.from({ length: 24 }, (_, godzina) => ({
      godzina,
      zamowien: znalezione.get(godzina) ?? 0,
    }));
  }

  /**
   * Dni bez zamówień też trafiają na listę, z zerem.
   *
   * Poniedziałek, w którym lokal był zamknięty, ma **zniknąć z wykresu jako
   * zero**, a nie przez zsunięcie się sąsiednich słupków — inaczej tydzień
   * wygląda na krótszy, niż był.
   */
  private uzupelnijDni(
    od: BusinessDate,
    doDnia: BusinessDate,
    wiersze: {
      businessDate: Date;
      _count: { _all: number };
      _sum: { totalCents: number | null };
    }[],
  ): { data: BusinessDate; zamowien: number; sprzedazCents: number }[] {
    const znalezione = new Map(
      wiersze.map((wiersz) => [
        wiersz.businessDate.toISOString().slice(0, 10),
        { zamowien: wiersz._count._all, sprzedazCents: wiersz._sum.totalCents ?? 0 },
      ]),
    );

    const dni: { data: BusinessDate; zamowien: number; sprzedazCents: number }[] = [];
    for (let dzien = od; dzien <= doDnia; dzien = przesun(dzien, 1)) {
      dni.push({ data: dzien, ...(znalezione.get(dzien) ?? { zamowien: 0, sprzedazCents: 0 }) });
    }
    return dni;
  }
}

/**
 * Raport jako plik do arkusza.
 *
 * **Średnik, przecinek dziesiętny i BOM** — trzy rzeczy, bez których plik otwiera
 * się w polskim Excelu jako jedna kolumna krzaków. To nie jest wybór estetyczny:
 * arkusz w polskiej lokalizacji oczekuje średnika jako separatora pól i przecinka
 * w liczbach, a bez znacznika BOM traktuje UTF-8 jak stronę kodową Windows.
 *
 * Kwoty w złotych, nie w groszach: plik trafia do księgowej, nie do programisty.
 */
export function doCsv(naglowki: string[], wiersze: (string | number)[][]): string {
  const komorka = (wartosc: string | number): string => {
    if (typeof wartosc === 'number') {
      // Liczba sztuk ma być „3", nie „3,00" — dwa miejsca po przecinku przy
      // liczniku wyglądają jak kwota i mylą przy pierwszym spojrzeniu.
      return Number.isInteger(wartosc) ? String(wartosc) : wartosc.toFixed(2).replace('.', ',');
    }
    // Cudzysłów podwajamy, całość w cudzysłowie — nazwa dania bywa
    // ze średnikiem („Zestaw: zupa; drugie") i rozbiłaby wiersz na dwa.
    return `"${wartosc.replace(/"/g, '""')}"`;
  };

  const linie = [naglowki, ...wiersze].map((wiersz) => wiersz.map(komorka).join(';'));
  return `\ufeff${linie.join('\r\n')}\r\n`;
}

/** Przesuwa datę biznesową o zadaną liczbę dni. Kalendarz, nie moment w czasie. */
function przesun(data: BusinessDate, dni: number): BusinessDate {
  const kalendarz = new Date(`${data}T00:00:00.000Z`);
  kalendarz.setUTCDate(kalendarz.getUTCDate() + dni);
  return kalendarz.toISOString().slice(0, 10);
}
