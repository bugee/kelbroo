const API = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Sesja zaplecza żyje w `sessionStorage`, nie w `localStorage`.
 *
 * To konto widzi wszystkich klientów, więc zamknięcie karty ma je wylogować.
 * Token i tak wygasa po dwóch godzinach, ale zostawianie go na dysku laptopa,
 * który bywa otwarty na biurku, byłoby wyborem bez powodu.
 */
const KLUCZ = 'kelbroo.platform.token';

export const readToken = (): string | null => {
  try {
    return sessionStorage.getItem(KLUCZ);
  } catch {
    return null;
  }
};

const writeToken = (token: string): void => {
  try {
    sessionStorage.setItem(KLUCZ, token);
  } catch {
    /* prywatne okno — sesja przeżyje tylko do przeładowania */
  }
};

export const clearToken = (): void => {
  try {
    sessionStorage.removeItem(KLUCZ);
  } catch {
    /* nic do wyczyszczenia */
  }
};

export interface Admin {
  adminId: string;
  email: string;
  name: string;
}

export interface Lokal {
  id: string;
  nazwa: string;
  slug: string;
  stolikow: number;
}

export interface Klient {
  organizationId: string;
  nazwa: string;
  nip: string | null;
  emailRozliczeniowy: string;
  zalozone: string;
  regulaminZaakceptowany: string | null;
  plan: string | null;
  status: string;
  demo: boolean;
  aktywny: boolean;
  aktywnyDo: string | null;
  dniDoKonca: number | null;
  lokale: Lokal[];
  pracownikow: number;
  ostatnieLogowanie: string | null;
}

/**
 * Żądanie z rozróżnieniem awarii sieci od odpowiedzi serwera.
 *
 * `fetch` rzuca „Failed to fetch" i przy wyłączonym API, i przy odciętym CORS-ie —
 * a to komunikat, z którego nie da się wyjść. Zamieniamy go na zdanie mówiące,
 * gdzie szukać: najczęstszą przyczyną lokalnie jest brak portu zaplecza
 * w `CORS_ORIGINS`, a przeglądarka nie pokazuje tego nigdzie indziej.
 */
async function zapytaj(sciezka: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API}${sciezka}`, init);
  } catch {
    throw new Error(
      `Nie udało się połączyć z API (${API}). Sprawdź, czy działa i czy adres tej strony ` +
        'jest wymieniony w CORS_ORIGINS.',
    );
  }
}

async function odczytaj<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const komunikat =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `Serwer odpowiedział błędem ${response.status}.`;
    throw new Error(komunikat);
  }
  return payload as T;
}

export async function login(email: string, password: string): Promise<Admin> {
  const response = await zapytaj('/platform/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const wynik = await odczytaj<{ accessToken: string; admin: Admin }>(response);
  writeToken(wynik.accessToken);
  return wynik.admin;
}

async function zTokenem<T>(sciezka: string): Promise<T> {
  const token = readToken();
  if (!token) throw new Error('Brak sesji.');
  return odczytaj<T>(
    await zapytaj(sciezka, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  );
}

export type Plan = 'menu' | 'starter' | 'pro' | 'enterprise';

export interface KartaKlienta {
  organizationId: string;
  nazwa: string;
  nip: string | null;
  emailRozliczeniowy: string;
  zalozone: string;
  zablokowane: string | null;
  powodBlokady: string | null;
  regulamin: { zaakceptowany: string | null; wersja: string | null };
  prywatnosc: { zaakceptowana: string | null; wersja: string | null };
  abonament: {
    active: boolean;
    status: string;
    currentPeriodEnd: string | null;
    daysLeft: number | null;
    trial: boolean;
    plan: string | null;
    tableLimit: number | null;
    languageLimit: number | null;
  };
  lokale: {
    id: string;
    nazwa: string;
    slug: string;
    trybZamawiania: string;
    stolikow: number;
    pozycjiWKarcie: number;
  }[];
  personel: {
    id: string;
    imie: string;
    email: string;
    rola: string;
    aktywne: boolean;
    potwierdzony: boolean;
    ostatnieLogowanie: string | null;
  }[];
  historia: { id: string; akcja: string; powod: string | null; kiedy: string }[];
}

async function operacja<T>(sciezka: string, body: unknown): Promise<T> {
  const token = readToken();
  if (!token) throw new Error('Brak sesji.');
  return odczytaj<T>(
    await zapytaj(sciezka, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export const fetchClient = (id: string) => zTokenem<KartaKlienta>(`/platform/clients/${id}`);

export const extendSubscription = (id: string, days: number, reason: string) =>
  operacja<{ currentPeriodEnd: string }>(`/platform/clients/${id}/extend`, { days, reason });

export const changePlan = (id: string, plan: Plan, reason: string) =>
  operacja<{ plan: string }>(`/platform/clients/${id}/plan`, { plan, reason });

export const blockClient = (id: string, reason: string) =>
  operacja<{ zablokowane: boolean }>(`/platform/clients/${id}/block`, { reason });

export const unblockClient = (id: string, reason: string) =>
  operacja<{ zablokowane: boolean }>(`/platform/clients/${id}/unblock`, { reason });

export const me = () => zTokenem<Admin>('/platform/me');
export const fetchClients = () => zTokenem<Klient[]>('/platform/clients');

export const dzien = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('pl-PL') : '—';
