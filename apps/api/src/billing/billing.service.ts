import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, PrismaClient, type SubscriptionReminderKind } from '@prisma/client';
import {
  PLANS,
  addPeriod,
  isPurchasable,
  priceFor,
  type BillingPeriod,
  type PlanId,
} from '@kelbroo/types';
import { AlertsService } from '../alerts/alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ramka, tekstem, type Ramka } from '../mail/templates';
import type { StaffContext } from '../auth/auth.types';
import { SubscriptionPaymentProvider, type PaymentNotification } from './payment-provider';
import type { CheckoutDto } from './dto';

const GROSZE = 100;

/** Kwota do pokazania człowiekowi. Grosze są prawdą, złotówki są uprzejmością. */
function zlote(grosze: number): string {
  return (grosze / GROSZE).toFixed(2).replace('.', ',');
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  /**
   * Połączenie omijające RLS, użyte w **jednym** miejscu: powiadomienie od
   * operatora przychodzi bez sesji i bez najemcy, więc najpierw trzeba ustalić,
   * czyje to zamówienie. Odczyt jest wąski — jeden wiersz po `external_id` —
   * a cała reszta pracy idzie już przez `withTenant` (docs/todo.md §6a).
   */
  private readonly directory = new PrismaClient({
    datasourceUrl: process.env.DIRECT_DATABASE_URL,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: SubscriptionPaymentProvider,
    private readonly mail: MailService,
    private readonly alerts: AlertsService,
  ) {}

  /** Cennik do pokazania w panelu. Ceny liczy serwer, nie przeglądarka. */
  katalog() {
    const okresy: BillingPeriod[] = ['month', 'year'];

    return {
      enabled: this.provider.configured,
      vatRatePercent: 23,
      plans: Object.values(PLANS).map((plan) => ({
        id: plan.id,
        name: plan.name,
        limits: plan.limits,
        prices: Object.fromEntries(
          okresy.map((okres) => [
            okres,
            isPurchasable(plan.id, okres) ? priceFor(plan.id, okres) : null,
          ]),
        ),
      })),
    };
  }

  /**
   * Dane nabywcy do podpowiedzenia w formularzu.
   *
   * Należą do firmy, nie do lokalu, więc nie doklejamy ich do ustawień
   * restauracji — jedna organizacja może mieć wiele lokali i jeden adres
   * do faktur.
   */
  async invoiceDetails(staff: StaffContext) {
    const organizacja = await this.prisma.withTenant(staff.organizationId, (tx) =>
      tx.organization.findUniqueOrThrow({
        where: { id: staff.organizationId },
        select: {
          name: true,
          nip: true,
          billingEmail: true,
          billingAddress: true,
          billingPostalCode: true,
          billingCity: true,
        },
      }),
    );

    return {
      name: organizacja.name,
      nip: organizacja.nip ?? '',
      billingEmail: organizacja.billingEmail,
      address: organizacja.billingAddress ?? '',
      postalCode: organizacja.billingPostalCode ?? '',
      city: organizacja.billingCity ?? '',
    };
  }

  /**
   * Zamówienia czekające na rozstrzygnięcie, w poprzek najemców.
   *
   * Drugi (i ostatni) odczyt omijający RLS w tym module: uzgadnianie z natury
   * pyta o wszystkich klientów naraz, bo nie działa w niczyjej sesji. Wybiera
   * wąsko — tylko wiszące zamówienia z zadanego przedziału czasu.
   */
  async oczekujaceZamowienia(starszeNiz: Date, mlodszeNiz: Date) {
    return this.directory.subscriptionOrder.findMany({
      where: { status: { in: ['new', 'pending'] }, createdAt: { lt: starszeNiz, gt: mlodszeNiz } },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        externalId: true,
        organizationId: true,
        payuOrderId: true,
        grossCents: true,
        createdAt: true,
      },
    });
  }

  /**
   * Abonamenty z terminem w zasięgu przypomnień, w poprzek najemców.
   *
   * Odsiewamy w zapytaniu dwie grupy, którym przypomnienie tylko zaszkodzi:
   * konta zablokowane przez nas (blokadę zdejmuje człowiek, nie wpłata) oraz
   * abonamenty odwołane.
   */
  async abonamentyDoPrzypomnienia(najwczesniej: Date, najpozniej: Date) {
    return this.directory.subscription.findMany({
      where: {
        currentPeriodEnd: { gte: najwczesniej, lte: najpozniej },
        status: { in: ['trialing', 'active', 'past_due'] },
        // Restauracja pokazowa nie jest klientem — nie ma komu przypominać
        // o abonamencie, którego nikt nie płaci.
        organization: { blockedAt: null, isDemo: false },
      },
      select: {
        organizationId: true,
        plan: true,
        status: true,
        currentPeriodEnd: true,
        organization: { select: { name: true, billingEmail: true } },
      },
    });
  }

  /**
   * Zapisuje wysyłkę. Zwraca `false`, gdy takie przypomnienie już poszło —
   * rozstrzyga o tym unikalność w bazie, nie sprawdzenie w kodzie.
   */
  async oznaczPrzypomnienie(
    organizationId: string,
    kind: SubscriptionReminderKind,
    periodEnd: Date,
  ): Promise<boolean> {
    try {
      await this.prisma.withTenant(organizationId, (tx) =>
        tx.subscriptionReminder.create({ data: { organizationId, kind, periodEnd } }),
      );
      return true;
    } catch (przyczyna) {
      // P2002 = naruszenie unikalności, czyli „już wysłane". Każdy inny błąd
      // jest prawdziwy i ma polecieć wyżej.
      if (przyczyna instanceof Prisma.PrismaClientKnownRequestError && przyczyna.code === 'P2002') {
        return false;
      }
      throw przyczyna;
    }
  }

  /** Zamyka zamówienie, którego klient nie dokończył. */
  async porzuc(organizationId: string, externalId: string): Promise<void> {
    await this.prisma.withTenant(organizationId, (tx) =>
      tx.subscriptionOrder.updateMany({
        where: { externalId, status: { not: 'completed' } },
        data: { status: 'canceled' },
      }),
    );
  }

  /**
   * Wiadomość do nas — używa jej uzgadnianie, gdy odzyska zgubioną wpłatę.
   *
   * Idzie tym samym kanałem co alarmy, więc podlega wyciszaniu powtórzeń.
   * Waga „uwaga", nie „awaria": to zdarzenie **już naprawione** przez uzgadnianie,
   * z którego zostaje przyczyna do sprawdzenia bez pośpiechu.
   */
  async zawiadomNas(temat: string, akapity: string[]): Promise<void> {
    await this.alerts.zglos({ klucz: `billing.${temat}`, temat, akapity, waga: 'uwaga' });
  }

  /** Historia zakupów lokalu — także nieudanych. */
  async orders(staff: StaffContext) {
    return this.prisma.withTenant(staff.organizationId, (tx) =>
      tx.subscriptionOrder.findMany({
        where: { organizationId: staff.organizationId },
        orderBy: { createdAt: 'desc' },
        take: 24,
        select: {
          id: true,
          plan: true,
          period: true,
          netCents: true,
          vatCents: true,
          grossCents: true,
          currency: true,
          status: true,
          externalId: true,
          paidAt: true,
          paidUntil: true,
          createdAt: true,
        },
      }),
    );
  }

  /**
   * Rozpoczyna zakup okresu abonamentowego.
   *
   * Zwraca adres operatora, pod który trzeba odesłać przeglądarkę. **Nie zmienia
   * abonamentu** — ten rusza się wyłącznie po powiadomieniu o wpłacie.
   */
  async checkout(staff: StaffContext, dto: CheckoutDto, customerIp: string) {
    if (!this.provider.configured) {
      throw new ServiceUnavailableException(
        'Płatności nie są jeszcze uruchomione. Napisz na kontakt@kelbroo.com.',
      );
    }

    const plan = dto.plan as PlanId;
    const period = dto.period as BillingPeriod;
    if (!isPurchasable(plan, period)) {
      throw new BadRequestException(
        'Ten plan nie jest dostępny do zakupu w panelu. Napisz na kontakt@kelbroo.com.',
      );
    }

    const cena = priceFor(plan, period);

    const { organizacja, zamowienie } = await this.prisma.withTenant(
      staff.organizationId,
      async (tx) => {
        // Dane do faktury zapisujemy przy każdym zakupie: firma zmienia adres,
        // a faktura ma nieść ten, który obowiązywał w chwili sprzedaży.
        const organizacja = await tx.organization.update({
          where: { id: staff.organizationId },
          data: {
            nip: dto.nip ?? undefined,
            billingAddress: dto.address,
            billingPostalCode: dto.postalCode,
            billingCity: dto.city,
            billingEmail: dto.billingEmail,
          },
        });

        const zamowienie = await tx.subscriptionOrder.create({
          data: {
            organizationId: staff.organizationId,
            plan,
            period,
            netCents: cena.netCents,
            vatCents: cena.vatCents,
            grossCents: cena.grossCents,
            externalId: randomUUID(),
            initiatedByStaffId: staff.staffId,
          },
        });

        return { organizacja, zamowienie };
      },
    );

    const opis = `kelbroo ${PLANS[plan].name} — ${period === 'year' ? 'rok' : 'miesiąc'}`;

    try {
      const utworzone = await this.provider.createOrder({
        externalId: zamowienie.externalId,
        grossCents: cena.grossCents,
        currency: zamowienie.currency,
        description: opis,
        buyer: { email: organizacja.billingEmail },
        customerIp,
        continueUrl: `${this.adresPanelu}/abonament/wynik?zamowienie=${zamowienie.externalId}`,
        notifyUrl: `${this.adresApi}/billing/notify`,
      });

      await this.prisma.withTenant(staff.organizationId, (tx) =>
        tx.subscriptionOrder.update({
          where: { id: zamowienie.id },
          data: { status: 'pending', payuOrderId: utworzone.providerOrderId },
        }),
      );

      this.logger.log(`Zakup ${plan}/${period} dla ${organizacja.name} — ${zamowienie.externalId}`);
      return { redirectUri: utworzone.redirectUri, externalId: zamowienie.externalId };
    } catch (przyczyna) {
      // Zamówienie, które nigdy nie dotarło do operatora, zostaje jako anulowane —
      // kasowanie go zabrałoby ślad po nieudanej próbie zakupu.
      await this.prisma
        .withTenant(staff.organizationId, (tx) =>
          tx.subscriptionOrder.update({
            where: { id: zamowienie.id },
            data: { status: 'canceled' },
          }),
        )
        .catch(() => undefined);

      // Klient chciał zapłacić i nie mógł. To najdroższy rodzaj awarii w całym
      // systemie: nie zostawia śladu u nikogo poza logiem, a klient zwykle nie
      // dzwoni — po prostu odchodzi.
      await this.alerts.zglos({
        klucz: 'platnosci.zakup',
        temat: 'Nie da się rozpocząć płatności za abonament',
        akapity: [
          `Zakup planu <strong>${plan}</strong> dla <strong>${organizacja.name}</strong> ` +
            'nie doszedł do bramki płatności: ' +
            `<code>${przyczyna instanceof Error ? przyczyna.message : String(przyczyna)}</code>`,
          'Klient zobaczył komunikat o niedostępnym operatorze. Odmowa autoryzacji zwykle ' +
            'znaczy złe dane POS-u albo wygasły sekret — pełna odpowiedź PayU jest w logu API.',
        ],
        waga: 'awaria',
      });
      throw przyczyna;
    }
  }

  /**
   * Stan pojedynczego zamówienia — po powrocie z bramki.
   *
   * Ekran powrotu pyta o niego w pętli, bo powiadomienie od operatora bywa
   * wolniejsze od przeglądarki klienta.
   */
  async orderStatus(staff: StaffContext, externalId: string) {
    const zamowienie = await this.prisma.withTenant(staff.organizationId, (tx) =>
      tx.subscriptionOrder.findFirst({
        where: { externalId, organizationId: staff.organizationId },
        select: {
          plan: true,
          period: true,
          grossCents: true,
          currency: true,
          status: true,
          paidUntil: true,
        },
      }),
    );

    if (!zamowienie) throw new NotFoundException('Nie znamy takiego zamówienia.');
    return zamowienie;
  }

  /**
   * Powiadomienie od operatora — **jedyne** źródło prawdy o zapłacie.
   *
   * Powrót przeglądarki niczego nie potwierdza: klient może go zamknąć, cofnąć
   * albo podrobić. To ta sama zasada, która w zamówieniach gościa trzyma bramkę
   * do kuchni na webhooku, nigdy na odpowiedzi klienta (CLAUDE.md).
   */
  async handleNotification(rawBody: Buffer, signature?: string): Promise<void> {
    const powiadomienie = this.provider.readNotification(rawBody, signature);

    // Jedyny odczyt w poprzek najemców: bez niego nie wiadomo, w czyim kontekście
    // otworzyć transakcję.
    const organizationId = await this.znajdzNajemce(powiadomienie.externalId);
    await this.zastosujStan(organizationId, powiadomienie);
  }

  /**
   * Czyje jest to zamówienie.
   *
   * Jedyny odczyt w poprzek najemców: powiadomienie przychodzi bez sesji, więc
   * bez tego nie wiadomo, w czyim kontekście otworzyć transakcję.
   */
  private async znajdzNajemce(externalId: string): Promise<string> {
    const wskazanie = await this.directory.subscriptionOrder.findUnique({
      where: { externalId },
      select: { organizationId: true },
    });

    if (!wskazanie) {
      this.logger.warn(`Powiadomienie o nieznanym zamówieniu ${externalId}`);
      throw new NotFoundException('Nieznane zamówienie.');
    }
    return wskazanie.organizationId;
  }

  /**
   * Przenosi zamówienie do stanu, który zgłasza operator.
   *
   * Wspólne dla powiadomienia i dla uzgadniania — obie drogi muszą księgować
   * identycznie, bo inaczej ta rzadziej używana rozjechałaby się po cichu.
   *
   * Zwraca `true`, gdy **ta** próba zaksięgowała wpłatę. Uzgadnianie po tym
   * poznaje, że powiadomienie przepadło i trzeba nas o tym zawiadomić.
   */
  async zastosujStan(organizationId: string, stan: PaymentNotification): Promise<boolean> {
    const wynik = await this.prisma.withTenant(organizationId, async (tx) => {
      const zamowienie = await tx.subscriptionOrder.findUnique({
        where: { externalId: stan.externalId },
      });
      if (!zamowienie) throw new NotFoundException('Nieznane zamówienie.');

      if (stan.status !== 'completed') {
        if (stan.status === 'canceled' && zamowienie.status !== 'completed') {
          await tx.subscriptionOrder.updateMany({
            where: { id: zamowienie.id, status: { not: 'completed' } },
            data: { status: 'canceled' },
          });
        }
        return null;
      }

      // Bramka: **jedno** przejście na `completed` i ani jednego więcej.
      //
      // Sam odczyt statusu by nie wystarczył — powiadomienie i uzgadnianie mogą
      // trafić na to zamówienie równocześnie, oba zobaczyć „pending" i oba
      // przedłużyć abonament za te same pieniądze. `updateMany` z warunkiem
      // blokuje wiersz, więc druga transakcja czeka i po odblokowaniu nie
      // dopasowuje już niczego.
      const przejete = await tx.subscriptionOrder.updateMany({
        where: { id: zamowienie.id, status: { not: 'completed' } },
        data: {
          status: 'completed',
          paidAt: new Date(),
          payuOrderId: stan.providerOrderId,
        },
      });
      if (przejete.count === 0) return null;

      // Podpis broni przed podszyciem, ale nie przed pomyłką po naszej stronie:
      // kwota inna niż wystawiona znaczy, że coś się rozjechało, i nie wolno
      // wtedy przedłużać abonamentu w ciemno. Wyjątek wycofuje też bramkę
      // powyżej, więc zamówienie zostaje w poprzednim stanie.
      if (stan.grossCents !== zamowienie.grossCents) {
        this.logger.error(
          `Kwota nie zgadza się dla ${zamowienie.externalId}: ` +
            `operator ${stan.grossCents}, wystawiono ${zamowienie.grossCents}`,
        );
        throw new BadRequestException('Kwota płatności nie zgadza się z zamówieniem.');
      }

      const abonament = await tx.subscription.findUnique({
        where: { organizationId: zamowienie.organizationId },
      });

      // Kupujemy okres, nie datę: gdy abonament jeszcze trwa, doliczamy do jego
      // końca — inaczej klient płacący z wyprzedzeniem traciłby resztę okresu.
      const podstawa =
        abonament?.currentPeriodEnd && abonament.currentPeriodEnd > new Date()
          ? abonament.currentPeriodEnd
          : new Date();
      const doKiedy = addPeriod(podstawa, zamowienie.period as BillingPeriod);
      const plan = PLANS[zamowienie.plan as PlanId];
      const limity = plan.limits;

      await tx.subscription.upsert({
        where: { organizationId: zamowienie.organizationId },
        create: {
          organizationId: zamowienie.organizationId,
          plan: zamowienie.plan,
          status: 'active',
          currentPeriodEnd: doKiedy,
          // Rozsypywanie limitów po jednym prosiło się o przeoczenie przy
          // dodaniu kolejnego — katalog planów jest ich kompletem.
          ...limity,
          menuPhotosEnabled: plan.features.menuPhotos,
          reviewsEnabled: plan.features.reviews,
        },
        update: {
          plan: zamowienie.plan,
          status: 'active',
          currentPeriodEnd: doKiedy,
          ...limity,
          // Zakup planu ustawia funkcję na wartość z cennika. Ręczne włączenie
          // zrobione wcześniej z zaplecza **przepada** — plan jest źródłem prawdy
          // w chwili zakupu, a wyjątek trzeba wtedy nadać na nowo.
          menuPhotosEnabled: plan.features.menuPhotos,
          reviewsEnabled: plan.features.reviews,
        },
      });

      const zapisane = await tx.subscriptionOrder.update({
        where: { id: zamowienie.id },
        data: { paidUntil: doKiedy },
      });

      const organizacja = await tx.organization.findUniqueOrThrow({
        where: { id: zamowienie.organizationId },
      });

      return { zamowienie: zapisane, organizacja };
    });

    if (!wynik) return false;

    this.logger.log(
      `Zaksięgowano ${wynik.zamowienie.grossCents} gr od ${wynik.organizacja.name} ` +
        `— abonament do ${wynik.zamowienie.paidUntil?.toISOString()}`,
    );

    await Promise.all([
      this.potwierdzKlientowi(wynik.organizacja, wynik.zamowienie),
      this.zglosDoFakturowania(wynik.organizacja, wynik.zamowienie),
    ]);
    return true;
  }

  private get adresPanelu(): string {
    return process.env.PANEL_URL ?? 'http://localhost:3002';
  }

  private get adresApi(): string {
    return process.env.PUBLIC_API_URL ?? 'http://localhost:4000/api';
  }

  private async potwierdzKlientowi(
    organizacja: { name: string; billingEmail: string },
    zamowienie: {
      plan: string;
      period: string;
      netCents: number;
      vatCents: number;
      grossCents: number;
      paidUntil: Date | null;
    },
  ): Promise<void> {
    const tresc: Ramka = {
      adresStrony: this.mail.adresStrony,
      naglowek: 'Płatność przyjęta',
      akapity: [
        `Dziękujemy — abonament <strong>${PLANS[zamowienie.plan as PlanId].name}</strong> ` +
          `dla ${organizacja.name} jest opłacony do ` +
          `<strong>${zamowienie.paidUntil?.toLocaleDateString('pl-PL')}</strong>.`,
        `Kwota: ${zlote(zamowienie.netCents)} zł netto + ${zlote(zamowienie.vatCents)} zł VAT ` +
          `= <strong>${zlote(zamowienie.grossCents)} zł</strong>.`,
      ],
      przycisk: { etykieta: 'Otwórz panel', href: this.adresPanelu },
      stopka: [
        'Fakturę VAT wystawimy i wyślemy na ten adres w ciągu kilku dni roboczych.',
        'Pytania do rozliczeń: kontakt@kelbroo.com.',
      ],
    };

    await this.mail.send({
      to: organizacja.billingEmail,
      subject: `Abonament kelbroo opłacony do ${zamowienie.paidUntil?.toLocaleDateString('pl-PL')}`,
      text: tekstem(tresc),
      html: ramka(tresc),
    });
  }

  /**
   * Powiadomienie dla nas: jest wpłata, trzeba wystawić fakturę.
   *
   * Faktury wystawiamy dziś poza kelbroo, w programie księgowym, więc ta
   * wiadomość niesie **komplet danych nabywcy** — inaczej trzeba by ich szukać
   * w bazie przy każdej sprzedaży.
   */
  private async zglosDoFakturowania(
    organizacja: {
      name: string;
      nip: string | null;
      billingEmail: string;
      billingAddress: string | null;
      billingPostalCode: string | null;
      billingCity: string | null;
    },
    zamowienie: {
      plan: string;
      period: string;
      netCents: number;
      vatCents: number;
      grossCents: number;
      externalId: string;
      paidUntil: Date | null;
    },
  ): Promise<void> {
    const tresc: Ramka = {
      adresStrony: this.mail.adresStrony,
      naglowek: 'Do wystawienia faktura VAT',
      akapity: [
        `<strong>${organizacja.name}</strong><br>` +
          `${organizacja.billingAddress ?? '—'}<br>` +
          `${organizacja.billingPostalCode ?? ''} ${organizacja.billingCity ?? ''}<br>` +
          `NIP: ${organizacja.nip ?? '—'}<br>` +
          `E-mail: ${organizacja.billingEmail}`,
        `Pozycja: kelbroo ${PLANS[zamowienie.plan as PlanId].name}, ` +
          `${zamowienie.period === 'year' ? 'abonament roczny' : 'abonament miesięczny'}, ` +
          `okres do ${zamowienie.paidUntil?.toLocaleDateString('pl-PL')}.`,
        `Netto ${zlote(zamowienie.netCents)} zł · VAT 23% ${zlote(zamowienie.vatCents)} zł · ` +
          `brutto <strong>${zlote(zamowienie.grossCents)} zł</strong>.`,
      ],
      stopka: [`Zamówienie ${zamowienie.externalId}. Wpłata przyjęta przez PayU.`],
    };

    await this.mail.send({
      to: this.mail.skrzynkaKelbroo,
      subject: `Faktura do wystawienia: ${organizacja.name} — ${zlote(zamowienie.grossCents)} zł`,
      text: tekstem(tresc),
      html: ramka(tresc),
    });
  }
}

export type BillingTransaction = Prisma.TransactionClient;
