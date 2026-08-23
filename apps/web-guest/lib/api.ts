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
  };
  table: { id: string; label: string; zone: string | null };
  session: {
    id: string;
    number: number;
    orderingEnabled: boolean;
    blockedReason: 'subscription_inactive' | 'awaiting_staff_activation' | null;
  };
  participant: {
    id: string;
    displayName: string;
    symbol: string;
    color: string;
    isHost: boolean;
  };
  guestToken: string | null;
  menu: Category[];
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
export async function callWaiter(qrToken: string, reason: CallReason): Promise<ActiveCall> {
  return request<ActiveCall>(qrToken, '/guest/calls', { reason });
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

export interface BillRequestResult {
  splitMode: GuestSplitMode;
  totalCents: number;
  currency: string;
  groups: { label: string | null; totalCents: number; members: string[] }[];
}

/** Prośba o rachunek z wyborem podziału. Zamyka go i tak wyłącznie kelner. */
export async function requestBill(
  qrToken: string,
  splitMode: GuestSplitMode,
): Promise<BillRequestResult> {
  return request<BillRequestResult>(qrToken, '/guest/bill-request', { splitMode });
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
  onChange: (kind: 'orders' | 'call') => void,
): { close: () => void } | null {
  const token = readToken(qrToken);
  if (!token) return null;

  const socket = io(`${WS}/guest`, { auth: { token }, transports: ['websocket', 'polling'] });
  socket.on('visit.changed', (event: { kind: 'orders' | 'call' }) => onChange(event.kind));
  return { close: () => socket.close() };
}
