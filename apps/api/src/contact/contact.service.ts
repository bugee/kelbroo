import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { ramka, tekstem, type Ramka } from '../mail/templates';
import type { ContactDto } from './dto';

/** Zamienia znaki, które w HTML-u znaczą coś innego niż w tekście. */
const bezpiecznie = (tekst: string): string =>
  tekst.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const nowaLinia = (tekst: string): string => bezpiecznie(tekst).replace(/\n/g, '<br>');

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly mail: MailService) {}

  /**
   * Przyjmuje zgłoszenie i przekazuje je dalej.
   *
   * Odpowiadamy **tak samo niezależnie od wyniku** — także gdy w pułapkę wpadł
   * bot. Robot, któremu powiemy „odrzucono", spróbuje inaczej; robot, któremu
   * podziękujemy, uzna, że zadziałało.
   */
  async przyjmij(zgloszenie: ContactDto, ip: string): Promise<void> {
    if (zgloszenie.website) {
      this.logger.warn(`Formularz kontaktowy — pułapka zadziałała (${ip})`);
      return;
    }

    const prezentacja = zgloszenie.purpose === 'prezentacja';
    this.logger.log(
      `Zgłoszenie z formularza (${prezentacja ? 'prezentacja' : 'pytanie'}): ${zgloszenie.email}`,
    );

    await Promise.all([this.doNas(zgloszenie, prezentacja), this.potwierdzenie(zgloszenie)]);
  }

  private async doNas(zgloszenie: ContactDto, prezentacja: boolean): Promise<void> {
    const wiersze = [
      `<strong>${bezpiecznie(zgloszenie.name)}</strong>`,
      zgloszenie.company ? `Firma: ${bezpiecznie(zgloszenie.company)}` : null,
      `E-mail: ${bezpiecznie(zgloszenie.email)}`,
      zgloszenie.phone ? `Telefon: ${bezpiecznie(zgloszenie.phone)}` : null,
      prezentacja && zgloszenie.preferredTime
        ? `Preferowany termin: <strong>${bezpiecznie(zgloszenie.preferredTime)}</strong>`
        : null,
    ].filter(Boolean) as string[];

    const tresc: Ramka = {
      adresStrony: this.mail.adresStrony,
      naglowek: prezentacja ? 'Prośba o prezentację' : 'Pytanie ze strony',
      akapity: [wiersze.join('<br>'), nowaLinia(zgloszenie.message)],
      stopka: [
        // Odpowiedź idzie z naszej skrzynki, więc adres nadawcy musi być widoczny
        // w treści — inaczej trzeba go szukać w nagłówkach.
        `Odpisz na: ${bezpiecznie(zgloszenie.email)}`,
      ],
    };

    await this.mail.send({
      to: this.mail.skrzynkaKelbroo,
      subject: prezentacja
        ? `Prezentacja: ${zgloszenie.company ?? zgloszenie.name}`
        : `Pytanie: ${zgloszenie.company ?? zgloszenie.name}`,
      text: tekstem(tresc),
      html: ramka(tresc),
    });
  }

  /**
   * Potwierdzenie dla nadawcy.
   *
   * Formularz, po którym nic nie przychodzi, każe zgadywać, czy wiadomość
   * doszła — a przy zapytaniu handlowym to moment, w którym łatwo napisać
   * do konkurencji.
   */
  private async potwierdzenie(zgloszenie: ContactDto): Promise<void> {
    const prezentacja = zgloszenie.purpose === 'prezentacja';
    const tresc: Ramka = {
      adresStrony: this.mail.adresStrony,
      naglowek: 'Mamy Twoją wiadomość',
      akapity: [
        `Dziękujemy — odezwiemy się na ten adres w ciągu jednego dnia roboczego.`,
        prezentacja
          ? 'Przy prezentacji pokazujemy panel na żywo i przechodzimy przez zamówienie ' +
            'od skanu kodu QR do wydania z kuchni. Zajmuje to około 20 minut.'
          : 'Jeśli sprawa jest pilna, napisz wprost na kontakt@kelbroo.com.',
      ],
      stopka: ['To jest potwierdzenie automatyczne — nie trzeba na nie odpowiadać.'],
    };

    await this.mail.send({
      to: zgloszenie.email,
      subject: 'kelbroo — mamy Twoją wiadomość',
      text: tekstem(tresc),
      html: ramka(tresc),
    });
  }
}
