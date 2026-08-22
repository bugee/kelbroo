-- CreateEnum
CREATE TYPE "CounterScope" AS ENUM ('order', 'table_session');

-- DropIndex
DROP INDEX "order_restaurant_id_order_number_created_at_key";

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "business_date" DATE NOT NULL;

-- AlterTable
ALTER TABLE "restaurant" ADD COLUMN     "business_day_start_hour" INTEGER NOT NULL DEFAULT 4;

-- AlterTable
ALTER TABLE "table_session" ADD COLUMN     "business_date" DATE NOT NULL;

-- CreateTable
CREATE TABLE "daily_counter" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "scope" "CounterScope" NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_counter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_counter_organization_id_idx" ON "daily_counter"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_counter_restaurant_id_business_date_scope_key" ON "daily_counter"("restaurant_id", "business_date", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "order_restaurant_id_business_date_order_number_key" ON "order"("restaurant_id", "business_date", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "table_session_restaurant_id_business_date_session_number_key" ON "table_session"("restaurant_id", "business_date", "session_number");

-- AddForeignKey
ALTER TABLE "daily_counter" ADD CONSTRAINT "daily_counter_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- --------------------------------------------------------------------------
-- RLS dla nowej tabeli.
--
-- Prisma generuje wyłącznie DDL schematu — polityk bezpieczeństwa nie zna.
-- Każda nowa tabela z kolumną organization_id wymaga tych dwóch instrukcji,
-- inaczej wypada z izolacji tenantów. Pilnuje tego test w
-- apps/api/test/rls.spec.ts, który przechodzi po katalogu systemowym i
-- porównuje listę tabel tenanta z listą tabel objętych RLS.
-- --------------------------------------------------------------------------

ALTER TABLE public.daily_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.daily_counter
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());

-- Formalnie zbędne (obejmuje ją ALTER DEFAULT PRIVILEGES z migracji RLS),
-- ale zapisane wprost, żeby uprawnienia tabeli dało się przeczytać w jednym
-- miejscu.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_counter TO kelbroo_app;
