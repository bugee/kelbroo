-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrderingMode" AS ENUM ('prepaid', 'pay_at_table', 'guest_choice');

-- CreateEnum
CREATE TYPE "FiscalizationMode" AS ENUM ('none', 'pos_bridge', 'cloud_register');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('menu', 'starter', 'pro', 'enterprise');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('owner', 'manager', 'waiter', 'kitchen');

-- CreateEnum
CREATE TYPE "TableSessionStatus" AS ENUM ('open', 'awaiting_settlement', 'settled', 'closed', 'abandoned');

-- CreateEnum
CREATE TYPE "SplitMode" AS ENUM ('none', 'per_person', 'per_item', 'equal', 'groups');

-- CreateEnum
CREATE TYPE "SettlementGroupStatus" AS ENUM ('open', 'awaiting_payment', 'paid', 'settled');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('submitted', 'awaiting_confirmation', 'confirmed', 'preparing', 'ready', 'served', 'closed', 'rejected', 'canceled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('not_required', 'awaiting_payment', 'paid', 'awaiting_settlement', 'settled', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('queued', 'preparing', 'ready', 'served', 'canceled');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('guest', 'staff', 'system');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('created', 'item_added', 'item_removed', 'quantity_changed', 'modifier_changed', 'note_changed', 'item_reassigned', 'confirmed', 'rejected', 'status_changed', 'discount_applied', 'canceled');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('stripe', 'przelewy24', 'offline');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('blik', 'card', 'apple_pay', 'google_pay', 'cash', 'card_terminal', 'voucher');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "ReviewTarget" AS ENUM ('dish', 'kitchen', 'service', 'manager');

-- CreateEnum
CREATE TYPE "WaiterCallReason" AS ENUM ('help', 'bill', 'water', 'other');

-- CreateEnum
CREATE TYPE "WaiterCallStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- CreateTable
CREATE TABLE "organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nip" TEXT,
    "billing_email" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "stripe_subscription_id" TEXT,
    "current_period_end" TIMESTAMP(3),
    "table_limit" INTEGER NOT NULL,
    "language_limit" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Warsaw',
    "currency" CHAR(3) NOT NULL DEFAULT 'PLN',
    "default_locale" TEXT NOT NULL DEFAULT 'pl',
    "supported_locales" TEXT[] DEFAULT ARRAY['pl']::TEXT[],
    "logo_url" TEXT,
    "theme" JSONB,
    "opening_hours" JSONB,
    "ordering_mode" "OrderingMode" NOT NULL DEFAULT 'pay_at_table',
    "require_staff_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "table_activation_required" BOOLEAN NOT NULL DEFAULT false,
    "tipping_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tip_presets" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "min_order_cents" INTEGER NOT NULL DEFAULT 0,
    "open_bill_limit_cents" INTEGER,
    "fiscalization_mode" "FiscalizationMode" NOT NULL DEFAULT 'none',
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_member" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "restaurant_id" UUID,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_table" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "zone" TEXT,
    "seats" INTEGER,
    "qr_token" TEXT NOT NULL,
    "qr_version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_category" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "available_hours" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_category_translation" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "menu_category_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "sku" TEXT,
    "price_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "vat_rate" DECIMAL(5,4) NOT NULL,
    "image_url" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dietary_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "calories" INTEGER,
    "prep_time_minutes" INTEGER,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_translation" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "menu_item_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_modifier_group" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "min_select" INTEGER NOT NULL DEFAULT 0,
    "max_select" INTEGER NOT NULL DEFAULT 1,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_item_modifier_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_modifier_group_translation" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "menu_item_modifier_group_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_modifier" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "price_delta_cents" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_item_modifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_modifier_translation" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "modifier_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "menu_item_modifier_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_session" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "session_number" INTEGER NOT NULL,
    "status" "TableSessionStatus" NOT NULL DEFAULT 'open',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened_by" "ActorType" NOT NULL,
    "opened_by_staff_id" UUID,
    "closed_at" TIMESTAMP(3),
    "closed_by_staff_id" UUID,
    "split_mode" "SplitMode" NOT NULL DEFAULT 'none',
    "subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "tip_cents" INTEGER NOT NULL DEFAULT 0,
    "vat_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "paid_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "guest_count" INTEGER,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_session" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "table_session_id" UUID NOT NULL,
    "participant_id" UUID,
    "token_hash" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_participant" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "table_session_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_key" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "is_host" BOOLEAN NOT NULL DEFAULT false,
    "created_by" "ActorType" NOT NULL,
    "created_by_staff_id" UUID,
    "settlement_group_id" UUID,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "table_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_group" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "table_session_id" UUID NOT NULL,
    "label" TEXT,
    "status" "SettlementGroupStatus" NOT NULL DEFAULT 'open',
    "subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "tip_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "payer_participant_id" UUID,
    "created_by" "ActorType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlement_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "table_session_id" UUID NOT NULL,
    "guest_session_id" UUID,
    "order_number" INTEGER NOT NULL,
    "source" "ActorType" NOT NULL,
    "created_by_participant_id" UUID,
    "created_by_staff_id" UUID,
    "status" "OrderStatus" NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL,
    "subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "tip_cents" INTEGER NOT NULL DEFAULT 0,
    "vat_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "guest_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by_staff_id" UUID,
    "ready_at" TIMESTAMP(3),
    "served_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "menu_item_id" UUID,
    "name_snapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "modifiers_snapshot" JSONB NOT NULL DEFAULT '[]',
    "item_note" TEXT,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'queued',
    "for_participant_id" UUID,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "added_by" "ActorType" NOT NULL,
    "added_by_participant_id" UUID,
    "added_by_staff_id" UUID,
    "last_edited_by" "ActorType",
    "last_edited_by_staff_id" UUID,
    "last_edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_share" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "share_units" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,

    CONSTRAINT "order_item_share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_event" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_item_id" UUID,
    "type" "OrderEventType" NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_participant_id" UUID,
    "actor_guest_session_id" UUID,
    "actor_staff_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "table_session_id" UUID NOT NULL,
    "settlement_group_id" UUID,
    "order_id" UUID,
    "provider" "PaymentProvider" NOT NULL,
    "provider_payment_id" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentState" NOT NULL DEFAULT 'pending',
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "collected_by_staff_id" UUID,
    "receipt_url" TEXT,
    "fiscal_receipt_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "table_session_id" UUID,
    "order_id" UUID,
    "menu_item_id" UUID,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "target" "ReviewTarget" NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waiter_call" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "table_id" UUID NOT NULL,
    "table_session_id" UUID,
    "guest_session_id" UUID,
    "reason" "WaiterCallReason" NOT NULL,
    "status" "WaiterCallStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_by_staff_id" UUID,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "waiter_call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_staff_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" UUID,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_stripe_customer_id_key" ON "organization"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_organization_id_key" ON "subscription"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_stripe_subscription_id_key" ON "subscription"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_slug_key" ON "restaurant"("slug");

-- CreateIndex
CREATE INDEX "restaurant_organization_id_idx" ON "restaurant"("organization_id");

-- CreateIndex
CREATE INDEX "staff_member_restaurant_id_idx" ON "staff_member"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_member_organization_id_email_key" ON "staff_member"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_table_qr_token_key" ON "restaurant_table"("qr_token");

-- CreateIndex
CREATE INDEX "restaurant_table_organization_id_idx" ON "restaurant_table"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_table_restaurant_id_label_key" ON "restaurant_table"("restaurant_id", "label");

-- CreateIndex
CREATE INDEX "menu_category_restaurant_id_sort_order_idx" ON "menu_category"("restaurant_id", "sort_order");

-- CreateIndex
CREATE INDEX "menu_category_organization_id_idx" ON "menu_category"("organization_id");

-- CreateIndex
CREATE INDEX "menu_category_translation_organization_id_idx" ON "menu_category_translation"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_category_translation_category_id_locale_key" ON "menu_category_translation"("category_id", "locale");

-- CreateIndex
CREATE INDEX "menu_item_restaurant_id_category_id_sort_order_idx" ON "menu_item"("restaurant_id", "category_id", "sort_order");

-- CreateIndex
CREATE INDEX "menu_item_organization_id_idx" ON "menu_item"("organization_id");

-- CreateIndex
CREATE INDEX "menu_item_translation_organization_id_idx" ON "menu_item_translation"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_translation_menu_item_id_locale_key" ON "menu_item_translation"("menu_item_id", "locale");

-- CreateIndex
CREATE INDEX "menu_item_modifier_group_menu_item_id_sort_order_idx" ON "menu_item_modifier_group"("menu_item_id", "sort_order");

-- CreateIndex
CREATE INDEX "menu_item_modifier_group_organization_id_idx" ON "menu_item_modifier_group"("organization_id");

-- CreateIndex
CREATE INDEX "menu_item_modifier_group_translation_organization_id_idx" ON "menu_item_modifier_group_translation"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_modifier_group_translation_group_id_locale_key" ON "menu_item_modifier_group_translation"("group_id", "locale");

-- CreateIndex
CREATE INDEX "menu_item_modifier_group_id_sort_order_idx" ON "menu_item_modifier"("group_id", "sort_order");

-- CreateIndex
CREATE INDEX "menu_item_modifier_organization_id_idx" ON "menu_item_modifier"("organization_id");

-- CreateIndex
CREATE INDEX "menu_item_modifier_translation_organization_id_idx" ON "menu_item_modifier_translation"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_modifier_translation_modifier_id_locale_key" ON "menu_item_modifier_translation"("modifier_id", "locale");

-- CreateIndex
CREATE INDEX "table_session_restaurant_id_status_idx" ON "table_session"("restaurant_id", "status");

-- CreateIndex
CREATE INDEX "table_session_table_id_status_idx" ON "table_session"("table_id", "status");

-- CreateIndex
CREATE INDEX "table_session_organization_id_idx" ON "table_session"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_session_participant_id_key" ON "guest_session"("participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_session_token_hash_key" ON "guest_session"("token_hash");

-- CreateIndex
CREATE INDEX "guest_session_table_session_id_idx" ON "guest_session"("table_session_id");

-- CreateIndex
CREATE INDEX "guest_session_organization_id_idx" ON "guest_session"("organization_id");

-- CreateIndex
CREATE INDEX "table_participant_table_session_id_idx" ON "table_participant"("table_session_id");

-- CreateIndex
CREATE INDEX "table_participant_organization_id_idx" ON "table_participant"("organization_id");

-- CreateIndex
CREATE INDEX "settlement_group_table_session_id_idx" ON "settlement_group"("table_session_id");

-- CreateIndex
CREATE INDEX "settlement_group_organization_id_idx" ON "settlement_group"("organization_id");

-- CreateIndex
CREATE INDEX "order_restaurant_id_status_idx" ON "order"("restaurant_id", "status");

-- CreateIndex
CREATE INDEX "order_table_session_id_idx" ON "order"("table_session_id");

-- CreateIndex
CREATE INDEX "order_organization_id_idx" ON "order"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_restaurant_id_order_number_created_at_key" ON "order"("restaurant_id", "order_number", "created_at");

-- CreateIndex
CREATE INDEX "order_item_order_id_idx" ON "order_item"("order_id");

-- CreateIndex
CREATE INDEX "order_item_for_participant_id_idx" ON "order_item"("for_participant_id");

-- CreateIndex
CREATE INDEX "order_item_organization_id_idx" ON "order_item"("organization_id");

-- CreateIndex
CREATE INDEX "order_item_share_organization_id_idx" ON "order_item_share"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_item_share_order_item_id_participant_id_key" ON "order_item_share"("order_item_id", "participant_id");

-- CreateIndex
CREATE INDEX "order_event_order_id_created_at_idx" ON "order_event"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_event_organization_id_idx" ON "order_event"("organization_id");

-- CreateIndex
CREATE INDEX "payment_table_session_id_idx" ON "payment"("table_session_id");

-- CreateIndex
CREATE INDEX "payment_organization_id_idx" ON "payment"("organization_id");

-- CreateIndex
CREATE INDEX "review_restaurant_id_created_at_idx" ON "review"("restaurant_id", "created_at");

-- CreateIndex
CREATE INDEX "review_organization_id_idx" ON "review"("organization_id");

-- CreateIndex
CREATE INDEX "waiter_call_restaurant_id_status_idx" ON "waiter_call"("restaurant_id", "status");

-- CreateIndex
CREATE INDEX "waiter_call_organization_id_idx" ON "waiter_call"("organization_id");

-- CreateIndex
CREATE INDEX "audit_log_organization_id_created_at_idx" ON "audit_log"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant" ADD CONSTRAINT "restaurant_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_member" ADD CONSTRAINT "staff_member_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_member" ADD CONSTRAINT "staff_member_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_table" ADD CONSTRAINT "restaurant_table_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_category" ADD CONSTRAINT "menu_category_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_category_translation" ADD CONSTRAINT "menu_category_translation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_translation" ADD CONSTRAINT "menu_item_translation_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_modifier_group" ADD CONSTRAINT "menu_item_modifier_group_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_modifier_group_translation" ADD CONSTRAINT "menu_item_modifier_group_translation_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "menu_item_modifier_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_modifier" ADD CONSTRAINT "menu_item_modifier_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "menu_item_modifier_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_modifier_translation" ADD CONSTRAINT "menu_item_modifier_translation_modifier_id_fkey" FOREIGN KEY ("modifier_id") REFERENCES "menu_item_modifier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_session" ADD CONSTRAINT "table_session_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_session" ADD CONSTRAINT "table_session_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "restaurant_table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_session" ADD CONSTRAINT "table_session_opened_by_staff_id_fkey" FOREIGN KEY ("opened_by_staff_id") REFERENCES "staff_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_session" ADD CONSTRAINT "table_session_closed_by_staff_id_fkey" FOREIGN KEY ("closed_by_staff_id") REFERENCES "staff_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_session" ADD CONSTRAINT "guest_session_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_session" ADD CONSTRAINT "guest_session_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "restaurant_table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_session" ADD CONSTRAINT "guest_session_table_session_id_fkey" FOREIGN KEY ("table_session_id") REFERENCES "table_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_session" ADD CONSTRAINT "guest_session_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "table_participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_participant" ADD CONSTRAINT "table_participant_table_session_id_fkey" FOREIGN KEY ("table_session_id") REFERENCES "table_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_participant" ADD CONSTRAINT "table_participant_created_by_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "staff_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_participant" ADD CONSTRAINT "table_participant_settlement_group_id_fkey" FOREIGN KEY ("settlement_group_id") REFERENCES "settlement_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_group" ADD CONSTRAINT "settlement_group_table_session_id_fkey" FOREIGN KEY ("table_session_id") REFERENCES "table_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_group" ADD CONSTRAINT "settlement_group_payer_participant_id_fkey" FOREIGN KEY ("payer_participant_id") REFERENCES "table_participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "restaurant_table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_table_session_id_fkey" FOREIGN KEY ("table_session_id") REFERENCES "table_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_guest_session_id_fkey" FOREIGN KEY ("guest_session_id") REFERENCES "guest_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_created_by_participant_id_fkey" FOREIGN KEY ("created_by_participant_id") REFERENCES "table_participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_created_by_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "staff_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_confirmed_by_staff_id_fkey" FOREIGN KEY ("confirmed_by_staff_id") REFERENCES "staff_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_for_participant_id_fkey" FOREIGN KEY ("for_participant_id") REFERENCES "table_participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_added_by_participant_id_fkey" FOREIGN KEY ("added_by_participant_id") REFERENCES "table_participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_added_by_staff_id_fkey" FOREIGN KEY ("added_by_staff_id") REFERENCES "staff_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_last_edited_by_staff_id_fkey" FOREIGN KEY ("last_edited_by_staff_id") REFERENCES "staff_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_share" ADD CONSTRAINT "order_item_share_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_share" ADD CONSTRAINT "order_item_share_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "table_participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_actor_participant_id_fkey" FOREIGN KEY ("actor_participant_id") REFERENCES "table_participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_actor_staff_id_fkey" FOREIGN KEY ("actor_staff_id") REFERENCES "staff_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_table_session_id_fkey" FOREIGN KEY ("table_session_id") REFERENCES "table_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_settlement_group_id_fkey" FOREIGN KEY ("settlement_group_id") REFERENCES "settlement_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_collected_by_staff_id_fkey" FOREIGN KEY ("collected_by_staff_id") REFERENCES "staff_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_table_session_id_fkey" FOREIGN KEY ("table_session_id") REFERENCES "table_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "restaurant_table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_table_session_id_fkey" FOREIGN KEY ("table_session_id") REFERENCES "table_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_guest_session_id_fkey" FOREIGN KEY ("guest_session_id") REFERENCES "guest_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_acknowledged_by_staff_id_fkey" FOREIGN KEY ("acknowledged_by_staff_id") REFERENCES "staff_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_staff_id_fkey" FOREIGN KEY ("actor_staff_id") REFERENCES "staff_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

