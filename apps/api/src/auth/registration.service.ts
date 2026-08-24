import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { isValidNip, normalizeNip, formatNip } from '@kelbroo/types';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

/** Okres próbny: 14 dni planu Pro, bez podawania karty (obietnica ze strony). */
export const TRIAL_DAYS = 14;

/** Limity planu Pro — te same, którymi opisany jest w cenniku. */
const PRO_LIMITS = { tableLimit: 40, languageLimit: 6 };

/** Ile czasu ma klient na kliknięcie w odnośnik z wiadomości. */
const WAZNOSC_TOKENU_H = 48;

/** Token z wiadomości. W bazie trzymamy wyłącznie jego skrót. */
function tokenPotwierdzenia() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}

export interface RegistrationInput {
  restaurantName: string;
  email: string;
  password: string;
  ownerName: string;
  nip: string;
  termsVersion: string;
  privacyVersion: string;
}

/**
 * Założenie konta restauracji bez udziału administratora.
 *
 * Dwie rzeczy są tu nieoczywiste.
 *
 * **Kontekst najemcy przed jego istnieniem.** RLS wymaga ustawionej organizacji,
 * a rejestracja dopiero ją tworzy. Zamiast osłabiać politykę albo sięgać po
 * połączenie z prawami właściciela, losujemy identyfikator organizacji w aplikacji
 * i wchodzimy w `withTenant` już z nim. Polityka `WITH CHECK (id = …)` przepuści
 * wtedy dokładnie jeden wiersz — ten nasz — a wszystko pozostałe nadal jest
 * odcięte. Rejestracja nie zyskuje żadnego dostępu do cudzych danych.
 *
 * **Sprawdzenie e-maila musi iść ponad najemcami**, bo logowanie szuka konta po
 * samym adresie. Robi to połączenie katalogowe, tak samo jak logowanie. Wyścig
 * dwóch równoczesnych rejestracji domyka unikalny indeks w bazie, nie ta kontrola.
 */
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  /**
   * Katalog kont ponad organizacjami — to samo połączenie, którego używa
   * logowanie. Jedyne dwa miejsca, które muszą widzieć konta wszystkich lokali.
   */
  private readonly directory = new PrismaClient({
    datasourceUrl: process.env.DIRECT_DATABASE_URL,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Wyłącznik awaryjny zakładania kont.
   *
   * Powstał jako blokada na czas, gdy formularz zbierałby zgodę na nieistniejące
   * dokumenty. Od 2026-08-24 regulamin i polityka są opublikowane, więc rejestracja
   * jest otwarta — zmienna zostaje, żeby dało się ją zamknąć bez wdrażania kodu.
   *
   * Domyślną wartość ustala `docker-compose.prod.yml`. Tutaj brak zmiennej nadal
   * znaczy „zamknięte": test i lokalne uruchomienie nie mają prawa zakładać kont
   * przez przypadek.
   */
  static get enabled(): boolean {
    return process.env.REGISTRATION_ENABLED === 'true';
  }

  async register(input: RegistrationInput) {
    if (!RegistrationService.enabled) {
      throw new ServiceUnavailableException(
        'Rejestracja nie jest jeszcze otwarta. Napisz na kontakt@kelbroo.com.',
      );
    }

    // Suma kontrolna, nie sama długość — literówka w NIP-ie wychodzi dopiero
    // przy fakturze, czyli miesiąc później i po stronie księgowości.
    const nip = normalizeNip(input.nip);
    if (!isValidNip(nip)) {
      throw new BadRequestException('Numer NIP jest nieprawidłowy — sprawdź cyfry.');
    }

    const email = input.email.toLowerCase().trim();
    const zajety = await this.directory.staffMember.findFirst({ where: { email } });
    if (zajety) {
      throw new ConflictException('Konto z tym adresem e-mail już istnieje.');
    }

    const organizationId = randomUUID();
    const passwordHash = await bcrypt.hash(input.password, 10);
    const slug = await this.freeSlug(input.restaurantName);
    const teraz = new Date();
    const { token, hash } = tokenPotwierdzenia();

    const wynik = await this.prisma.withTenant(organizationId, async (tx) => {
      const organization = await tx.organization.create({
        data: {
          id: organizationId,
          name: input.restaurantName.trim(),
          nip,
          billingEmail: email,
          termsAcceptedAt: teraz,
          termsVersion: input.termsVersion,
          privacyAcceptedAt: teraz,
          privacyVersion: input.privacyVersion,
        },
      });

      const restaurant = await tx.restaurant.create({
        data: {
          organizationId,
          name: input.restaurantName.trim(),
          slug,
          currency: 'PLN',
          defaultLocale: 'pl',
          supportedLocales: ['pl'],
        },
      });

      const owner = await tx.staffMember.create({
        data: {
          organizationId,
          restaurantId: restaurant.id,
          email,
          name: input.ownerName.trim(),
          role: 'owner',
          passwordHash,
          // Hasło ustawił sam zakładający — nie ma go po co zmuszać do zmiany.
          mustChangePassword: false,
          // Adres jest niepotwierdzony aż do kliknięcia w odnośnik; do tego czasu
          // konto istnieje, ale nie wpuszcza do panelu.
          emailTokenHash: hash,
          emailTokenExpiresAt: new Date(teraz.getTime() + WAZNOSC_TOKENU_H * 3600 * 1000),
        },
      });

      await tx.subscription.create({
        data: {
          organizationId,
          plan: 'pro',
          status: 'trialing',
          currentPeriodEnd: new Date(teraz.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          ...PRO_LIMITS,
        },
      });

      return { organization, restaurant, owner };
    });

    this.logger.log(`Nowe konto: ${wynik.restaurant.slug}`);

    // Poczta idzie po zatwierdzeniu transakcji i nie może jej wywrócić: konto
    // jest założone, a nieudana wysyłka to sprawa do ponowienia, nie do cofania.
    const trialEndsAt = new Date(teraz.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await Promise.all([
      this.wyslijPotwierdzenie(email, wynik.restaurant.name, token),
      this.powiadomKelbroo(wynik.restaurant.name, nip, email, wynik.owner.name),
    ]);

    return {
      organizationId: wynik.organization.id,
      restaurantId: wynik.restaurant.id,
      restaurantName: wynik.restaurant.name,
      slug: wynik.restaurant.slug,
      trialEndsAt,
      /// Formularz mówi „sprawdź skrzynkę" — bez tego nie wiedziałby, że ma czekać.
      emailVerificationRequired: true,
    };
  }

  /**
   * Potwierdzenie adresu z odnośnika.
   *
   * Token porównujemy po skrócie — w bazie nie ma wersji jawnej. Po użyciu
   * kasujemy go, żeby ten sam odnośnik nie działał drugi raz.
   */
  async verifyEmail(token: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const konto = await this.directory.staffMember.findFirst({ where: { emailTokenHash: hash } });

    if (!konto || !konto.emailTokenExpiresAt || konto.emailTokenExpiresAt < new Date()) {
      throw new BadRequestException(
        'Odnośnik wygasł albo został już użyty. Poproś o nowy na stronie logowania.',
      );
    }

    await this.directory.staffMember.update({
      where: { id: konto.id },
      data: { emailVerifiedAt: new Date(), emailTokenHash: null, emailTokenExpiresAt: null },
    });

    return { email: konto.email, verified: true as const };
  }

  /**
   * Ponowna wysyłka. Odpowiedź jest zawsze taka sama — inaczej ten endpoint
   * mówiłby obcym, które adresy mają u nas konto.
   */
  async resendVerification(email: string) {
    const konto = await this.directory.staffMember.findFirst({
      where: { email: email.toLowerCase().trim() },
    });

    if (konto && !konto.emailVerifiedAt) {
      const { token, hash } = tokenPotwierdzenia();
      await this.directory.staffMember.update({
        where: { id: konto.id },
        data: {
          emailTokenHash: hash,
          emailTokenExpiresAt: new Date(Date.now() + WAZNOSC_TOKENU_H * 3600 * 1000),
        },
      });
      const lokal = await this.directory.restaurant.findFirst({
        where: { organizationId: konto.organizationId },
        select: { name: true },
      });
      await this.wyslijPotwierdzenie(konto.email, lokal?.name ?? 'Twój lokal', token);
    }

    return { sent: true as const };
  }

  /** Wiadomość do klienta z odnośnikiem potwierdzającym adres. */
  private async wyslijPotwierdzenie(email: string, lokal: string, token: string): Promise<void> {
    const odnosnik = `${this.mail.adresStrony}/potwierdz?token=${token}`;
    await this.mail.send({
      to: email,
      subject: 'Potwierdź adres e-mail — kelbroo',
      text: [
        `Konto dla „${lokal}" zostało założone.`,
        '',
        'Potwierdź adres e-mail, żeby zalogować się do panelu:',
        odnosnik,
        '',
        `Odnośnik jest ważny ${WAZNOSC_TOKENU_H} godzin.`,
        'Jeśli to nie Ty zakładałeś konto, po prostu zignoruj tę wiadomość.',
        '',
        'kelbroo — self-service dining',
      ].join('\n'),
    });
  }

  /** Powiadomienie dla nas: ktoś właśnie założył konto. */
  private async powiadomKelbroo(
    lokal: string,
    nip: string,
    email: string,
    wlasciciel: string,
  ): Promise<void> {
    await this.mail.send({
      to: this.mail.skrzynkaKelbroo,
      subject: `Nowe konto: ${lokal}`,
      text: [
        `Lokal: ${lokal}`,
        `NIP: ${formatNip(nip)}`,
        `Właściciel: ${wlasciciel}`,
        `E-mail: ${email}`,
        '',
        'Adres nie jest jeszcze potwierdzony — konto wpuści do panelu dopiero po kliknięciu w odnośnik.',
      ].join('\n'),
    });
  }

  /**
   * Adres lokalu w kodach QR i w danych. Musi być unikalny w całej bazie, więc
   * i to sprawdzenie idzie katalogiem — z tego samego powodu co e-mail.
   */
  private async freeSlug(name: string): Promise<string> {
    const podstawa =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/ł/g, 'l')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'lokal';

    for (let i = 0; i < 50; i++) {
      const kandydat = i === 0 ? podstawa : `${podstawa}-${i + 1}`;
      const zajety = await this.directory.restaurant.findUnique({ where: { slug: kandydat } });
      if (!zajety) return kandydat;
    }

    // Pięćdziesiąt lokali o tej samej nazwie to nie jest sytuacja do zgadywania.
    return `${podstawa}-${randomUUID().slice(0, 8)}`;
  }
}
