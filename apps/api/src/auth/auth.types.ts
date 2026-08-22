import type { StaffRole } from '@kelbroo/types';

/** Kontekst zalogowanego pracownika, odtwarzany z tokenu przy każdym żądaniu. */
export interface StaffContext {
  staffId: string;
  organizationId: string;
  restaurantId: string | null;
  role: StaffRole;
  name: string;
}

export interface AccessTokenPayload {
  sub: string;
  org: string;
  rst: string | null;
  role: StaffRole;
  name: string;
}

/**
 * Hierarchia uprawnień: owner > manager > waiter/kitchen.
 * Kelner i kuchnia są równorzędne — mają różne zakresy, nie różne poziomy.
 */
export const ROLE_RANK: Record<StaffRole, number> = {
  owner: 3,
  manager: 2,
  waiter: 1,
  kitchen: 1,
};
