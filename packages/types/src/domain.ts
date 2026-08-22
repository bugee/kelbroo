/**
 * Kontrakty domenowe współdzielone przez API i wszystkie klienty.
 *
 * Źródło prawdy: docs/architecture.md §4 (model danych) i §6 (maszyna stanów).
 * Wartości muszą się zgadzać z enumami Prismy w apps/api/prisma/schema.prisma.
 */

/** Tryb zamawiania wybierany przez restaurację (Restaurant.ordering_mode). */
export const ORDERING_MODES = ['prepaid', 'pay_at_table', 'guest_choice'] as const;
export type OrderingMode = (typeof ORDERING_MODES)[number];

/**
 * Realizacja zamówienia. Bramką do kuchni jest `confirmed` — KDS nigdy nie
 * widzi zamówień przed tym stanem.
 */
export const ORDER_STATUSES = [
  'submitted',
  'awaiting_confirmation',
  'confirmed',
  'preparing',
  'ready',
  'served',
  'closed',
  'rejected',
  'canceled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Rozliczenie zamówienia — cykl życia niezależny od `OrderStatus`. */
export const PAYMENT_STATUSES = [
  'not_required',
  'awaiting_payment',
  'paid',
  'awaiting_settlement',
  'settled',
  'failed',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Status pojedynczej pozycji na bonie kuchennym. */
export const ORDER_ITEM_STATUSES = ['queued', 'preparing', 'ready', 'served', 'canceled'] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

/** Wizyta przy stoliku — jednostka rachunku. */
export const TABLE_SESSION_STATUSES = [
  'open',
  'awaiting_settlement',
  'settled',
  'closed',
  'abandoned',
] as const;
export type TableSessionStatus = (typeof TABLE_SESSION_STATUSES)[number];

/** Podział rachunku jest funkcją wizyty, nie zamówienia. */
export const SPLIT_MODES = ['none', 'per_person', 'per_item', 'equal', 'groups'] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

export const SETTLEMENT_GROUP_STATUSES = ['open', 'awaiting_payment', 'paid', 'settled'] as const;
export type SettlementGroupStatus = (typeof SETTLEMENT_GROUP_STATUSES)[number];

/** Role personelu (RBAC): owner > manager > waiter/kitchen. */
export const STAFF_ROLES = ['owner', 'manager', 'waiter', 'kitchen'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ACTOR_TYPES = ['guest', 'staff', 'system'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/** Typy zdarzeń w append-only historii zamówienia (`OrderEvent`). */
export const ORDER_EVENT_TYPES = [
  'created',
  'item_added',
  'item_removed',
  'quantity_changed',
  'modifier_changed',
  'note_changed',
  'item_reassigned',
  'confirmed',
  'rejected',
  'status_changed',
  'discount_applied',
  'canceled',
] as const;
export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];

export const WAITER_CALL_REASONS = ['help', 'bill', 'water', 'other'] as const;
export type WaiterCallReason = (typeof WAITER_CALL_REASONS)[number];

export const WAITER_CALL_STATUSES = ['open', 'acknowledged', 'resolved'] as const;
export type WaiterCallStatus = (typeof WAITER_CALL_STATUSES)[number];

export const REVIEW_TARGETS = ['dish', 'kitchen', 'service', 'manager'] as const;
export type ReviewTarget = (typeof REVIEW_TARGETS)[number];

export const SUBSCRIPTION_PLANS = ['menu', 'starter', 'pro', 'enterprise'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'canceled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Abstrakcja od pierwszej linii kodu, nawet gdy jedyną implementacją jest Noop
 * (docs/architecture.md §12).
 */
export const FISCALIZATION_MODES = ['none', 'pos_bridge', 'cloud_register'] as const;
export type FiscalizationMode = (typeof FISCALIZATION_MODES)[number];

export const PAYMENT_PROVIDERS = ['stripe', 'przelewy24', 'offline'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_METHODS = [
  'blik',
  'card',
  'apple_pay',
  'google_pay',
  'cash',
  'card_terminal',
  'voucher',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Stany, po osiągnięciu których zamówienie jest widoczne dla kuchni.
 * Jedno miejsce, w którym ta reguła jest zapisana — KDS i API filtrują tym samym.
 */
export const KITCHEN_VISIBLE_STATUSES: readonly OrderStatus[] = [
  'confirmed',
  'preparing',
  'ready',
] as const;

export function isVisibleToKitchen(status: OrderStatus): boolean {
  return KITCHEN_VISIBLE_STATUSES.includes(status);
}
