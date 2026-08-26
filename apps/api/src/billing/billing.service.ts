import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  PLANS,
  addPeriod,
  isPurchasable,
  priceFor,
  type BillingPeriod,
  type PlanId,
} from '@kelbroo/types';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ramka, tekstem, type Ramka } from '../mail/templates';
import type { StaffContext } from '../auth/auth.types';
import { SubscriptionPaymentProvider } from './payment-provider';
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
    const wskazanie = await this.directory.subscriptionOrder.findUnique({
      where: { externalId: powiadomienie.externalId },
      select: { organizationId: true },
    });

    if (!wskazanie) {
      this.logger.warn(`Powiadomienie o nieznanym zamówieniu ${powiadomienie.externalId}`);
      throw new NotFoundException('Nieznane zamówienie.');
    }

    const wynik = await this.prisma.withTenant(wskazanie.organizationId, async (tx) => {
      const zamowienie = await tx.subscriptionOrder.findUnique({
        where: { externalId: powiadomienie.externalId },
      });
      if (!zamowienie) throw new NotFoundException('Nieznane zamówienie.');

      // Powiadomienia przychodzą wielokrotnie — operator ponawia je, dopóki nie
      // dostanie 200. Drugie przetworzenie tej samej wpłaty przedłużyłoby
      // abonament dwa razy za te same pieniądze.
      if (zamowienie.status === 'completed') return null;

      if (powiadomienie.status !== 'completed') {
        if (zamowienie.status !== 'canceled' && powiadomienie.status === 'canceled') {
          await tx.subscriptionOrder.update({
            where: { id: zamowienie.id },
            data: { status: 'canceled' },
          });
        }
        return null;
      }

      // Podpis broni przed podszyciem, ale nie przed pomyłką po naszej stronie:
      // kwota inna niż wystawiona znaczy, że coś się rozjechało, i nie wolno
      // wtedy przedłużać abonamentu w ciemno.
      if (powiadomienie.grossCents !== zamowienie.grossCents) {
        this.logger.error(
          `Kwota nie zgadza się dla ${zamowienie.externalId}: ` +
            `operator ${powiadomienie.grossCents}, wystawiono ${zamowienie.grossCents}`,
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
      const limity = PLANS[zamowienie.plan as PlanId].limits;

      await tx.subscription.upsert({
        where: { organizationId: zamowienie.organizationId },
        create: {
          organizationId: zamowienie.organizationId,
          plan: zamowienie.plan,
          status: 'active',
          currentPeriodEnd: doKiedy,
          tableLimit: limity.tableLimit,
          languageLimit: limity.languageLimit,
        },
        update: {
          plan: zamowienie.plan,
          status: 'active',
          currentPeriodEnd: doKiedy,
          tableLimit: limity.tableLimit,
          languageLimit: limity.languageLimit,
        },
      });

      const zapisane = await tx.subscriptionOrder.update({
        where: { id: zamowienie.id },
        data: {
          status: 'completed',
          paidAt: new Date(),
          paidUntil: doKiedy,
          payuOrderId: powiadomienie.providerOrderId,
        },
      });

      const organizacja = await tx.organization.findUniqueOrThrow({
        where: { id: zamowienie.organizationId },
      });

      return { zamowienie: zapisane, organizacja };
    });

    if (!wynik) return;

    this.logger.log(
      `Zaksięgowano ${wynik.zamowienie.grossCents} gr od ${wynik.organizacja.name} ` +
        `— abonament do ${wynik.zamowienie.paidUntil?.toISOString()}`,
    );

    await Promise.all([
      this.potwierdzKlientowi(wynik.organizacja, wynik.zamowienie),
      this.zglosDoFakturowania(wynik.organizacja, wynik.zamowienie),
    ]);
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
