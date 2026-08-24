/**
 * Wołanie API z tego samego originu.
 *
 * Bez adresu w zmiennej środowiskowej: za reverse proxy `/api` prowadzi do API,
 * a strona nie musi wiedzieć, gdzie ono stoi. Lokalnie, bez proxy, można podać
 * `NEXT_PUBLIC_API_URL` — wtedy adres wchodzi do bundla w czasie budowania.
 */
const API = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Wersje dokumentów, na które zgadza się zakładający konto.
 *
 * Muszą odpowiadać nagłówkom `_Wersja …_` w `docs/legal/` — zgoda zapisuje się
 * z wersją, a spór rozstrzyga to, co wtedy było napisane. Zmiana treści dokumentu
 * bez zmiany tej stałej daje zgody wskazujące na nieistniejące brzmienie.
 */
export const TERMS_VERSION = '2026-08-24';
export const PRIVACY_VERSION = '2026-08-24';

export interface RegistrationResult {
  restaurantName: string;
  slug: string;
  trialEndsAt: string;
}

export interface RegistrationInput {
  restaurantName: string;
  ownerName: string;
  email: string;
  password: string;
}

export async function register(input: RegistrationInput): Promise<RegistrationResult> {
  const response = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...input,
      acceptTerms: true,
      acceptPrivacy: true,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
    }),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : 'Nie udało się założyć konta.';
    throw new Error(message);
  }
  return payload as RegistrationResult;
}
