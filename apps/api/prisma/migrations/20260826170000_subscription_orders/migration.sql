-- Zakup abonamentu: dane do faktury i ewidencja płatności.

-- --------------------------------------------------------------------------
-- Dane nabywcy.
-- Sprzedaż jest B2B, więc faktura VAT jest obowiązkowa, a na fakturze musi stać
-- adres. Rejestracja zbiera tylko nazwę, NIP i e-mail — resztę dopisujemy przy
-- pierwszym zakupie, żeby nie wydłużać formularza, którym wchodzi się na trial.
-- --------------------------------------------------------------------------

ALTER TABLE public."organization"
  ADD COLUMN "billing_address"     TEXT,
  ADD COLUMN "billing_postal_code" TEXT,
  ADD COLUMN "billing_city"        TEXT,
  ADD COLUMN "billing_country"     TEXT NOT NULL DEFAULT 'PL';

-- --------------------------------------------------------------------------
-- Zamówienia abonamentu.
-- --------------------------------------------------------------------------

CREATE TYPE "SubscriptionOrderStatus" AS ENUM ('new', 'pending', 'completed', 'canceled');

CREATE TABLE public."subscription_order" (
  "id"              UUID PRIMARY KEY,
  "organization_id" UUID NOT NULL,
  "plan"            "SubscriptionPlan" NOT NULL,
  "period"          TEXT NOT NULL,
  "net_cents"       INTEGER NOT NULL,
  "vat_cents"       INTEGER NOT NULL,
  "gross_cents"     INTEGER NOT NULL,
  "currency"        CHAR(3) NOT NULL DEFAULT 'PLN',
  "status"          "SubscriptionOrderStatus" NOT NULL DEFAULT 'new',
  "external_id"     TEXT NOT NULL,
  "payu_order_id"   TEXT,
  "paid_until"      TIMESTAMP(3),
  "paid_at"         TIMESTAMP(3),
  "initiated_by_staff_id" UUID,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "subscription_order_organization_fkey" FOREIGN KEY ("organization_id")
    REFERENCES public."organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,

  -- Kwoty muszą się zgadzać na poziomie bazy, nie tylko w kodzie: za tym
  -- wierszem stoi faktura, a błąd arytmetyczny wychodzi dopiero u księgowej.
  CONSTRAINT "subscription_order_amounts" CHECK (
    "net_cents" >= 0 AND "vat_cents" >= 0 AND "gross_cents" = "net_cents" + "vat_cents"
  ),
  CONSTRAINT "subscription_order_period" CHECK ("period" IN ('month', 'year'))
);

CREATE UNIQUE INDEX "subscription_order_external_id_key"
  ON public."subscription_order" ("external_id");

CREATE INDEX "subscription_order_organization_id_created_at_idx"
  ON public."subscription_order" ("organization_id", "created_at");

-- --------------------------------------------------------------------------
-- Izolacja najemców.
-- Każda nowa tabela z kolumną organization_id wymaga tych dwóch instrukcji,
-- inaczej wypada z izolacji — pilnuje tego test w apps/api/test/rls.spec.ts.
-- --------------------------------------------------------------------------

ALTER TABLE public."subscription_order" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public."subscription_order"
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());
