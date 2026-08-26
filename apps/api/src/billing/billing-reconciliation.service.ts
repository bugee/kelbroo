import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from './billing.service';
import { SubscriptionPaymentProvider } from './payment-provider';

/**
 * Ile czasu dajemy powiadomieniu, zanim uznamy jego brak za podejrzany.
 *
 * Krócej nie ma sensu: klient dopiero co wyszedł na bramkę i wciąż może
 * wpisywać kod BLIK. Dłużej znaczy, że opłacony klient siedzi z wyłączonym
 * zamawianiem.
 */
const PROG_MINUT = 15;

/**
 * Po tym czasie zamówienie bez wpłaty uznajemy za porzucone.
 *
 * Dwie doby, a nie godzina: przelew zwykły potrafi księgować się następnego dnia
 * roboczego, a przy piątkowym zleceniu jeszcze później. Zamknięcie takiego
 * zamówienia zbyt wcześnie kazałoby klientowi płacić drugi raz.
 */
const PORZUCONE_PO_H = 48;

/**
 * Uzgadnianie z operatorem płatności.
 *
 * Powód istnienia: powiadomienie potrafi nie dotrzeć — zła konfiguracja adresu
 * w panelu PayU, chwilowa awaria naszego API, wygasły certyfikat. Wtedy klient
 * zapłacił, a abonament się nie przedłużył, i **nikt się o tym nie dowie**,
 * dopóki nie zadzwoni. To najgorsza klasa błędu, jaką ma ten moduł.
 *
 * Samo „wisi w pending" niczego nie dowodzi: identycznie wygląda klient, który
 * rozmyślił się na bramce, a takich jest znacznie więcej. Rozróżnia je wyłącznie
 * operator, więc pytamy operatora zamiast zgadywać z własnej bazy.
 *
 * Zadanie **naprawia**, nie tylko alarmuje: zaksięgowanie idzie tą samą drogą
 * co powiadomienie, z tą samą bramką przed podwójnym przedłużeniem. Alarm leci
 * dopiero wtedy, gdy okaże się, że powiadomienie faktycznie przepadło — bo to
 * znaczy, że coś jest zepsute i samo się nie naprawi.
 *
 * **Jedna instancja API.** Przy kilku każda uruchomiłaby ten przegląd osobno.
 * Podwójnego księgowania to nie spowoduje (broni przed nim bramka w bazie), ale
 * PayU byłby pytany bez potrzeby. Przy skalowaniu w poziomie trzeba tu dołożyć
 * blokadę w Redisie.
 */
@Injectable()
export class BillingReconciliationService {
  private readonly logger = new Logger(BillingReconciliationService.name);

  constructor(
    private readonly billing: BillingService,
    private readonly provider: SubscriptionPaymentProvider,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async przeglad(): Promise<void> {
    // Bez skonfigurowanego operatora nie ma kogo pytać. Cicho, bo to normalny
    // stan wdrożenia przed podłączeniem płatności — nie awaria do zgłaszania
    // co dziesięć minut.
    if (!this.provider.configured) return;

    const teraz = Date.now();
    const granicaPorzucenia = new Date(teraz - PORZUCONE_PO_H * 3_600_000);
    const czekajace = await this.billing.oczekujaceZamowienia(
      new Date(teraz - PROG_MINUT * 60_000),
      granicaPorzucenia,
    );

    if (czekajace.length > 0) {
      this.logger.log(`Uzgadnianie: ${czekajace.length} zamówień do sprawdzenia`);
    }

    for (const zamowienie of czekajace) {
      try {
        await this.sprawdz(zamowienie);
      } catch (przyczyna) {
        // Gdy operator nie odpowiada, kolejne pytania też polegną — kończymy
        // przegląd i wracamy za dziesięć minut. Rozpoznajemy to po typie
        // wyjątku, nie po treści komunikatu: przeredagowanie zdania nie może
        // po cichu wyłączyć tego wyjścia.
        if (przyczyna instanceof ServiceUnavailableException) {
          this.logger.error(`Uzgadnianie przerwane — operator niedostępny: ${przyczyna.message}`);
          return;
        }
        // Pojedyncze zamówienie nie może zatrzymać przeglądu.
        const opis = przyczyna instanceof Error ? przyczyna.message : String(przyczyna);
        this.logger.error(`Uzgadnianie ${zamowienie.externalId}: ${opis}`);
      }
    }

    // Poza pętlą i poza warunkiem na jej długość: zamówienia starsze niż okno
    // porzucenia nie trafiają do `czekajace`, więc przy pustym oknie nigdy by
    // się nie doczekały zamknięcia.
    await this.zamknijPorzucone(granicaPorzucenia);
  }

  private async sprawdz(zamowienie: {
    externalId: string;
    organizationId: string;
    payuOrderId: string | null;
  }): Promise<void> {
    // Bez identyfikatora operatora zamówienie nigdy do niego nie dotarło —
    // nie ma o co pytać, a klient i tak nie zobaczył bramki.
    if (!zamowienie.payuOrderId) {
      await this.billing.porzuc(zamowienie.organizationId, zamowienie.externalId);
      return;
    }

    const stan = await this.provider.fetchOrder(zamowienie.payuOrderId);
    if (!stan) return;
    if (stan.status === 'pending') return;

    const zaksiegowano = await this.billing.zastosujStan(zamowienie.organizationId, stan);
    if (!zaksiegowano) return;

    // Doszliśmy do wpłaty sami, czyli powiadomienie nie dotarło. Klient ma już
    // swój okres, ale przyczyna zostaje i uderzy w następnego płacącego.
    this.logger.warn(`Odzyskano wpłatę bez powiadomienia: ${zamowienie.externalId}`);
    await this.billing.zawiadomNas('Wpłata odzyskana przez uzgadnianie', [
      `Zamówienie <strong>${zamowienie.externalId}</strong> zostało opłacone, ale ` +
        'powiadomienie od PayU nigdy do nas nie dotarło. Abonament został przedłużony ' +
        'przez zadanie uzgadniające, więc klient nie ucierpiał.',
      '<strong>To nie naprawia przyczyny.</strong> Sprawdź w panelu PayU adres ' +
        'powiadomień — powinien wskazywać na <code>/api/billing/notify</code> pod ' +
        'domeną panelu — oraz log API pod kątem odrzuconych podpisów.',
    ]);
  }

  /**
   * Zamyka zamówienia starsze niż okno porzucenia.
   *
   * Bez tego lista wiszących rosłaby w nieskończoność, a każdy przegląd pytałby
   * PayU o zamówienia sprzed miesięcy.
   */
  private async zamknijPorzucone(granica: Date): Promise<void> {
    const stare = await this.billing.oczekujaceZamowienia(granica, new Date(0));
    for (const zamowienie of stare) {
      await this.billing.porzuc(zamowienie.organizationId, zamowienie.externalId);
    }
    if (stare.length > 0) {
      this.logger.log(`Zamknięto ${stare.length} porzuconych zamówień`);
    }
  }
}
