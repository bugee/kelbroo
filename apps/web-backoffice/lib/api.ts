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
  const response = await fetch(`${API}/platform/login`, {
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
    await fetch(`${API}${sciezka}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  );
}

export const me = () => zTokenem<Admin>('/platform/me');
export const fetchClients = () => zTokenem<Klient[]>('/platform/clients');

export const dzien = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('pl-PL') : '—';
