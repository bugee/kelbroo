import { ForbiddenException } from '@nestjs/common';
import type { Prisma, Subscription } from '@prisma/client';

/**
 * Czy abonament pozwala pracować.
 *
 * `trialing` liczy się tak samo jak `active` — okres próbny jest pełnoprawnym
 * używaniem usługi, tylko nieopłaconym. Rozstrzyga data końca okresu, nie sam
 * status: abonament zostawiony w `active` z datą sprzed miesiąca jest wygasły.
 */
export function subscriptionActive(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  if (subscription.status !== 'active' && subscription.status !== 'trialing') return false;
  return subscription.currentPeriodEnd === null || subscription.currentPeriodEnd > new Date();
}

export interface StanAbonamentu {
  active: boolean;
  status: string;
  /// `null`, gdy organizacja nie ma jeszcze wiersza abonamentu.
  plan: string | null;
  /// Limity planu — zaplecze pokazuje je przy zmianie planu, panel przy stolikach.
  tableLimit: number | null;
  languageLimit: number | null;
  staffLimit: number | null;
  /** Ile pozycji mieści karta. Panel pokazuje to przy liście dań. */
  menuItemLimit: number | null;
  /** Czy lokal może dodawać zdjęcia dań. Panel chowa po tym cały interfejs wgrywania. */
  menuPhotosEnabled: boolean;
  /** Czy lokal zbiera oceny gości. Panel chowa po tym cały ekran opinii. */
  reviewsEnabled: boolean;
  /** Czy wolno wynieść raport sprzedaży do CSV. Sam ekran widzi każdy plan. */
  reportsExportEnabled: boolean;
  /** `null`, gdy abonament nie ma daty końca. */
  currentPeriodEnd: Date | null;
  /** Ile dni zostało; ujemne, gdy termin minął. `null` przy braku daty. */
  daysLeft: number | null;
  trial: boolean;
}

const DZIEN = 24 * 60 * 60 * 1000;

export async function readSubscription(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<StanAbonamentu> {
  const subscription = await tx.subscription.findUnique({ where: { organizationId } });

  return {
    active: subscriptionActive(subscription),
    status: subscription?.status ?? 'none',
    plan: subscription?.plan ?? null,
    tableLimit: subscription?.tableLimit ?? null,
    languageLimit: subscription?.languageLimit ?? null,
    staffLimit: subscription?.staffLimit ?? null,
    menuItemLimit: subscription?.menuItemLimit ?? null,
    menuPhotosEnabled: subscription?.menuPhotosEnabled ?? false,
    reviewsEnabled: subscription?.reviewsEnabled ?? false,
    reportsExportEnabled: subscription?.reportsExportEnabled ?? false,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    daysLeft: subscription?.currentPeriodEnd
      ? Math.ceil((subscription.currentPeriodEnd.getTime() - Date.now()) / DZIEN)
      : null,
    trial: subscription?.status === 'trialing',
  };
}

/**
 * Czy lokal może w ogóle przyjmować nowe zamówienia.
 *
 * Dwa niezależne powody odmowy i **oba muszą być sprawdzone w jednym miejscu**,
 * bo inaczej blokada administracyjna byłaby wpisem w bazie bez skutku. Wygaśnięcie
 * abonamentu mija po opłaceniu; blokadę zdejmuje człowiek z zaplecza.
 *
 * Granica jest ta sama, co przy abonamencie: wstrzymujemy **nowe zamówienia**,
 * nie rozliczanie. Lokal musi wziąć pieniądze za to, co już wydał.
 */
export async function wymagajCzynnegoKonta(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  const [organizacja, subscription] = await Promise.all([
    tx.organization.findUnique({
      where: { id: organizationId },
      select: { blockedAt: true, blockedReason: true },
    }),
    tx.subscription.findUnique({ where: { organizationId } }),
  ]);

  if (organizacja?.blockedAt) {
    throw new ForbiddenException(
      organizacja.blockedReason
        ? `Konto zostało zablokowane: ${organizacja.blockedReason}. Napisz na kontakt@kelbroo.com.`
        : 'Konto zostało zablokowane. Napisz na kontakt@kelbroo.com.',
    );
  }

  if (!subscriptionActive(subscription)) {
    throw new ForbiddenException(
      'Abonament wygasł — nowe zamówienia są wstrzymane. Otwarte rachunki możesz rozliczyć normalnie.',
    );
  }
}
