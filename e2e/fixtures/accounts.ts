import type { Account } from './db';

/**
 * Konta stałe, zakładane raz na przebieg i nigdy nie modyfikowane przez testy.
 * Wszystko, co zmienia hasło, zakłada sobie konto jednorazowe (patrz `uniqueEmail`).
 */
export const ACCOUNTS = {
  owner: {
    email: 'wlasciciel@e2e.test',
    password: 'e2eHaslo123',
    role: 'owner',
    name: 'Ewa Właścicielka',
  },
  kitchen: {
    email: 'kuchnia@e2e.test',
    password: 'e2eHaslo123',
    role: 'kitchen',
    name: 'Marek Kucharz',
  },
} satisfies Record<string, Account>;

export const ALL_ACCOUNTS: Account[] = Object.values(ACCOUNTS);
