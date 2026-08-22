'use client';

import { io, type Socket } from 'socket.io-client';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
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
