/**
 * Alarmy w testach — prawdziwy serwis, atrapa poczty.
 *
 * Prawdziwy, bo wyciszanie powtórzeń jest jego istotą i podmiana go atrapą
 * przykryłaby dokładnie tę logikę, którą warto sprawdzać. Poczta jest atrapą,
 * żeby test nie wypisywał całych wiadomości do konsoli — `MailService` bez
 * `SMTP_HOST` loguje ich pełną treść.
 */
import { AlertsService } from '../src/alerts/alerts.service';
import type { MailService } from '../src/mail/mail.service';

export interface WyslanyAlert {
  to: string;
  subject: string;
  text: string;
}

export function alertyDoTestow(): { alerts: AlertsService; wyslane: WyslanyAlert[] } {
  const wyslane: WyslanyAlert[] = [];
  const poczta = {
    adresStrony: 'https://kelbroo.test',
    skrzynkaKelbroo: 'alarmy@kelbroo.test',
    send: async (wiadomosc: WyslanyAlert) => {
      wyslane.push(wiadomosc);
      return true;
    },
  } as unknown as MailService;

  return { alerts: new AlertsService(poczta), wyslane };
}
