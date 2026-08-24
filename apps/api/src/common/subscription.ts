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
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    daysLeft: subscription?.currentPeriodEnd
      ? Math.ceil((subscription.currentPeriodEnd.getTime() - Date.now()) / DZIEN)
      : null,
    trial: subscription?.status === 'trialing',
  };
}
