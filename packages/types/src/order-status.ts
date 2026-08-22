/**
 * Maszyna stanów zamówienia (docs/architecture.md §6.1, §13.3).
 *
 * Moduł jest czysty i współdzielony celowo: API waliduje nim przejścia, a panel
 * kelnera i KDS decydują nim, które przyciski pokazać. Dwie kopie tej wiedzy
 * rozjechałyby się przy pierwszej zmianie.
 */
import type { OrderStatus, OrderingMode } from './domain.js';

/**
 * Dozwolone przejścia. `rejected`, `canceled` i `closed` są końcowe —
 * korekta zamkniętego rachunku idzie przez storno, nie przez cofnięcie statusu.
 */
const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  submitted: ['awaiting_confirmation', 'confirmed', 'canceled'],
  awaiting_confirmation: ['confirmed', 'rejected', 'canceled'],
  confirmed: ['preparing', 'canceled'],
  preparing: ['ready', 'canceled'],
  ready: ['served', 'canceled'],
  served: ['closed'],
  closed: [],
  rejected: [],
  canceled: [],
};

export const TERMINAL_STATUSES: readonly OrderStatus[] = ['closed', 'rejected', 'canceled'];

export class OrderTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`Niedozwolone przejście zamówienia: ${from} → ${to}.`);
    this.name = 'OrderTransitionError';
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new OrderTransitionError(from, to);
  }
}

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Anulowanie po rozpoczęciu przygotowania oznacza stratę produktu — wymaga
 * uprawnień managera i powodu, który trafia do AuditLog.
 */
export function cancellationRequiresManager(status: OrderStatus): boolean {
  return status === 'preparing' || status === 'ready';
}

export interface SubmissionContext {
  orderingMode: OrderingMode;
  requireStaffConfirmation: boolean;
  /** Czy płatność została potwierdzona webhookiem operatora (tryb prepaid). */
  paymentConfirmed: boolean;
  /** Zamówienie wprowadzone przez kelnera stojącego przy stoliku. */
  placedByStaff: boolean;
  /** Rachunek wizyty przekroczył `open_bill_limit_cents`. */
  openBillLimitExceeded: boolean;
}

/**
 * Status, w jakim ląduje właśnie złożone zamówienie.
 *
 * Bramką do kuchni jest `confirmed` — i to jest jedyne miejsce, w którym
 * decyduje się, czy zamówienie ją przekroczy od razu. W trybie `prepaid`
 * warunkiem jest potwierdzenie płatności webhookiem operatora, nigdy odpowiedź
 * klienta, którą da się sfałszować.
 */
export function statusAfterSubmission(context: SubmissionContext): OrderStatus {
  const {
    orderingMode,
    requireStaffConfirmation,
    paymentConfirmed,
    placedByStaff,
    openBillLimitExceeded,
  } = context;

  if (orderingMode === 'prepaid' && !paymentConfirmed) {
    return 'submitted';
  }

  // Kelner stoi przy stoliku, więc zamówienie jest już potwierdzone fizycznie.
  // Limit otwartego rachunku go nie dotyczy — obsługa widzi rachunek.
  if (placedByStaff) {
    return 'confirmed';
  }

  if (requireStaffConfirmation || openBillLimitExceeded) {
    return 'awaiting_confirmation';
  }

  return 'confirmed';
}
