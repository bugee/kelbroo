import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { SubscriptionReminderKind } from '@prisma/client';
import { PLANS, type PlanId } from '@kelbroo/types';
import { AlertsService } from '../alerts/alerts.service';
import { BillingService } from './billing.service';
import { MailService } from '../mail/mail.service';
import { ramka, tekstem, type Ramka } from '../mail/templates';

const DZIEN = 24 * 60 * 60 * 1000;

/** Ile dni przed końcem uprzedzamy. */
const UPRZEDZENIE_DNI = 3;

/** Ile dni po terminie idzie ostatnia próba odzyskania klienta. */
const WINBACK_DNI = 3;

/**
 * Jak daleko wstecz sięgamy.
 *
 * Bez tego pierwsze uruchomienie wysłałoby win-back do każdego konta, które
 * wygasło kiedykolwiek — łącznie z porzuconymi pół roku temu. Trzydzieści dni
 * to granica między „klient, który właśnie odpadł" a „konto z archiwum".
 */
const ZASIEG_WSTECZ_DNI = 30;

interface Tresc {
  temat: string;
  naglowek: string;
  akapity: string[];
  etykietaPrzycisku: string;
}

/**
 * Przypomnienia o kończącym się okresie abonamentowym.
 *
 * Bez nich zakup jednorazowy zamienia się w cichą rezygnację: jedynym sygnałem
 * jest pasek w panelu, więc właściciel, który się nie zaloguje, dowiaduje się
 * o wygaśnięciu dopiero wtedy, gdy kelner nie może przyjąć zamówienia — w środku
 * serwisu, od gościa przy stoliku. Dotyczy to tak samo okresu próbnego, który
 * kończy się po czternastu dniach od rejestracji.
 *
 * Trzy momenty i każdy mówi co innego: trzy dni przed (wszystko jeszcze działa),
 * w dniu wygaśnięcia (zamawianie wstrzymane) i trzy dni po (ostatnia próba).
 *
 * **Wysyłamy jedno przypomnienie dziennie, to najdalej posunięte z należnych.**
 * Gdy zadanie nie zadziała przez kilka dni — awaria, przestój — nie nadrabia
 * zaległości serią wiadomości: „zostały trzy dni" wysłane tydzień po terminie
 * byłoby gorsze od milczenia.
 */
@Injectable()
export class SubscriptionRemindersService {
  private readonly logger = new Logger(SubscriptionRemindersService.name);

  constructor(
    private readonly billing: BillingService,
    private readonly mail: MailService,
    private readonly alerts: AlertsService,
  ) {}

  /**
   * Raz dziennie rano, czasem polskim.
   *
   * Strefa jest podana wprost, bo kontener chodzi na UTC — bez tego wiadomość
   * o rachunku przychodziłaby restauratorowi w środku nocy latem i o innej
   * porze zimą.
   */
  @Cron('0 0 9 * * *', { timeZone: 'Europe/Warsaw' })
  async dozorowanePrzypomnienia(): Promise<void> {
    await this.alerts.pilnuj('przypomnienia-o-abonamencie', () => this.przypomnij());
  }

  async przypomnij(): Promise<void> {
    const teraz = Date.now();
    const abonamenty = await this.billing.abonamentyDoPrzypomnienia(
      new Date(teraz - ZASIEG_WSTECZ_DNI * DZIEN),
      new Date(teraz + UPRZEDZENIE_DNI * DZIEN),
    );

    let wyslane = 0;
    for (const abonament of abonamenty) {
      if (!abonament.currentPeriodEnd) continue;
      try {
        if (await this.zajmijSie(abonament)) wyslane += 1;
      } catch (przyczyna) {
        // Jeden klient nie może zatrzymać wysyłki do pozostałych.
        const opis = przyczyna instanceof Error ? przyczyna.message : String(przyczyna);
        this.logger.error(`Przypomnienie dla ${abonament.organization.name}: ${opis}`);
      }
    }

    if (wyslane > 0) this.logger.log(`Przypomnienia o abonamencie: wysłano ${wyslane}`);
  }

  private async zajmijSie(abonament: {
    organizationId: string;
    plan: string;
    status: string;
    currentPeriodEnd: Date | null;
    organization: { name: string; billingEmail: string };
  }): Promise<boolean> {
    const koniec = abonament.currentPeriodEnd!;
    const dni = Math.ceil((koniec.getTime() - Date.now()) / DZIEN);

    const rodzaj = this.rodzaj(dni);
    if (!rodzaj) return false;

    // Ślad zapisujemy **przed** wysyłką: przy odwrotnej kolejności awaria między
    // wysłaniem a zapisem powtórzyłaby wiadomość nazajutrz. Zgubione
    // przypomnienie jest tańsze od wysłanego dwa razy.
    if (!(await this.billing.oznaczPrzypomnienie(abonament.organizationId, rodzaj, koniec))) {
      return false;
    }

    const tresc = this.tresc(rodzaj, {
      nazwa: abonament.organization.name,
      plan: abonament.plan,
      probny: abonament.status === 'trialing',
      dni,
      koniec,
    });

    const ramkaTresci: Ramka = {
      adresStrony: this.mail.adresStrony,
      naglowek: tresc.naglowek,
      akapity: tresc.akapity,
      przycisk: {
        etykieta: tresc.etykietaPrzycisku,
        href: `${process.env.PANEL_URL ?? 'http://localhost:3002'}/abonament`,
      },
      stopka: [
        'Pytania do rozliczeń: kontakt@kelbroo.com.',
        'Wygaśnięcie wstrzymuje przyjmowanie nowych zamówień, ale <strong>nigdy nie kasuje ' +
          'danych</strong> — menu, stoliki i historia czekają na Ciebie.',
      ],
    };

    await this.mail.send({
      to: abonament.organization.billingEmail,
      subject: tresc.temat,
      text: tekstem(ramkaTresci),
      html: ramka(ramkaTresci),
    });
    return true;
  }

  /**
   * Które przypomnienie należy się dziś.
   *
   * Progi są nierównościami, nie równościami: gdy zadanie nie zadziała w dniu
   * granicznym, klient dostanie wiadomość następnego dnia zamiast nie dostać
   * jej wcale.
   */
  private rodzaj(dni: number): SubscriptionReminderKind | null {
    if (dni <= -WINBACK_DNI) return 'winback';
    if (dni <= 0) return 'expired';
    if (dni <= UPRZEDZENIE_DNI) return 'before';
    return null;
  }

  private tresc(
    rodzaj: SubscriptionReminderKind,
    dane: { nazwa: string; plan: string; probny: boolean; dni: number; koniec: Date },
  ): Tresc {
    const data = dane.koniec.toLocaleDateString('pl-PL');
    const nazwaPlanu = PLANS[dane.plan as PlanId]?.name ?? dane.plan;
    const co = dane.probny ? 'Okres próbny' : `Abonament ${nazwaPlanu}`;

    if (rodzaj === 'before') {
      const kiedy = dane.dni <= 1 ? 'jutro' : `za ${dane.dni} dni`;
      return {
        temat: `${co} dla ${dane.nazwa} kończy się ${kiedy}`,
        naglowek: `${co} kończy się ${kiedy}`,
        akapity: [
          `${co} dla <strong>${dane.nazwa}</strong> obowiązuje do <strong>${data}</strong>.`,
          dane.probny
            ? 'Po tym terminie goście nie złożą nowego zamówienia. Wybierz plan w panelu, ' +
              'żeby nic się nie zatrzymało — otwarte rachunki rozliczysz normalnie w każdej chwili.'
            : 'Przedłuż go w panelu, żeby zamawianie działało bez przerwy.',
        ],
        etykietaPrzycisku: dane.probny ? 'Wybierz plan' : 'Przedłuż abonament',
      };
    }

    if (rodzaj === 'expired') {
      return {
        temat: `${co} dla ${dane.nazwa} wygasł — zamawianie wstrzymane`,
        naglowek: 'Zamawianie zostało wstrzymane',
        akapity: [
          `${co} dla <strong>${dane.nazwa}</strong> skończył się ${data}. Goście widzą menu, ` +
            'ale <strong>nie złożą nowego zamówienia</strong>.',
          'Otwarte rachunki rozliczysz normalnie — panel obsługi działa dalej. ' +
            'Opłacenie przywraca zamawianie od razu.',
        ],
        etykietaPrzycisku: dane.probny ? 'Wybierz plan' : 'Opłać abonament',
      };
    }

    return {
      temat: `Czy wracamy? ${dane.nazwa} w kelbroo`,
      naglowek: 'Twoje menu wciąż na Ciebie czeka',
      akapity: [
        `Minęły trzy dni od końca, a konto <strong>${dane.nazwa}</strong> jest nietknięte: ` +
          'menu, stoliki i wydrukowane kody QR działają dokładnie tak, jak je zostawiłeś.',
        'Wystarczy opłacić abonament, żeby goście znów mogli zamawiać — bez ponownej ' +
          'konfiguracji i bez przedrukowywania kodów.',
        'A jeśli coś nie zagrało, napisz nam o tym na kontakt@kelbroo.com. Odpowiedź ' +
          'przeczyta człowiek, nie formularz.',
      ],
      etykietaPrzycisku: 'Wróć do kelbroo',
    };
  }
}
