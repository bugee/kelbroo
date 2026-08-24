import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

/** Okres próbny: 14 dni planu Pro, bez podawania karty (obietnica ze strony). */
export const TRIAL_DAYS = 14;

/** Limity planu Pro — te same, którymi opisany jest w cenniku. */
const PRO_LIMITS = { tableLimit: 40, languageLimit: 6 };

export interface RegistrationInput {
  restaurantName: string;
  email: string;
  password: string;
  ownerName: string;
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

  constructor(private readonly prisma: PrismaService) {}

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

    const email = input.email.toLowerCase().trim();
    const zajety = await this.directory.staffMember.findFirst({ where: { email } });
    if (zajety) {
      throw new ConflictException('Konto z tym adresem e-mail już istnieje.');
    }

    const organizationId = randomUUID();
    const passwordHash = await bcrypt.hash(input.password, 10);
    const slug = await this.freeSlug(input.restaurantName);
    const teraz = new Date();

    const wynik = await this.prisma.withTenant(organizationId, async (tx) => {
      const organization = await tx.organization.create({
        data: {
          id: organizationId,
          name: input.restaurantName.trim(),
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

    return {
      organizationId: wynik.organization.id,
      restaurantId: wynik.restaurant.id,
      restaurantName: wynik.restaurant.name,
      slug: wynik.restaurant.slug,
      trialEndsAt: new Date(teraz.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    };
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
