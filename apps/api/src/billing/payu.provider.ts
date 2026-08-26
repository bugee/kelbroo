import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  PaymentSignatureError,
  SubscriptionPaymentProvider,
  type PaymentNotification,
  type PaymentOrderCreated,
  type PaymentOrderRequest,
} from './payment-provider';

const BAZA = {
  sandbox: 'https://secure.snd.payu.com',
  production: 'https://secure.payu.com',
} as const;

/** Token OAuth odnawiamy z zapasem — wygaśnięcie w połowie zakupu jest do uniknięcia. */
const ZAPAS_TOKENU_MS = 60_000;

interface Token {
  wartosc: string;
  wygasa: number;
}

/**
 * Stany zamówienia u PayU.
 *
 * `WAITING_FOR_CONFIRMATION` pojawia się, gdy POS ma wyłączony automatyczny
 * odbiór — pieniądze są zablokowane, ale nie zaksięgowane, więc dla nas to
 * wciąż `pending`. Odbieranie takich wpłat wymagałoby osobnego wywołania
 * i świadomej decyzji; dziś zakładamy POS z automatycznym odbiorem.
 */
const STATUSY: Record<string, PaymentNotification['status']> = {
  NEW: 'pending',
  PENDING: 'pending',
  WAITING_FOR_CONFIRMATION: 'pending',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
};

/**
 * PayU — operator płatności za abonament.
 *
 * PayU nie ma odpowiednika subskrypcji: przyjmuje pojedyncze płatności i tyle.
 * Cykl rozliczeniowy, przedłużanie okresu i przypomnienia są po naszej stronie
 * (docs/architecture.md §11a) — tutaj zostaje wyłącznie „poproś o pieniądze"
 * i „powiedz, czy wpłynęły".
 */
@Injectable()
export class PayuProvider extends SubscriptionPaymentProvider {
  readonly name = 'payu';
  private readonly logger = new Logger(PayuProvider.name);
  private token: Token | null = null;

  private get baza(): string {
    return process.env.PAYU_ENV === 'production' ? BAZA.production : BAZA.sandbox;
  }

  get configured(): boolean {
    return Boolean(
      process.env.PAYU_POS_ID && process.env.PAYU_CLIENT_SECRET && process.env.PAYU_SECOND_KEY,
    );
  }

  private wymagajKonfiguracji(): {
    posId: string;
    clientId: string;
    clientSecret: string;
    secondKey: string;
  } {
    const posId = process.env.PAYU_POS_ID;
    const clientSecret = process.env.PAYU_CLIENT_SECRET;
    const secondKey = process.env.PAYU_SECOND_KEY;

    if (!posId || !clientSecret || !secondKey) {
      throw new ServiceUnavailableException(
        'Płatności nie są skonfigurowane. Napisz na kontakt@kelbroo.com.',
      );
    }

    // U PayU `client_id` bywa równy identyfikatorowi POS-u, ale nie musi —
    // dlatego jest osobną zmienną z sensownym domyślnym.
    return { posId, clientId: process.env.PAYU_CLIENT_ID ?? posId, clientSecret, secondKey };
  }

  private async autoryzuj(): Promise<string> {
    if (this.token && this.token.wygasa > Date.now()) return this.token.wartosc;

    const { clientId, clientSecret } = this.wymagajKonfiguracji();
    const odpowiedz = await fetch(`${this.baza}/pl/standard/user/oauth/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!odpowiedz.ok) {
      this.logger.error(`PayU odmówił autoryzacji: ${odpowiedz.status}`);
      throw new ServiceUnavailableException('Operator płatności jest chwilowo niedostępny.');
    }

    const dane = (await odpowiedz.json()) as { access_token: string; expires_in: number };
    this.token = {
      wartosc: dane.access_token,
      wygasa: Date.now() + dane.expires_in * 1000 - ZAPAS_TOKENU_MS,
    };
    return this.token.wartosc;
  }

  async createOrder(request: PaymentOrderRequest): Promise<PaymentOrderCreated> {
    const { posId } = this.wymagajKonfiguracji();
    const token = await this.autoryzuj();
    const kwota = String(request.grossCents);

    const odpowiedz = await fetch(`${this.baza}/api/v2_1/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      // PayU odpowiada przekierowaniem 302 z treścią JSON w środku. Domyślne
      // `fetch` poszłoby za nim i zwróciło stronę płatności jako HTML — stąd
      // `redirect: 'manual'`. To pierwsza rzecz, o którą rozbija się ta integracja.
      redirect: 'manual',
      body: JSON.stringify({
        notifyUrl: request.notifyUrl,
        continueUrl: request.continueUrl,
        customerIp: request.customerIp,
        merchantPosId: posId,
        description: request.description,
        currencyCode: request.currency,
        totalAmount: kwota,
        extOrderId: request.externalId,
        buyer: {
          email: request.buyer.email,
          firstName: request.buyer.firstName,
          lastName: request.buyer.lastName,
          language: 'pl',
        },
        products: [{ name: request.description, unitPrice: kwota, quantity: '1' }],
      }),
    });

    const tresc = await odpowiedz.text();
    if (odpowiedz.status !== 302 && odpowiedz.status !== 200 && odpowiedz.status !== 201) {
      this.logger.error(`PayU odrzucił zamówienie ${request.externalId}: ${odpowiedz.status}`);
      throw new ServiceUnavailableException('Nie udało się rozpocząć płatności. Spróbuj ponownie.');
    }

    const dane = JSON.parse(tresc) as {
      status?: { statusCode?: string };
      redirectUri?: string;
      orderId?: string;
    };

    if (dane.status?.statusCode !== 'SUCCESS' || !dane.redirectUri || !dane.orderId) {
      this.logger.error(
        `PayU zwrócił niepełną odpowiedź dla ${request.externalId}: ${dane.status?.statusCode}`,
      );
      throw new ServiceUnavailableException('Nie udało się rozpocząć płatności. Spróbuj ponownie.');
    }

    return { redirectUri: dane.redirectUri, providerOrderId: dane.orderId };
  }

  readNotification(rawBody: Buffer, signatureHeader?: string): PaymentNotification {
    const { secondKey } = this.wymagajKonfiguracji();
    this.sprawdzPodpis(rawBody, signatureHeader, secondKey);

    const dane = JSON.parse(rawBody.toString('utf8')) as {
      order?: {
        orderId?: string;
        extOrderId?: string;
        status?: string;
        totalAmount?: string;
        currencyCode?: string;
      };
    };

    const zamowienie = dane.order;
    if (!zamowienie?.extOrderId || !zamowienie.orderId || !zamowienie.status) {
      throw new PaymentSignatureError('Powiadomienie nie zawiera zamówienia.');
    }

    const status = STATUSY[zamowienie.status];
    if (!status) {
      throw new PaymentSignatureError(`Nieznany status PayU: ${zamowienie.status}`);
    }

    return {
      externalId: zamowienie.extOrderId,
      providerOrderId: zamowienie.orderId,
      status,
      grossCents: Number(zamowienie.totalAmount ?? 0),
      currency: zamowienie.currencyCode ?? 'PLN',
    };
  }

  /**
   * Podpis powiadomienia.
   *
   * To **jedyne** uwierzytelnienie tego wejścia: adres jest publiczny, a treść
   * mówi, komu przedłużyć abonament. Bez sprawdzenia podpisu wystarczyłby jeden
   * `curl`, żeby opłacić sobie rok.
   *
   * PayU podpisuje skrótem z połączenia surowej treści i drugiego klucza.
   * Domyślnie MD5; konta z nowszą konfiguracją używają SHA-256, więc bierzemy
   * algorytm z nagłówka zamiast zakładać.
   */
  private sprawdzPodpis(rawBody: Buffer, signatureHeader: string | undefined, secondKey: string) {
    if (!signatureHeader) {
      throw new PaymentSignatureError('Powiadomienie bez podpisu.');
    }

    const pola = new Map(
      signatureHeader
        .split(';')
        .map((fragment) => fragment.split('='))
        .filter((para): para is [string, string] => para.length === 2)
        .map(([klucz, wartosc]) => [klucz.trim().toLowerCase(), wartosc.trim()]),
    );

    const podpis = pola.get('signature');
    if (!podpis) {
      throw new PaymentSignatureError('Powiadomienie bez podpisu.');
    }

    const algorytm = (pola.get('algorithm') ?? 'MD5').toUpperCase();
    const nazwa = algorytm === 'SHA-256' || algorytm === 'SHA256' ? 'sha256' : 'md5';
    if (algorytm !== 'MD5' && nazwa !== 'sha256') {
      throw new PaymentSignatureError(`Nieobsługiwany algorytm podpisu: ${algorytm}`);
    }

    const oczekiwany = createHash(nazwa)
      .update(Buffer.concat([rawBody, Buffer.from(secondKey, 'utf8')]))
      .digest('hex');

    // Porównanie stałoczasowe: podpis jest sekretem, a różnica czasu odpowiedzi
    // pozwalałaby zgadywać go bajt po bajcie.
    const podany = Buffer.from(podpis.toLowerCase(), 'utf8');
    const wzorzec = Buffer.from(oczekiwany, 'utf8');
    if (podany.length !== wzorzec.length || !timingSafeEqual(podany, wzorzec)) {
      throw new PaymentSignatureError('Podpis powiadomienia się nie zgadza.');
    }
  }
}
