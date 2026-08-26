/**
 * Szew między kelbroo a operatorem płatności za abonament.
 *
 * Operator jest wymienny z założenia (CLAUDE.md: „wymienny provider płatności"),
 * więc reszta kodu nie zna słowa „PayU". Zna trzy rzeczy: jak poprosić o adres
 * do zapłaty, jak odczytać powiadomienie i czy operator jest w ogóle włączony.
 *
 * Kwoty przechodzą tędy **w groszach brutto** — operator inkasuje kwotę
 * z podatkiem, rozbicie na netto i VAT zostaje u nas, na potrzeby faktury.
 */

export interface PaymentOrderRequest {
  /** Nasz identyfikator zamówienia. Po nim odnajdujemy je w powiadomieniu. */
  externalId: string;
  grossCents: number;
  /** Kod ISO 4217. Dziś zawsze PLN, ale kwota bez waluty nic nie znaczy. */
  currency: string;
  description: string;
  buyer: { email: string; firstName?: string; lastName?: string };
  /**
   * Adres IP płacącego. Operatorzy wymagają go do oceny ryzyka i odrzucają
   * zamówienie bez niego.
   */
  customerIp: string;
  /** Dokąd wrócić po zapłacie. **Nie jest** potwierdzeniem płatności. */
  continueUrl: string;
  /** Dokąd operator ma wysłać powiadomienie o zmianie statusu. */
  notifyUrl: string;
}

export interface PaymentOrderCreated {
  /** Adres, pod który trzeba odesłać przeglądarkę klienta. */
  redirectUri: string;
  /** Identyfikator nadany przez operatora. */
  providerOrderId: string;
}

/**
 * Odczytane powiadomienie.
 *
 * `pending` obejmuje wszystkie stany przejściowe operatora — dla nas znaczą to
 * samo: pieniędzy jeszcze nie ma, więc abonament się nie rusza.
 */
export interface PaymentNotification {
  externalId: string;
  providerOrderId: string;
  status: 'pending' | 'completed' | 'canceled';
  grossCents: number;
  currency: string;
}

/** Podpis się nie zgadza albo go brakuje — żądanie nie pochodzi od operatora. */
export class PaymentSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentSignatureError';
  }
}

export abstract class SubscriptionPaymentProvider {
  /** Nazwa do zapisania przy płatności — kiedyś będzie ich więcej niż jedna. */
  abstract readonly name: string;

  /**
   * Czy operator jest skonfigurowany. Bez tego checkout ma odmówić **przed**
   * pokazaniem klientowi jakiegokolwiek formularza — gorsze od braku płatności
   * jest tylko przycisk „Zapłać", który prowadzi donikąd.
   */
  abstract get configured(): boolean;

  abstract createOrder(request: PaymentOrderRequest): Promise<PaymentOrderCreated>;

  /**
   * Sprawdza podpis i odczytuje treść powiadomienia.
   *
   * Dostaje **surowe bajty**, nie sparsowany obiekt: podpis liczy się z dokładnie
   * tego, co przyszło. Ponowne złożenie JSON-a z obiektu zmieniłoby białe znaki
   * i kolejność pól, więc podpis nigdy by się nie zgodził.
   */
  abstract readNotification(rawBody: Buffer, signatureHeader?: string): PaymentNotification;
}
