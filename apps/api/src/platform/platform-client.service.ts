import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient, type SubscriptionPlan } from '@prisma/client';
import { PLANS } from '@kelbroo/types';
import { PrismaService } from '../prisma/prisma.service';
import { readSubscription } from '../common/subscription';
import type { PlatformAdminContext } from './platform-auth.service';

/**
 * Limity planów pochodzą z katalogu w `@kelbroo/types` — tego samego, z którego
 * liczy się cennik i checkout. Trzy kopie tej tabeli rozjechałyby się przy
 * pierwszej zmianie oferty, a rozjazd byłby widoczny dopiero u klienta.
 */
const LIMITY: Record<
  SubscriptionPlan,
  { tableLimit: number; languageLimit: number; staffLimit: number }
> = {
  menu: PLANS.menu.limits,
  starter: PLANS.starter.limits,
  pro: PLANS.pro.limits,
  enterprise: PLANS.enterprise.limits,
};

const DZIEN = 24 * 60 * 60 * 1000;

/**
 * Jeden klient: podgląd i operacje.
 *
 * W odróżnieniu od listy **wszystko idzie przez `withTenant`** — patrzymy na jedną
 * organizację i jej identyfikator znamy, więc nie ma powodu omijać RLS. To domyślna
 * droga ustalona w planie (§6a); połączenie katalogowe zostaje wyjątkiem dla listy.
 *
 * Każda operacja zapisuje się w dzienniku zaplecza. Zmiana planu albo blokada bez
 * śladu, kto i dlaczego, jest po tygodniu nie do odtworzenia — a to są decyzje
 * o cudzych pieniądzach i cudzej pracy.
 */
@Injectable()
export class PlatformClientService {
  /** Dziennik i istnienie organizacji sprawdzamy poza kontekstem najemcy. */
  private readonly directory = new PrismaClient({
    datasourceUrl: process.env.DIRECT_DATABASE_URL,
  });

  constructor(private readonly prisma: PrismaService) {}

  async detail(organizationId: string) {
    const organizacja = await this.prisma.withTenant(organizationId, async (tx) => {
      const org = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!org) return null;

      const [abonament, lokale, personel] = await Promise.all([
        readSubscription(tx, organizationId),
        tx.restaurant.findMany({
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            orderingMode: true,
            _count: { select: { tables: true, menuItems: true } },
          },
        }),
        tx.staffMember.findMany({
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            emailVerifiedAt: true,
          },
        }),
      ]);

      return { org, abonament, lokale, personel };
    });

    if (!organizacja) {
      throw new NotFoundException('Nie ma takiego klienta.');
    }

    const { org, abonament, lokale, personel } = organizacja;
    const historia = await this.directory.platformAuditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      organizationId: org.id,
      nazwa: org.name,
      nip: org.nip,
      emailRozliczeniowy: org.billingEmail,
      zalozone: org.createdAt,
      zablokowane: org.blockedAt,
      powodBlokady: org.blockedReason,
      regulamin: { zaakceptowany: org.termsAcceptedAt, wersja: org.termsVersion },
      prywatnosc: { zaakceptowana: org.privacyAcceptedAt, wersja: org.privacyVersion },
      abonament,
      lokale: lokale.map((lokal) => ({
        id: lokal.id,
        nazwa: lokal.name,
        slug: lokal.slug,
        trybZamawiania: lokal.orderingMode,
        stolikow: lokal._count.tables,
        pozycjiWKarcie: lokal._count.menuItems,
      })),
      personel: personel.map((osoba) => ({
        id: osoba.id,
        imie: osoba.name,
        email: osoba.email,
        rola: osoba.role,
        aktywne: osoba.isActive,
        potwierdzony: osoba.emailVerifiedAt !== null,
        ostatnieLogowanie: osoba.lastLoginAt,
      })),
      historia: historia.map((wpis) => ({
        id: wpis.id,
        akcja: wpis.action,
        powod: wpis.reason,
        kiedy: wpis.createdAt,
      })),
    };
  }

  /** Przedłużenie okresu próbnego albo abonamentu o zadaną liczbę dni. */
  async extend(admin: PlatformAdminContext, organizationId: string, dni: number, powod: string) {
    if (!Number.isInteger(dni) || dni < 1 || dni > 365) {
      throw new BadRequestException('Liczba dni musi być z zakresu 1–365.');
    }
    if (!powod.trim()) {
      throw new BadRequestException('Przedłużenie wymaga podania powodu.');
    }

    const wynik = await this.prisma.withTenant(organizationId, async (tx) => {
      const abonament = await tx.subscription.findUnique({ where: { organizationId } });
      if (!abonament) {
        throw new NotFoundException('Ten klient nie ma abonamentu.');
      }

      // Liczymy od dziś, gdy termin już minął — inaczej przedłużenie o 14 dni
      // komuś miesiąc po terminie nie dałoby ani jednego dnia działania.
      const podstawa =
        abonament.currentPeriodEnd && abonament.currentPeriodEnd > new Date()
          ? abonament.currentPeriodEnd
          : new Date();

      return tx.subscription.update({
        where: { organizationId },
        data: { currentPeriodEnd: new Date(podstawa.getTime() + dni * DZIEN) },
      });
    });

    await this.zapisz(admin, organizationId, 'subscription.extended', powod, {
      dni,
      doKiedy: wynik.currentPeriodEnd,
    });
    return { currentPeriodEnd: wynik.currentPeriodEnd };
  }

  /** Zmiana planu wraz z limitami. Nie rusza terminu ważności. */
  async changePlan(
    admin: PlatformAdminContext,
    organizationId: string,
    plan: SubscriptionPlan,
    powod: string,
  ) {
    if (!powod.trim()) {
      throw new BadRequestException('Zmiana planu wymaga podania powodu.');
    }

    const wynik = await this.prisma.withTenant(organizationId, async (tx) => {
      const abonament = await tx.subscription.findUnique({ where: { organizationId } });
      if (!abonament) {
        throw new NotFoundException('Ten klient nie ma abonamentu.');
      }
      return tx.subscription.update({
        where: { organizationId },
        // Limity idą razem z planem: zostawienie starych dałoby lokal na planie
        // Starter z limitami Pro i zdziwienie przy pierwszym rachunku.
        data: {
          plan,
          status: 'active',
          ...LIMITY[plan],
          // Funkcje też idą z planem. Ręczne włączenie zdjęć u kogoś na Starterze
          // przepada przy zmianie planu — trzeba je wtedy nadać na nowo, świadomie.
          menuPhotosEnabled: PLANS[plan].features.menuPhotos,
        },
      });
    });

    await this.zapisz(admin, organizationId, 'subscription.plan_changed', powod, {
      plan,
      poprzedni: plan,
    });
    return {
      plan: wynik.plan,
      tableLimit: wynik.tableLimit,
      languageLimit: wynik.languageLimit,
      menuPhotosEnabled: wynik.menuPhotosEnabled,
    };
  }

  /**
   * Włączenie albo wyłączenie funkcji pojedynczemu klientowi, bez zmiany planu.
   *
   * Powód istnienia: handel. Lokal na Starterze prosi o zdjęcia dań na czas
   * rozmowy o przejściu na Pro — i nie ma sensu przepisywać mu abonamentu, żeby
   * to sprawdzić. Zmiana planu **kasuje** taki wyjątek, bo plan jest wtedy
   * świeżą decyzją.
   */
  async setFeature(
    admin: PlatformAdminContext,
    organizationId: string,
    feature: 'menuPhotos',
    enabled: boolean,
    powod: string,
  ) {
    if (!powod.trim()) {
      throw new BadRequestException('Zmiana funkcji wymaga podania powodu.');
    }

    const wynik = await this.prisma.withTenant(organizationId, async (tx) => {
      const abonament = await tx.subscription.findUnique({ where: { organizationId } });
      if (!abonament) {
        throw new NotFoundException('Ten klient nie ma abonamentu.');
      }
      return tx.subscription.update({
        where: { organizationId },
        data: { menuPhotosEnabled: enabled },
      });
    });

    await this.zapisz(admin, organizationId, 'subscription.feature_changed', powod, {
      feature,
      enabled,
    });
    return { menuPhotosEnabled: wynik.menuPhotosEnabled };
  }

  /**
   * Blokada administracyjna. Wstrzymuje nowe zamówienia u gościa i w panelu,
   * zostawiając rozliczanie otwartych rachunków. **Nie kasuje żadnych danych.**
   */
  async block(admin: PlatformAdminContext, organizationId: string, powod: string) {
    if (!powod.trim()) {
      throw new BadRequestException(
        'Blokada wymaga podania powodu — bez niego nie da się jej potem wyjaśnić.',
      );
    }

    await this.prisma.withTenant(organizationId, (tx) =>
      tx.organization.update({
        where: { id: organizationId },
        data: { blockedAt: new Date(), blockedReason: powod.trim() },
      }),
    );

    await this.zapisz(admin, organizationId, 'account.blocked', powod, null);
    return { zablokowane: true as const };
  }

  async unblock(admin: PlatformAdminContext, organizationId: string, powod: string) {
    await this.prisma.withTenant(organizationId, (tx) =>
      tx.organization.update({
        where: { id: organizationId },
        data: { blockedAt: null, blockedReason: null },
      }),
    );

    await this.zapisz(admin, organizationId, 'account.unblocked', powod, null);
    return { zablokowane: false as const };
  }

  /** Wpis do dziennika zaplecza. Append-only — nic go później nie poprawia. */
  private async zapisz(
    admin: PlatformAdminContext,
    organizationId: string,
    action: string,
    reason: string,
    payload: Prisma.InputJsonValue | null,
  ): Promise<void> {
    await this.directory.platformAuditLog.create({
      data: {
        adminId: admin.adminId,
        organizationId,
        action,
        reason: reason.trim() || null,
        payload: payload ?? undefined,
      },
    });
  }
}
