import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { ramka, tekstem, type Ramka } from '../mail/templates';

/**
 * Jak długo milczymy o awarii, o której już napisaliśmy.
 *
 * Bez tego pojedyncza zepsuta konfiguracja PayU wysyłałaby wiadomość co dziesięć
 * minut — sto czterdzieści cztery dziennie. Skrzynka zalana powtórzeniami tego
 * samego alarmu jest gorsza niż jej brak: przestaje się ją czytać dokładnie
 * wtedy, gdy przyjdzie druga, inna awaria.
 */
const CISZA_MS = 60 * 60_000;

export type WagaAlertu = 'awaria' | 'uwaga';

export interface Alert {
  /**
   * Klucz powtórzeń — po nim rozpoznajemy, że to **ta sama** awaria.
   *
   * Musi opisywać przyczynę, nie wystąpienie: `platnosci.operator`, a nie numer
   * zamówienia, przy którym akurat wyszła. Klucz z numerem w środku nigdy się
   * nie powtórzy i wycisza się sam.
   */
  klucz: string;
  temat: string;
  akapity: string[];
  waga?: WagaAlertu;
}

interface Otwarty {
  /** Kiedy wysłaliśmy ostatnią wiadomość o tej awarii. */
  wyslanyO: number;
  /** Kiedy zgłosiła się po raz pierwszy — trafia do treści powtórki. */
  pierwszyRaz: number;
  /** Ile razy wróciła w czasie ciszy. */
  wyciszonych: number;
}

/**
 * Alarmy dla nas — nie dla klienta.
 *
 * Powód istnienia jest jeden: **awarię widać dziś dopiero wtedy, gdy zadzwoni
 * restauracja w środku serwisu.** Zadanie cykliczne, które przestało chodzić,
 * poczta, która nie wychodzi, operator płatności odmawiający autoryzacji —
 * wszystko to psuje usługę po cichu i nie zostawia śladu poza logiem, do którego
 * nikt nie zagląda bez powodu.
 *
 * Czego ten serwis **nie** robi: nie wykryje, że proces API nie żyje. Martwy
 * proces nie wyśle wiadomości o własnej śmierci — to zadanie dla monitora
 * stojącego poza maszyną, odpytującego `/api/health` (docs/todo.md §7).
 *
 * **Zgłoszenie alarmu nigdy nie wywraca operacji, w której się dzieje.** Ta sama
 * zasada co przy poczcie: nieudany alarm jest do naprawienia, przerwane
 * zamówienie kelnera — nie. Wszystkie błędy zostają tutaj i lądują w logu.
 *
 * **Stan pamiętamy w procesie**, tak jak licznik żądań i zadania cykliczne
 * (app.module.ts): przy jednej instancji API to wystarcza. Restart kasuje
 * pamięć, więc trwająca awaria zgłosi się wtedy drugi raz — to dopuszczalny
 * koszt, bo restart zwykle jest właśnie próbą jej naprawienia.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly otwarte = new Map<string, Otwarty>();

  constructor(private readonly mail: MailService) {}

  /** Klucze awarii, które trwają. Czyta je `/api/health`. */
  get trwajace(): string[] {
    return [...this.otwarte.keys()];
  }

  /**
   * Zgłasza awarię.
   *
   * Pierwsze wystąpienie idzie pocztą od razu. Kolejne w oknie ciszy są zliczane
   * i wychodzą jedną wiadomością po jego upływie — z informacją, ile razy i od
   * kiedy, bo to jedyna liczba mówiąca, czy awaria trwa, czy mrugnęła raz.
   */
  async zglos(alert: Alert): Promise<void> {
    try {
      const teraz = Date.now();
      const otwarty = this.otwarte.get(alert.klucz);

      if (!otwarty) {
        this.otwarte.set(alert.klucz, {
          wyslanyO: teraz,
          pierwszyRaz: teraz,
          wyciszonych: 0,
        });
        this.zapisz(alert);
        await this.wyslij(alert, []);
        return;
      }

      otwarty.wyciszonych += 1;
      if (teraz - otwarty.wyslanyO < CISZA_MS) return;

      const powtorzen = otwarty.wyciszonych;
      const od = new Date(otwarty.pierwszyRaz).toISOString();
      otwarty.wyslanyO = teraz;
      otwarty.wyciszonych = 0;

      this.zapisz(alert);
      await this.wyslij(alert, [
        `To zgłoszenie powtórzyło się <strong>${powtorzen} razy</strong> od ${od}. ` +
          'Awaria trwa i sama nie ustąpi.',
      ]);
    } catch (przyczyna) {
      // Nieudany alarm nie ma prawa przewrócić tego, co alarmował.
      this.logger.error(`Nie udało się zgłosić alarmu ${alert.klucz}: ${String(przyczyna)}`);
    }
  }

  /**
   * Odwołuje alarm, który ustąpił.
   *
   * Milczy, gdy nic nie było zgłoszone — „wróciło do normy" bez wcześniejszej
   * awarii jest wyłącznie szumem. Odwołanie ma wartość dokładnie odwrotną do
   * alarmu: bez niego nie wiadomo, czy jechać na miejsce.
   */
  async ustapilo(klucz: string, temat: string, akapity: string[]): Promise<void> {
    try {
      const otwarty = this.otwarte.get(klucz);
      if (!otwarty) return;

      this.otwarte.delete(klucz);
      const trwala = Math.round((Date.now() - otwarty.pierwszyRaz) / 60_000);
      this.logger.log(`Alarm ${klucz} ustąpił po ${trwala} min`);

      await this.wyslij({ klucz, temat, akapity, waga: 'uwaga' }, [
        `Awaria trwała około <strong>${trwala} min</strong>.`,
      ]);
    } catch (przyczyna) {
      this.logger.error(`Nie udało się odwołać alarmu ${klucz}: ${String(przyczyna)}`);
    }
  }

  /**
   * Uruchamia zadanie cykliczne i zgłasza jego wywrotkę.
   *
   * Zadanie w `@Cron`, które rzuci wyjątkiem, nie zostawia po sobie nic poza
   * odrzuconą obietnicą — nikt się nie dowie, że przestało chodzić. To dotyczy
   * uzgadniania płatności, czyli jedynego mechanizmu, który dziś odzyskuje
   * zgubione wpłaty.
   *
   * Zdanego zadania **nie ponawiamy**: wróci samo o swojej porze. Ponowienie
   * w miejscu awarii zwykle tylko powiela jej skutki.
   */
  async pilnuj(nazwa: string, zadanie: () => Promise<void>): Promise<void> {
    try {
      await zadanie();
      await this.ustapilo(`zadanie.${nazwa}`, `Zadanie „${nazwa}" znów działa`, [
        `Cykliczne zadanie <strong>${nazwa}</strong> wykonało się bez błędu.`,
      ]);
    } catch (przyczyna) {
      const opis = przyczyna instanceof Error ? przyczyna.message : String(przyczyna);
      await this.zglos({
        klucz: `zadanie.${nazwa}`,
        temat: `Zadanie „${nazwa}" przestało działać`,
        akapity: [
          `Cykliczne zadanie <strong>${nazwa}</strong> zakończyło się błędem: <code>${opis}</code>`,
          'Zadanie wróci o swojej porze, ale dopóki przyczyna trwa, będzie padać dalej. ' +
            'Szczegóły — ze śladem stosu — są w logu API.',
        ],
        waga: 'awaria',
      });
    }
  }

  private zapisz(alert: Alert): void {
    const komunikat = `[${alert.waga ?? 'awaria'}] ${alert.klucz}: ${alert.temat}`;
    if ((alert.waga ?? 'awaria') === 'awaria') this.logger.error(komunikat);
    else this.logger.warn(komunikat);
  }

  private async wyslij(alert: Alert, dopiski: string[]): Promise<void> {
    const tresc: Ramka = {
      adresStrony: this.mail.adresStrony,
      naglowek: alert.temat,
      akapity: [...alert.akapity, ...dopiski],
      stopka: [`Klucz alarmu: ${alert.klucz}`],
    };

    // Znacznik w temacie jest po to, żeby dało się na niego założyć regułę
    // w skrzynce — alarm ma wpadać w oczy między pocztą od klientów.
    await this.mail.send({
      to: this.mail.skrzynkaKelbroo,
      subject: `[kelbroo] ${alert.temat}`,
      text: tekstem(tresc),
      html: ramka(tresc),
    });
  }
}
