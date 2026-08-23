'use client';

import { io, type Socket } from 'socket.io-client';

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
const WS = API.replace(/\/api\/?$/, '');

export type StaffRole = 'owner' | 'manager' | 'waiter' | 'kitchen';

export interface Staff {
  staffId: string;
  organizationId: string;
  restaurantId: string | null;
  role: StaffRole;
  name: string;
}

export interface StaffOrder {
  id: string;
  orderNumber: number;
  status: string;
  paymentStatus: string;
  tableLabel: string;
  guestName: string | null;
  guestSymbol: string | null;
  guestColor: string | null;
  guestNote: string | null;
  totalCents: number;
  currency: string;
  createdAt: string;
  confirmedAt: string | null;
  items: {
    id: string;
    name: string;
    quantity: number;
    note: string | null;
    modifiers: string[];
    addedByStaff: boolean;
  }[];
}

export interface StaffSession {
  id: string;
  tableId: string;
  number: number;
  tableLabel: string;
  zone: string | null;
  status: string;
  openedAt: string;
  totalCents: number;
  paidCents: number;
  dueCents: number;
  currency: string;
  orderCount: number;
  participants: {
    id: string;
    displayName: string;
    symbol: string;
    color: string;
    isHost: boolean;
    /** `false` znaczy: czeka, aż host go wpuści do wizyty. */
    approved: boolean;
  }[];
}

export interface OrderingTable {
  id: string;
  label: string;
  zone: string | null;
  openSession: {
    id: string;
    number: number;
    totalCents: number;
    participants: {
      id: string;
      displayName: string;
      symbol: string;
      color: string;
      isHost: boolean;
    }[];
  } | null;
}

export interface OrderingMenuItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  isAvailable: boolean;
}

export interface OrderingMenu {
  currency: string;
  categories: { id: string; name: string; items: OrderingMenuItem[] }[];
}

export interface StaffOrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  note: string | null;
  modifiers: string[];
  /** Trzy niezależne atrybucje — zwykle trzy różne osoby. */
  addedByStaff: boolean;
  addedByName: string | null;
  forGuestName: string | null;
  forGuestSymbol: string | null;
  forGuestColor: string | null;
  lastEditedByName: string | null;
  lastEditedAt: string | null;
}

export interface StaffOrderDetail {
  id: string;
  orderNumber: number;
  status: string;
  paymentStatus: string;
  tableLabel: string;
  source: string;
  placedByStaffName: string | null;
  guestName: string | null;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  currency: string;
  createdAt: string;
  items: StaffOrderItem[];
}

export interface OrderEventView {
  id: string;
  type: string;
  at: string;
  actorType: string;
  actorName: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
}

export type SplitMode = 'none' | 'per_person' | 'equal' | 'groups';

export interface SplitPlan {
  id: string;
  number: number;
  tableLabel: string;
  status: string;
  splitMode: SplitMode;
  totalCents: number;
  paidCents: number;
  dueCents: number;
  currency: string;
  /** Po pierwszej płatności kwoty grup są zamrożone. */
  locked: boolean;
  participants: {
    id: string;
    displayName: string;
    symbol: string;
    color: string;
    isHost: boolean;
    settlementGroupId: string | null;
  }[];
  groups: {
    id: string;
    label: string | null;
    status: string;
    totalCents: number;
    members: { id: string; displayName: string; symbol: string; color: string }[];
  }[];
}

export interface WaiterCall {
  id: string;
  tableId: string;
  tableLabel: string;
  reason: 'help' | 'bill' | 'water' | 'open_table' | 'other';
  status: 'open' | 'acknowledged';
  createdAt: string;
  acknowledgedBy: string | null;
}

export const resetTable = (tableId: string, reason: string) =>
  authorized<{ id: string; label: string; blockedUntil: string | null }>(
    `/staff/tables/${tableId}/reset`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );

export const blockTable = (tableId: string, reason?: string) =>
  authorized<{ id: string; label: string; blockedUntil: string | null }>(
    `/staff/tables/${tableId}/block`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );

export const unblockTable = (tableId: string) =>
  authorized<{ id: string; label: string; blockedUntil: string | null }>(
    `/staff/tables/${tableId}/unblock`,
    { method: 'POST' },
  );

export const removeParticipant = (sessionId: string, participantId: string) =>
  authorized<{ sessionId: string }>(`/staff/sessions/${sessionId}/participants/${participantId}`, {
    method: 'DELETE',
  });

/** Zgoda zastępcza na wejście gościa: host bywa zajęty albo odszedł od stolika. */
export const decidePendingGuest = (
  sessionId: string,
  participantId: string,
  decision: 'approve' | 'reject',
) =>
  authorized<{ id: string; approved: boolean }>(
    `/staff/sessions/${sessionId}/pending-guests/${participantId}`,
    { method: 'POST', body: JSON.stringify({ decision }) },
  );

export const fetchWaiterCalls = () => authorized<WaiterCall[]>('/staff/calls');

export const acknowledgeCall = (id: string) =>
  authorized<{ id: string; status: string }>(`/staff/calls/${id}/acknowledge`, { method: 'POST' });

export const resolveCall = (id: string) =>
  authorized<{ id: string; status: string }>(`/staff/calls/${id}/resolve`, { method: 'POST' });

export const fetchSplit = (sessionId: string) =>
  authorized<SplitPlan>(`/staff/sessions/${sessionId}/split`);

export const setSplitMode = (
  sessionId: string,
  payload: { splitMode: SplitMode; groups?: { label?: string; participantIds: string[] }[] },
) =>
  authorized<SplitPlan>(`/staff/sessions/${sessionId}/split`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const settleSplitGroup = (
  sessionId: string,
  groupId: string,
  method: 'cash' | 'card_terminal',
) =>
  authorized<SplitPlan>(`/staff/sessions/${sessionId}/groups/${groupId}/settle`, {
    method: 'POST',
    body: JSON.stringify({ method }),
  });

export const fetchOrderingTables = () => authorized<OrderingTable[]>('/staff/tables');
export const fetchOrderingMenu = () => authorized<OrderingMenu>('/staff/menu');

export const placeOrderForGuest = (payload: {
  tableId: string;
  forParticipantId?: string;
  note?: string;
  items: { menuItemId: string; quantity: number }[];
}) =>
  authorized<StaffOrderDetail>('/staff/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const addOrderItems = (orderId: string, items: { menuItemId: string; quantity: number }[]) =>
  authorized<StaffOrderDetail>(`/staff/orders/${orderId}/items`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });

export const changeOrderItemQuantity = (orderId: string, itemId: string, quantity: number) =>
  authorized<StaffOrderDetail>(`/staff/orders/${orderId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });

export const removeOrderItem = (orderId: string, itemId: string, reason?: string) =>
  authorized<StaffOrderDetail>(`/staff/orders/${orderId}/items/${itemId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });

export const fetchOrderHistory = (orderId: string) =>
  authorized<OrderEventView[]>(`/staff/orders/${orderId}/history`);

const ACCESS = 'kelbroo.staff.access';
const REFRESH = 'kelbroo.staff.refresh';
// Flaga wymuszonej zmiany hasła przychodzi tylko przy logowaniu — `me()` czyta
// kontekst z tokenu, a tokenu nie chcemy rozdymać o stan, który zmienia się raz.
const MUST_CHANGE = 'kelbroo.staff.must-change-password';

export const readAccess = (): string | null => {
  try {
    return localStorage.getItem(ACCESS);
  } catch {
    return null;
  }
};

function store(access: string, refresh: string): void {
  try {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
  } catch {
    /* panel działa też bez pamięci — do najbliższego przeładowania */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem(MUST_CHANGE);
  } catch {
    /* nic do posprzątania */
  }
}

export function readMustChangePassword(): boolean {
  try {
    return localStorage.getItem(MUST_CHANGE) === '1';
  } catch {
    return false;
  }
}

function rememberMustChangePassword(required: boolean): void {
  try {
    if (required) localStorage.setItem(MUST_CHANGE, '1');
    else localStorage.removeItem(MUST_CHANGE);
  } catch {
    /* bez pamięci wymuszenie po prostu nie przetrwa przeładowania */
  }
}

async function parse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : 'Operacja się nie powiodła.';
    throw new Error(message);
  }
  return payload as T;
}

/**
 * Jedno wywołanie ponawiamy po odświeżeniu tokenu. Token dostępu żyje 15 minut,
 * a zmiana w restauracji trwa osiem godzin — bez tego kelner wylatywałby
 * z panelu w środku serwisu.
 */
async function authorized<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const access = readAccess();
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(access ? { authorization: `Bearer ${access}` } : {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    cache: 'no-store',
  });

  if (response.status === 401 && retry && (await refreshTokens())) {
    return authorized<T>(path, init, false);
  }
  return parse<T>(response);
}

async function refreshTokens(): Promise<boolean> {
  let refreshToken: string | null = null;
  try {
    refreshToken = localStorage.getItem(REFRESH);
  } catch {
    return false;
  }
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const tokens = await parse<{ accessToken: string; refreshToken: string }>(response);
    store(tokens.accessToken, tokens.refreshToken);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

/** Logowanie zwraca dodatkowo flagę wymuszonej zmiany hasła — `me()` już nie,
 *  bo ta pochodzi z bazy, a nie z tokenu. */
export interface LoggedInStaff extends Staff {
  mustChangePassword: boolean;
}

export async function login(email: string, password: string): Promise<LoggedInStaff> {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const result = await parse<{
    accessToken: string;
    refreshToken: string;
    staff: LoggedInStaff;
  }>(response);
  store(result.accessToken, result.refreshToken);
  rememberMustChangePassword(result.staff.mustChangePassword);
  return result.staff;
}

/** Własne dane konta — lista zespołu celowo nie pozwala ruszyć samego siebie. */
export const updateProfile = (payload: { name?: string; email?: string }) =>
  authorized<{ email: string; name: string }>('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  /** Konto zalogowanej osoby — zmienia się je przez ekran hasła, nie przez listę. */
  isSelf: boolean;
  /** Czy zalogowana rola w ogóle może ruszyć to konto. Panel nie pokazuje reszty akcji. */
  canManage: boolean;
}

export const fetchStaff = () => authorized<StaffMember[]>('/management/staff');

export const createStaffMember = (payload: {
  email: string;
  name: string;
  role: StaffRole;
  password: string;
}) =>
  authorized<StaffMember>('/management/staff', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateStaffMember = (
  id: string,
  payload: { email?: string; name?: string; role?: StaffRole },
) =>
  authorized<StaffMember>(`/management/staff/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const setStaffActive = (id: string, isActive: boolean) =>
  authorized<StaffMember>(`/management/staff/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });

export const resetStaffPassword = (id: string, password: string) =>
  authorized<StaffMember>(`/management/staff/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });

export const me = () => authorized<Staff>('/auth/me');

/** Aktualne hasło jest wymagane mimo ważnej sesji — patrz komentarz w auth.service.ts. */
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  await authorized<void>('/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  rememberMustChangePassword(false);
};
export const fetchQueue = () => authorized<StaffOrder[]>('/staff/orders/queue');
export const fetchKitchen = () => authorized<StaffOrder[]>('/staff/orders/kitchen');
export const fetchSessions = () => authorized<StaffSession[]>('/staff/sessions');

export const confirmOrder = (id: string) =>
  authorized<StaffOrder>(`/staff/orders/${id}/confirm`, { method: 'POST' });

export const rejectOrder = (id: string, reason: string) =>
  authorized<StaffOrder>(`/staff/orders/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

export const advanceOrder = (id: string, status: 'preparing' | 'ready' | 'served') =>
  authorized<StaffOrder>(`/staff/orders/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });

export const settleSession = (id: string, method: 'cash' | 'card_terminal', amountCents: number) =>
  authorized<StaffSession>(`/staff/sessions/${id}/settle`, {
    method: 'POST',
    body: JSON.stringify({ method, amountCents }),
  });

/**
 * WebSocket nie jest jedynym źródłem prawdy — po każdym zdarzeniu i po
 * ponownym połączeniu dociągamy stan przez REST. Wi-fi w lokalach gubi
 * połączenia i pojedyncze zgubione zdarzenie nie może zostawić kuchni
 * z nieaktualną tablicą.
 */
let shared: Socket | null = null;
let subscribers = 0;

/**
 * Jedno połączenie na kartę, niezależnie od liczby subskrybentów.
 *
 * Powłoka panelu nasłuchuje dla liczników, a każdy ekran dla swoich danych —
 * osobne gniazdo dla każdego z nich oznaczałoby kilka połączeń z jednego tabletu.
 * Zwracany obiekt ma `close()`, więc wołający nie musi wiedzieć, że gniazdo jest wspólne.
 */
export function connectRealtime(onChange: () => void): { close: () => void } | null {
  const token = readAccess();
  if (!token) return null;

  shared ??= io(`${WS}/staff`, { auth: { token }, transports: ['websocket', 'polling'] });
  subscribers += 1;

  const socket = shared;
  socket.on('order.changed', onChange);
  // Wezwania kelnera lecą tym samym pokojem lokalu.
  socket.on('waiter.called', onChange);
  socket.on('connect', onChange);

  return {
    close: () => {
      socket.off('order.changed', onChange);
      socket.off('waiter.called', onChange);
      socket.off('connect', onChange);

      subscribers -= 1;
      if (subscribers === 0) {
        socket.close();
        shared = null;
      }
    },
  };
}

export const fetchBadges = () => authorized<Record<string, number>>('/staff/badges');

export const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(cents / 100);

export const minutesSince = (iso: string): number =>
  Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

// ---------------------------------------------------------------- konfiguracja

export interface Translation {
  locale: string;
  name: string;
  description?: string | null;
}

export interface AdminModifier {
  id?: string;
  priceDeltaCents: number;
  isAvailable?: boolean;
  translations: Translation[];
}

export interface AdminModifierGroup {
  id?: string;
  minSelect: number;
  maxSelect: number;
  isRequired?: boolean;
  translations: Translation[];
  modifiers: AdminModifier[];
}

export interface AdminItem {
  id: string;
  priceCents: number;
  vatPercent: number;
  sortOrder: number;
  isAvailable: boolean;
  isArchived: boolean;
  isFeatured: boolean;
  allergens: string[];
  dietaryTags: string[];
  prepTimeMinutes: number | null;
  translations: Translation[];
  modifierGroups: AdminModifierGroup[];
}

export interface AdminCategory {
  id: string;
  sortOrder: number;
  isActive: boolean;
  isArchived: boolean;
  translations: Translation[];
  items: AdminItem[];
}

export interface AdminMenu {
  defaultLocale: string;
  supportedLocales: string[];
  currency: string;
  categories: AdminCategory[];
}

export interface AdminTable {
  id: string;
  label: string;
  zone: string | null;
  seats: number | null;
  isActive: boolean;
  qrToken: string;
  qrVersion: number;
}

export interface AdminTables {
  tableLimit: number;
  activeCount: number;
  tables: AdminTable[];
}

export interface RestaurantSettings {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  currency: string;
  timezone: string;
  defaultLocale: string;
  supportedLocales: string[];
  orderingMode: string;
  requireStaffConfirmation: boolean;
  tableActivationRequired: boolean;
  hostApprovesGuests: boolean;
  partialSettlementEnabled: boolean;
  minOrderCents: number;
  openBillLimitCents: number | null;
  businessDayStartHour: number;
  fiscalizationMode: string;
  subscription: {
    plan: string;
    status: string;
    tableLimit: number;
    languageLimit: number;
    currentPeriodEnd: string | null;
  } | null;
}

export interface ItemPayload {
  categoryId: string;
  priceCents: number;
  vatPercent: number;
  translations: Translation[];
  isAvailable?: boolean;
  isFeatured?: boolean;
  allergens?: string[];
  dietaryTags?: string[];
  prepTimeMinutes?: number;
  modifierGroups?: AdminModifierGroup[];
}

export const fetchAdminMenu = () => authorized<AdminMenu>('/management/menu');

export const createCategory = (translations: Translation[]) =>
  authorized<{ id: string }>('/management/menu/categories', {
    method: 'POST',
    body: JSON.stringify({ translations }),
  });

export const archiveCategory = (id: string, isArchived: boolean) =>
  authorized(`/management/menu/categories/${id}/archived`, {
    method: 'PATCH',
    body: JSON.stringify({ isArchived }),
  });

export const createItem = (payload: ItemPayload) =>
  authorized<{ id: string }>('/management/menu/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateItem = (id: string, payload: ItemPayload) =>
  authorized<{ id: string }>(`/management/menu/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const setItemAvailability = (id: string, isAvailable: boolean) =>
  authorized(`/management/menu/items/${id}/availability`, {
    method: 'PATCH',
    body: JSON.stringify({ isAvailable }),
  });

export const archiveItem = (id: string, isArchived: boolean) =>
  authorized(`/management/menu/items/${id}/archived`, {
    method: 'PATCH',
    body: JSON.stringify({ isArchived }),
  });

export const fetchTables = () => authorized<AdminTables>('/management/tables');

export const createTable = (payload: { label: string; zone?: string; seats?: number }) =>
  authorized<{ id: string; qrToken: string }>('/management/tables', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const regenerateQr = (id: string) =>
  authorized<{ qrToken: string; qrVersion: number }>(`/management/tables/${id}/regenerate-qr`, {
    method: 'POST',
  });

export const setTableActive = (id: string, isActive: boolean) =>
  authorized(`/management/tables/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });

export const fetchRestaurant = () => authorized<RestaurantSettings>('/management/restaurant');

export const updateRestaurant = (payload: Partial<RestaurantSettings>) =>
  authorized<{ removedLocales: string[] }>('/management/restaurant', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

/** Adres, który koduje kod QR na stoliku. */
export const guestUrlFor = (qrToken: string): string =>
  `${process.env.NEXT_PUBLIC_GUEST_URL || 'http://localhost:3001'}/t/${qrToken}`;
