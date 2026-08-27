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
export const PRIVACY_VERSION = '2026-08-27';

export interface RegistrationResult {
  restaurantName: string;
  slug: string;
  trialEndsAt: string;
  /** Konto istnieje, ale do panelu wpuści dopiero po kliknięciu w odnośnik. */
  emailVerificationRequired: boolean;
}

export interface RegistrationInput {
  restaurantName: string;
  ownerName: string;
  email: string;
  password: string;
  nip: string;
}

export type Pole = keyof RegistrationInput;

/**
 * Błąd rejestracji rozbity na pola.
 *
 * `pola` wypełnia się, gdy serwer odrzucił konkretne wartości; `ogolny` niesie
 * to, czego nie da się przypiąć do pola. Formularz potrzebuje obu — komunikat
 * pod polem prowadzi do poprawki, komunikat nad przyciskiem tylko informuje.
 */
export class RegistrationError extends Error {
  constructor(
    message: string,
    readonly pola: Partial<Record<Pole, string>> = {},
  ) {
    super(message);
    this.name = 'RegistrationError';
  }
}

/**
 * Potwierdzenie adresu z odnośnika w wiadomości.
 *
 * Wołane ze strony `/potwierdz`, do której prowadzi ten odnośnik.
 */
export async function verifyEmail(token: string): Promise<void> {
  const response = await fetch(`${API}/auth/verify-email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const komunikat =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `Serwer odpowiedział błędem ${response.status}.`;
    throw new Error(komunikat);
  }
}

/** Ponowna wysyłka potwierdzenia. Odpowiada tak samo dla nieistniejącego konta. */
export async function resendVerification(email: string): Promise<void> {
  await fetch(`${API}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

/** Komunikaty `class-validator` przychodzą po angielsku i z nazwą pola na początku. */
const POLA: Record<string, Pole> = {
  restaurantName: 'restaurantName',
  ownerName: 'ownerName',
  email: 'email',
  password: 'password',
  nip: 'nip',
};

const PO_POLSKU: { wzorzec: RegExp; tekst: string }[] = [
  { wzorzec: /must be an email/, tekst: 'To nie wygląda na poprawny adres e-mail.' },
  { wzorzec: /longer than or equal to (\d+)/, tekst: 'Za krótkie — minimum $1 znaki.' },
  { wzorzec: /shorter than or equal to (\d+)/, tekst: 'Za długie — maksimum $1 znaków.' },
  { wzorzec: /should not be empty|must be a string/, tekst: 'To pole jest wymagane.' },
  { wzorzec: /must be equal to true/, tekst: 'Bez tej zgody nie możemy założyć konta.' },
];

function naPolski(komunikat: string): string {
  for (const { wzorzec, tekst } of PO_POLSKU) {
    const trafienie = wzorzec.exec(komunikat);
    if (trafienie) return tekst.replace('$1', trafienie[1] ?? '');
  }
  return komunikat;
}

/** Rozbija odpowiedź walidatora na komunikaty przypisane do pól. */
function rozbij(komunikaty: string[]): Partial<Record<Pole, string>> {
  const pola: Partial<Record<Pole, string>> = {};
  for (const komunikat of komunikaty) {
    const nazwa = komunikat.split(' ')[0] ?? '';
    const pole = POLA[nazwa];
    // Pierwszy komunikat dla pola jest najbardziej konkretny — kolejne to zwykle
    // pochodne tego samego braku („must be a string" po „should not be empty").
    if (pole && !pola[pole]) pola[pole] = naPolski(komunikat);
  }
  return pola;
}

export async function register(input: RegistrationInput): Promise<RegistrationResult> {
  let response: Response;
  try {
    response = await fetch(`${API}/auth/register`, {
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
  } catch {
    throw new RegistrationError('Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie.');
  }

  const tekst = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(tekst);
  } catch {
    /* odpowiedź nie jest JSON-em — obsłużone niżej */
  }

  if (response.ok) return payload as RegistrationResult;

  const komunikat =
    payload && typeof payload === 'object' && 'message' in payload
      ? (payload as { message: unknown }).message
      : null;

  if (Array.isArray(komunikat)) {
    const pola = rozbij(komunikat.map(String));
    throw new RegistrationError(
      Object.keys(pola).length > 0
        ? 'Popraw zaznaczone pola.'
        : komunikat.map((k) => naPolski(String(k))).join(' '),
      pola,
    );
  }

  if (typeof komunikat === 'string') throw new RegistrationError(komunikat);

  /**
   * Serwer odpowiedział czymś, co nie jest naszym błędem — najczęściej stroną
   * HTML z proxy. Podajemy kod odpowiedzi, bo bez niego zgłoszenie „nie udało
   * się założyć konta" nie niesie żadnej informacji do diagnozy. Tak właśnie
   * wyglądała awaria z 2026-08-24: żądanie trafiało w stronę zamiast w API.
   */
  throw new RegistrationError(
    `Serwer odpowiedział błędem ${response.status} i nie podał powodu. ` +
      'Spróbuj ponownie za chwilę albo napisz na kontakt@kelbroo.com.',
  );
}

// ------------------------------------------------------------------- kontakt

export interface ContactInput {
  purpose: 'pytanie' | 'prezentacja';
  name: string;
  company?: string;
  email: string;
  phone?: string;
  preferredTime?: string;
  message: string;
  /** Pułapka na roboty — człowiek zostawia to pole puste. */
  website?: string;
}

/**
 * Wysyła zgłoszenie z formularza kontaktowego.
 *
 * Serwer ogranicza liczbę zgłoszeń z jednego adresu, więc 429 nie jest awarią
 * i ma swój własny komunikat — inaczej ktoś, kto poprawił literówkę i wysłał
 * ponownie, zobaczyłby „coś poszło nie tak".
 */
export async function sendContact(input: ContactInput): Promise<void> {
  const response = await fetch(`${API}/contact`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (response.status === 429) {
    throw new Error(
      'Wysłałeś już kilka wiadomości. Odezwiemy się na pierwszą — a jeśli sprawa pilna, ' +
        'napisz wprost na kontakt@kelbroo.com.',
    );
  }

  if (!response.ok) {
    const tresc = await response.json().catch(() => null);
    const komunikat = Array.isArray(tresc?.message) ? tresc.message[0] : tresc?.message;
    throw new Error(komunikat ?? 'Nie udało się wysłać wiadomości. Spróbuj ponownie.');
  }
}
