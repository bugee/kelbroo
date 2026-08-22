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
const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';
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
  participants: { id: string; displayName: string; color: string; isHost: boolean }[];
}

const ACCESS = 'kelbroo.staff.access';
const REFRESH = 'kelbroo.staff.refresh';

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
  } catch {
    /* nic do posprzątania */
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

export async function login(email: string, password: string): Promise<Staff> {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const result = await parse<{ accessToken: string; refreshToken: string; staff: Staff }>(response);
  store(result.accessToken, result.refreshToken);
  return result.staff;
}

export const me = () => authorized<Staff>('/auth/me');
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
export function connectRealtime(onChange: () => void): Socket | null {
  const token = readAccess();
  if (!token) return null;

  const socket = io(`${WS}/staff`, { auth: { token }, transports: ['websocket', 'polling'] });
  socket.on('order.changed', onChange);
  socket.on('connect', onChange);
  return socket;
}

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
  `${process.env.NEXT_PUBLIC_GUEST_URL ?? 'http://localhost:3001'}/t/${qrToken}`;
