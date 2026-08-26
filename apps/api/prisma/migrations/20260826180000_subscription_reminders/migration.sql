-- Przypomnienia o kończącym się okresie abonamentowym.

CREATE TYPE "SubscriptionReminderKind" AS ENUM ('before', 'expired', 'winback');

CREATE TABLE public."subscription_reminder" (
  "id"              UUID PRIMARY KEY,
  "organization_id" UUID NOT NULL,
  "kind"            "SubscriptionReminderKind" NOT NULL,
  "period_end"      TIMESTAMP(3) NOT NULL,
  "sent_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "subscription_reminder_organization_fkey" FOREIGN KEY ("organization_id")
    REFERENCES public."organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Sedno idempotencji: jedno przypomnienie danego rodzaju na jeden okres.
-- Klucz obejmuje datę końca okresu, więc po opłaceniu — gdy termin się przesuwa —
-- trójka przypomnień ma prawo wysłać się od nowa. Warunek w kodzie nie dałby tej
-- gwarancji przy dwóch instancjach API pytających bazę równocześnie.
CREATE UNIQUE INDEX "subscription_reminder_organization_id_kind_period_end_key"
  ON public."subscription_reminder" ("organization_id", "kind", "period_end");

-- --------------------------------------------------------------------------
-- Izolacja najemców.
-- Każda nowa tabela z kolumną organization_id wymaga tych dwóch instrukcji,
-- inaczej wypada z izolacji — pilnuje tego test w apps/api/test/rls.spec.ts.
-- --------------------------------------------------------------------------

ALTER TABLE public."subscription_reminder" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public."subscription_reminder"
  USING (organization_id = app.current_organization_id())
  WITH CHECK (organization_id = app.current_organization_id());
