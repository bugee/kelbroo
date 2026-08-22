import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, isVisibleToKitchen, type OrderStatus } from '../src/domain.js';
import {
  allowedTransitions,
  assertTransition,
  canTransition,
  cancellationRequiresManager,
  isTerminal,
  OrderTransitionError,
  statusAfterSubmission,
  type SubmissionContext,
} from '../src/order-status.js';

const submission = (overrides: Partial<SubmissionContext> = {}): SubmissionContext => ({
  orderingMode: 'pay_at_table',
  requireStaffConfirmation: false,
  paymentConfirmed: false,
  placedByStaff: false,
  openBillLimitExceeded: false,
  ...overrides,
});

describe('przejścia statusów', () => {
  it('przepuszcza pełną ścieżkę realizacji', () => {
    const path: OrderStatus[] = [
      'awaiting_confirmation',
      'confirmed',
      'preparing',
      'ready',
      'served',
      'closed',
    ];
    let current: OrderStatus = 'submitted';
    for (const next of path) {
      expect(canTransition(current, next)).toBe(true);
      current = next;
    }
  });

  it('nie pozwala ominąć bramki do kuchni', () => {
    expect(canTransition('submitted', 'preparing')).toBe(false);
    expect(canTransition('awaiting_confirmation', 'preparing')).toBe(false);
    expect(canTransition('submitted', 'ready')).toBe(false);
  });

  it('nie pozwala cofnąć zamówienia', () => {
    expect(canTransition('ready', 'preparing')).toBe(false);
    expect(canTransition('served', 'ready')).toBe(false);
    expect(canTransition('confirmed', 'submitted')).toBe(false);
  });

  it('statusy końcowe nie mają wyjścia', () => {
    for (const status of ['closed', 'rejected', 'canceled'] as const) {
      expect(isTerminal(status)).toBe(true);
      expect(allowedTransitions(status)).toEqual([]);
    }
  });

  it('odrzucenie jest możliwe wyłącznie z kolejki potwierdzeń', () => {
    const rejectable = ORDER_STATUSES.filter((status) => canTransition(status, 'rejected'));
    expect(rejectable).toEqual(['awaiting_confirmation']);
  });

  it('assertTransition rzuca opisowym błędem', () => {
    expect(() => assertTransition('closed', 'preparing')).toThrow(OrderTransitionError);
    expect(() => assertTransition('closed', 'preparing')).toThrow(/closed → preparing/);
  });

  it('anulowanie po starcie kuchni wymaga managera', () => {
    expect(cancellationRequiresManager('confirmed')).toBe(false);
    expect(cancellationRequiresManager('preparing')).toBe(true);
    expect(cancellationRequiresManager('ready')).toBe(true);
  });

  it('kuchnia widzi wyłącznie zamówienia za bramką', () => {
    const visible = ORDER_STATUSES.filter(isVisibleToKitchen);
    expect(visible).toEqual(['confirmed', 'preparing', 'ready']);
    expect(isVisibleToKitchen('submitted')).toBe(false);
    expect(isVisibleToKitchen('awaiting_confirmation')).toBe(false);
  });
});

describe('status po złożeniu zamówienia', () => {
  it('prepaid czeka na webhook, nie na odpowiedź klienta', () => {
    expect(statusAfterSubmission(submission({ orderingMode: 'prepaid' }))).toBe('submitted');
    expect(
      statusAfterSubmission(submission({ orderingMode: 'prepaid', paymentConfirmed: true })),
    ).toBe('confirmed');
  });

  it('prepaid z potwierdzoną płatnością nadal respektuje wymóg potwierdzenia obsługi', () => {
    expect(
      statusAfterSubmission(
        submission({
          orderingMode: 'prepaid',
          paymentConfirmed: true,
          requireStaffConfirmation: true,
        }),
      ),
    ).toBe('awaiting_confirmation');
  });

  it('pay_at_table domyślnie czeka na kelnera', () => {
    expect(statusAfterSubmission(submission({ requireStaffConfirmation: true }))).toBe(
      'awaiting_confirmation',
    );
  });

  it('pay_at_table bez wymogu potwierdzenia idzie prosto do kuchni', () => {
    expect(statusAfterSubmission(submission())).toBe('confirmed');
  });

  it('przekroczony limit otwartego rachunku wymusza potwierdzenie', () => {
    expect(statusAfterSubmission(submission({ openBillLimitExceeded: true }))).toBe(
      'awaiting_confirmation',
    );
  });

  it('zamówienie kelnera omija kolejkę potwierdzeń', () => {
    expect(
      statusAfterSubmission(
        submission({
          placedByStaff: true,
          requireStaffConfirmation: true,
          openBillLimitExceeded: true,
        }),
      ),
    ).toBe('confirmed');
  });
});
