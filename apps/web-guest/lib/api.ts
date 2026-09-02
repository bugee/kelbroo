/**
 * Klient API gościa.
 *
 * Token sesji trzymamy w localStorage pod kluczem zależnym od kodu QR: jedno
 * urządzenie może odwiedzić kilka lokali, a wizyta przy stoliku jest osobna
 * dla każdego z nich.
 */
import { io } from 'socket.io-client';

/**
 * Adres API.
 *
 * Domyślnie ŚCIEŻKA WZGLĘDNA: przeglądarka woła własny origin, a reverse proxy
 * kieruje /api do backendu. Dzięki temu nie ma CORS-u i nie ma adresu
 * wkompilowanego w bundle — NEXT_PUBLIC_* jest wstrzykiwane w momencie
 * budowania, więc zaszyty tam `localhost` oznaczałby telefon gościa, nie serwer.
 *
 * Zmienna przydaje się tylko wtedy, gdy API stoi pod innym originem —
 * na przykład lokalnie, gdzie aplikacja jest na 3001, a API na 4000.
 */
// `||`, nie `??`: Docker ustawia niepodany ARG na PUSTY łańcuch, a nie na brak
// zmiennej. Przy `??` bundle dostawał wtedy adres bazowy '' i przeglądarka pytała
// o /auth/login zamiast /api/auth/login — czyli o stronę 404 aplikacji Next.
const API = process.env.NEXT_PUBLIC_API_URL || '/api';
/** Socket.IO nie wisi pod /api — to osobna ścieżka na tym samym originie. */
const WS = API.replace(/\/api\/?$/, '');

export interface Modifier {
  id: string;
  name: string;
  priceDeltaCents: number;
  isAvailable: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  modifiers: Modifier[];
}

/** Adres zdjęcia dania. Nazwa pliku jest losowa i niezmienna, więc adres też. */
export const imageSrc = (nazwa: string) => `${API}/media/menu/${nazwa}`;

export interface Dish {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  isAvailable: boolean;
  allergens: string[];
  dietaryTags: string[];
  prepTimeMinutes: number | null;
  isFeatured: boolean;
  /** Nazwa pliku ze zdjęciem albo `null`. Adres składa `imageSrc`. */
  imageUrl: string | null;
  modifierGroups: ModifierGroup[];
}

export interface Category {
  id: string;
  name: string;
  items: Dish[];
}

export interface TableEntry {
  restaurant: {
    id: string;
    name: string;
    currency: string;
    locale: string;
    supportedLocales: string[];
    orderingMode: 'prepaid' | 'pay_at_table' | 'guest_choice';
    minOrderCents: number;
    /** Restauracja pokazowa — zamówienie nigdy nie trafi do żadnej kuchni. */
    isDemo: boolean;
  };
  table: { id: string; label: string; zone: string | null };
  session: {
    id: string;
    number: number;
    orderingEnabled: boolean;
    blockedReason:
      | 'subscription_inactive'
      | 'awaiting_staff_activation'
      | 'table_blocked'
      | 'visit_finished'
      | 'visit_moved'
      | 'awaiting_host_approval'
      | null;
  };
  participant: {
    id: string;
    displayName: string;
    symbol: string;
    color: string;
    isHost: boolean;
    approved: boolean;
    /** Czy gość może jeszcze wpisać własną nazwę. Wolno to zrobić raz na wizytę. */
    canChooseName: boolean;
  };
  /** Wszyscy wpuszczeni przy stoliku, razem z pytającym. Hostem od góry. */
  participants: {
    id: string;
    displayName: string;
    symbol: string;
    color: string;
    isHost: boolean;
  }[];
  guestToken: string | null;
  menu: Category[];
  /**
   * Obsługa przesadziła tę wizytę przy inny stolik.
   *
   * Przychodzi, gdy gość wraca pod stary adres — odświeża kartę sprzed
   * przesadzenia albo skanuje kod, który został na starym stoliku.
   */
  movedTo: { qrToken: string; label: string } | null;
}

export interface SessionOrders {
  session: {
    id: string;
    number: number;
    status: string;
    totalCents: number;
    paidCents: number;
    currency: string;
  };
  orders: {
    id: string;
    orderNumber: number;
    status: string;
    totalCents: number;
    createdAt: string;
    items: {
      id: string;
      name: string;
      quantity: number;
      unitPriceCents: number;
      status: string;
      addedByStaff: boolean;
      isMine: boolean;
      /** Czyja to pozycja — znak gościa, ten sam, którym przedstawia się kelnerowi. */
      forParticipant: { id: string; displayName: string; symbol: string; color: string } | null;
    }[];
  }[];
}

const tokenKey = (qrToken: string) => `kelbroo.guest.${qrToken}`;

export function readToken(qrToken: string): string | null {
  try {
    return localStorage.getItem(tokenKey(qrToken));
  } catch {
    // Prywatne okno albo zablokowane dane witryny — działamy bez pamięci.
    return null;
  }
}

/**
 * Zapamiętane wizyty, od ostatnio zapisanej.
 *
 * Klucz jest per kod QR, więc przesiadka do innego stolika to osobny wpis.
 * Kolejność ma znaczenie: przy dwóch stolikach tego samego dnia gość chce
 * wrócić do tego, przy którym siedzi teraz, a nie do pierwszego z brzegu.
 */
export function storedVisits(): { qrToken: string; guestToken: string }[] {
  try {
    return Object.keys(localStorage)
      .filter((klucz) => klucz.startsWith('kelbroo.guest.'))
      .map((klucz) => ({
        qrToken: klucz.slice('kelbroo.guest.'.length),
        guestToken: localStorage.getItem(klucz) ?? '',
      }))
      .filter((wpis) => wpis.guestToken !== '')
      .reverse();
  } catch {
    // Okno prywatne albo zablokowane dane witryny: nie ma czego wznawiać
    // i nie jest to błąd — ścieżka wraca do skanowania.
    return [];
  }
}

/**
 * Czy da się wrócić do zapamiętanej wizyty.
 *
 * Pyta **serwer**, a nie samą pamięć przeglądarki: token może być nasz, a wizyta
 * już rozliczona albo zastąpiona nową. Wejście z takim tokenem dopisałoby gościa
 * do cudzego stolika, więc decyzję podejmuje ta odpowiedź, nie obecność klucza.
 */
export async function canResume(qrToken: string, guestToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${API}/guest/resume`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ qrToken, guestToken }),
    });
    if (!response.ok) return false;
    const wynik = (await response.json()) as { resumable?: boolean };
    return wynik.resumable === true;
  } catch {
    // Brak sieci: nie zgadujemy. Ekran skanowania jest zawsze poprawną odpowiedzią.
    return false;
  }
}

/**
 * Przenosi token gościa pod adres nowego stolika.
 *
 * Token leży w pamięci **pod kluczem kodu QR**, więc samo przejście pod nowy
 * adres zrobiłoby z przesadzonego gościa kogoś zupełnie nowego: nowy uczestnik,
 * pusty rachunek, a prawdziwy rachunek dwa stoliki dalej. Skopiowanie wpisu jest
 * całą różnicą między „przesiedli się" a „zgubiliśmy im rachunek".
 *
 * Starego wpisu **nie kasujemy**: to on pozwala rozpoznać gościa, gdyby wrócił
 * pod stary adres jeszcze raz — na przykład z drugiej otwartej karty.
 */
export function moveToken(fromQrToken: string, toQrToken: string): boolean {
  const token = readToken(fromQrToken);
  if (!token) return false;
  writeToken(toQrToken, token);
  return true;
}

function writeToken(qrToken: string, token: string): void {
  try {
    localStorage.setItem(tokenKey(qrToken), token);
  } catch {
    /* brak pamięci nie może przerwać zamawiania */
  }
}

async function parse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : 'Coś poszło nie tak. Spróbuj ponownie.';
    throw new Error(message);
  }
  return payload as T;
}

export async function enterTable(qrToken: string, lang?: string): Promise<TableEntry> {
  const existing = readToken(qrToken);
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : '';

  const response = await fetch(`${API}/t/${encodeURIComponent(qrToken)}${query}`, {
    headers: existing ? { 'x-guest-token': existing } : undefined,
    cache: 'no-store',
  });

  const entry = await parse<TableEntry>(response);
  if (entry.guestToken) {
    writeToken(qrToken, entry.guestToken);
  }
  return entry;
}

export interface CartLine {
  dish: Dish;
  quantity: number;
  modifiers: Modifier[];
  note?: string;
}

export async function submitOrder(
  qrToken: string,
  lines: CartLine[],
  guestNote?: string,
): Promise<void> {
  const token = readToken(qrToken);
  if (!token) throw new Error('Sesja wygasła — zeskanuj kod QR ponownie.');

  const response = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-guest-token': token },
    body: JSON.stringify({
      items: lines.map((line) => ({
        menuItemId: line.dish.id,
        quantity: line.quantity,
        modifierIds: line.modifiers.map((modifier) => modifier.id),
        note: line.note || undefined,
      })),
      guestNote: guestNote || undefined,
    }),
  });

  await parse<unknown>(response);
}

export async function fetchOrders(qrToken: string): Promise<SessionOrders> {
  const token = readToken(qrToken);
  if (!token) throw new Error('Sesja wygasła — zeskanuj kod QR ponownie.');

  const response = await fetch(`${API}/orders`, {
    headers: { 'x-guest-token': token },
    cache: 'no-store',
  });
  return parse<SessionOrders>(response);
}

export function lineTotal(line: CartLine): number {
  const unit = line.dish.priceCents + line.modifiers.reduce((sum, m) => sum + m.priceDeltaCents, 0);
  return unit * line.quantity;
}

export function formatMoney(cents: number, currency: string, locale = 'pl-PL'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

export type CallReason = 'help' | 'water' | 'other';
export type GuestSplitMode = 'none' | 'per_person' | 'equal';

export interface ActiveCall {
  id: string;
  reason: 'help' | 'bill' | 'water' | 'other';
  /** `open` — poszło do obsługi. `acknowledged` — kelner potwierdził, że idzie. */
  status: 'open' | 'acknowledged';
}

/** Wezwanie kelnera. Powtórzone przy otwartym zgłoszeniu nie tworzy drugiego. */
/**
 * Własna nazwa zamiast wylosowanej — **raz na wizytę**.
 *
 * Serwer odmawia, gdy ktoś przy stoliku już się tak nazywa: nick jest podpisem
 * pod pozycjami wspólnego rachunku, więc dwie identyczne nazwy przy jednym
 * stoliku znaczyłyby dwie osoby nie do odróżnienia.
 */
export async function setMyName(
  qrToken: string,
  displayName: string,
): Promise<{ id: string; displayName: string }> {
  return request<{ id: string; displayName: string }>(qrToken, '/guest/me/name', { displayName });
}

export interface Reviewable {
  dishes: { menuItemId: string; name: string }[];
  alreadySubmitted: boolean;
}

/** Co gość może ocenić: jego **wydane** dania i czy już oceniał tę wizytę. */
export async function fetchReviewable(qrToken: string): Promise<Reviewable> {
  const token = readToken(qrToken);
  const response = await fetch(`${API}/guest/reviewable`, {
    headers: token ? { 'x-guest-token': token } : undefined,
    cache: 'no-store',
  });
  return parse<Reviewable>(response);
}

export interface ReviewSubmission {
  dishes?: { menuItemId: string; rating: number; comment?: string }[];
  visit?: { rating: number; target: 'kitchen' | 'service'; comment?: string };
}

/** Jedno zgłoszenie na wizytę — serwer odmówi drugiego. */
export const submitReview = (qrToken: string, zgloszenie: ReviewSubmission) =>
  request<{ saved: number }>(qrToken, '/guest/reviews', zgloszenie);

export async function callWaiter(qrToken: string, reason: CallReason): Promise<ActiveCall> {
  return request<ActiveCall>(qrToken, '/guest/calls', { reason });
}

/**
 * Wycofanie wezwania — gość stuknął i zaraz się rozmyślił.
 *
 * Serwer odmawia, gdy kelner zgłoszenie przyjął: idzie już przez salę, więc
 * zniknięcie tego z ekranu byłoby kłamstwem.
 */
export async function cancelWaiter(qrToken: string): Promise<{ canceled: boolean }> {
  return request<{ canceled: boolean }>(qrToken, '/guest/calls/cancel', { reason: 'help' });
}

/** Stan wezwań stolika. Przycisk czyta go z serwera, zamiast zgadywać z timera. */
export async function fetchActiveCalls(qrToken: string): Promise<ActiveCall[]> {
  const token = readToken(qrToken);
  const response = await fetch(`${API}/guest/calls`, {
    headers: token ? { 'x-guest-token': token } : undefined,
    cache: 'no-store',
  });
  return parse<ActiveCall[]>(response);
}

export type PaymentPreference = 'cash' | 'card' | 'mixed';

export interface BillRequestResult {
  splitMode: GuestSplitMode;
  payment: PaymentPreference;
  invoiceRequested: boolean;
  totalCents: number;
  currency: string;
  groups: { label: string | null; totalCents: number; members: string[] }[];
}

/** Prośba o rachunek z wyborem podziału. Zamyka go i tak wyłącznie kelner. */
export async function requestBill(
  qrToken: string,
  splitMode: GuestSplitMode,
  payment: PaymentPreference,
  invoiceRequested: boolean,
): Promise<BillRequestResult> {
  return request<BillRequestResult>(qrToken, '/guest/bill-request', {
    splitMode,
    payment,
    invoiceRequested,
  });
}

async function request<T = void>(qrToken: string, path: string, body: unknown): Promise<T> {
  const token = readToken(qrToken);
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-guest-token': token } : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : 'Nie udało się wysłać zgłoszenia.';
    throw new Error(message);
  }
  return payload as T;
}

/**
 * Kanał wizyty.
 *
 * Zdarzenie mówi tylko, że coś się zmieniło — dane dociągamy przez REST, więc
 * zgubiona wiadomość nie zostawia gościa z nieaktualnym rachunkiem. Jedno
 * połączenie na kartę, tak jak w panelu.
 */
export function connectVisit(
  qrToken: string,
  onChange: (kind: 'orders' | 'call' | 'access' | 'table') => void,
): { close: () => void } | null {
  const token = readToken(qrToken);
  if (!token) return null;

  const socket = io(`${WS}/guest`, { auth: { token }, transports: ['websocket', 'polling'] });
  socket.on('visit.changed', (event: { kind: 'orders' | 'call' | 'access' | 'table' }) =>
    onChange(event.kind),
  );
  return { close: () => socket.close() };
}

/**
 * Zestawienie „kto co zamówił" jako plik PDF.
 *
 * **Pobranie, nie wysyłka.** Plik idzie prosto do telefonu, więc nie pytamy
 * o adres e-mail i nie mamy czego zapisywać ani opisywać w dokumentach —
 * patrz `docs/analiza-zgoda-na-zestawienie.md`.
 *
 * Adresu nie da się otworzyć zwykłym odnośnikiem: token gościa jedzie
 * w nagłówku, a `<a href>` nagłówków nie ustawia. Stąd pobranie przez `fetch`
 * i sztuczny odnośnik na blobie.
 */
export async function downloadBillSummary(qrToken: string): Promise<void> {
  const token = readToken(qrToken);
  if (!token) throw new Error('Sesja wygasła — zeskanuj kod QR ponownie.');

  const response = await fetch(`${API}/guest/bill-summary.pdf`, {
    headers: { 'x-guest-token': token },
  });
  if (!response.ok) {
    // Błąd przychodzi JSON-em, nie PDF-em — czytamy go tą samą drogą co wszędzie.
    await parse<never>(response);
    return;
  }

  const naglowek = response.headers.get('content-disposition') ?? '';
  const nazwa = /filename="([^"]+)"/.exec(naglowek)?.[1] ?? 'zestawienie.pdf';

  const adres = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = adres;
  link.download = nazwa;
  link.click();
  // Bez tego adres `blob:` trzyma plik w pamięci do końca życia karty.
  URL.revokeObjectURL(adres);
}

/**
 * Prośba o otwarcie zablokowanego stolika.
 *
 * Bez tokenu gościa — przy zablokowanym stoliku żadnej sesji nie ma i mieć nie
 * może, bo o jej otwarcie właśnie chodzi.
 */
export async function requestTableOpen(qrToken: string): Promise<{ status: string }> {
  const response = await fetch(`${API}/guest/tables/${encodeURIComponent(qrToken)}/open-request`, {
    method: 'POST',
    cache: 'no-store',
  });
  return parse<{ status: string }>(response);
}

export interface PendingGuest {
  id: string;
  displayName: string;
  symbol: string;
  color: string;
  joinedAt: string;
}

/** Kto czeka na wpuszczenie. Serwer odsyła pustą listę każdemu poza hostem. */
export async function fetchPendingGuests(qrToken: string): Promise<PendingGuest[]> {
  const token = readToken(qrToken);
  const response = await fetch(`${API}/guest/pending-guests`, {
    headers: token ? { 'x-guest-token': token } : undefined,
    cache: 'no-store',
  });
  return parse<PendingGuest[]>(response);
}

/** Decyzja hosta o oczekującym gościu. */
export async function decidePendingGuest(
  qrToken: string,
  participantId: string,
  decision: 'approve' | 'reject',
): Promise<{ id: string; approved: boolean }> {
  return request<{ id: string; approved: boolean }>(
    qrToken,
    `/guest/pending-guests/${participantId}`,
    { decision },
  );
}

/** Zapomnienie wizyty — gość świadomie zaczyna nową przy tym samym stoliku. */
export function forgetVisit(qrToken: string): void {
  try {
    localStorage.removeItem(tokenKey(qrToken));
  } catch {
    /* brak pamięci to i tak brak wizyty do zapomnienia */
  }
}
