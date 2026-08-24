import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export interface Wiadomosc {
  to: string;
  subject: string;
  /** Wersja tekstowa. Zawsze wymagana — część klientów nie pokaże HTML-a. */
  text: string;
  html?: string;
}

/**
 * Wysyłka poczty.
 *
 * Dostawca jest abstrakcją od pierwszej linii, tak samo jak fiskalizacja
 * (CLAUDE.md): bez `SMTP_HOST` nic nie wychodzi na zewnątrz, a wiadomość ląduje
 * w logu. Dzięki temu testy i uruchomienie lokalne nie mogą wysłać niczego
 * do prawdziwej skrzynki przez przypadek — a ścieżka kodu jest ta sama.
 *
 * **Wysyłka nigdy nie wywraca operacji, w której się dzieje.** Konto założone,
 * a poczta niedostępna, to sytuacja do naprawienia ponowną wysyłką, nie do
 * cofania rejestracji. Błędy trafiają do logu i tam ich szukać.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transport: Transporter | null = null;

  /** Nadawca wszystkich wiadomości. */
  private get nadawca(): string {
    return process.env.MAIL_FROM ?? 'kelbroo <kontakt@kelbroo.com>';
  }

  /** Skrzynka, na którą idą powiadomienia dla nas. */
  get skrzynkaKelbroo(): string {
    return process.env.MAIL_NOTIFY ?? 'kontakt@kelbroo.com';
  }

  /** Adres, pod którym gość albo klient klika odnośniki z wiadomości. */
  get adresStrony(): string {
    return process.env.PUBLIC_SITE_URL ?? 'https://kelbroo.com';
  }

  private get skonfigurowana(): boolean {
    return Boolean(process.env.SMTP_HOST);
  }

  private polaczenie(): Transporter {
    if (!this.transport) {
      this.transport = createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        // 465 to SMTPS od pierwszego bajtu; 587 podnosi TLS przez STARTTLS.
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      });
    }
    return this.transport;
  }

  async send(wiadomosc: Wiadomosc): Promise<boolean> {
    if (!this.skonfigurowana) {
      this.logger.log(`[poczta wyłączona] do ${wiadomosc.to}: ${wiadomosc.subject}`);
      return false;
    }

    try {
      await this.polaczenie().sendMail({
        from: this.nadawca,
        to: wiadomosc.to,
        subject: wiadomosc.subject,
        text: wiadomosc.text,
        html: wiadomosc.html,
      });
      return true;
    } catch (blad) {
      this.logger.error(`Nie udało się wysłać do ${wiadomosc.to}: ${String(blad)}`);
      return false;
    }
  }
}
