-- Blokada administracyjna i dziennik działań zaplecza.

-- Stan osobny od wygaśnięcia abonamentu: wygaśnięcie dzieje się samo i mija
-- po opłaceniu, blokada jest decyzją człowieka i tylko człowiek ją zdejmuje.
ALTER TABLE "organization"
  ADD COLUMN "blocked_at"     TIMESTAMP(3),
  ADD COLUMN "blocked_reason" TEXT;

CREATE TABLE "platform_audit_log" (
  "id"              UUID PRIMARY KEY,
  "admin_id"        UUID NOT NULL,
  "organization_id" UUID,
  "action"          TEXT NOT NULL,
  "reason"          TEXT,
  "payload"         JSONB,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "platform_audit_log_org_created" ON "platform_audit_log" ("organization_id", "created_at");

-- Jak `platform_admin`: to nie są dane klienta i rola aplikacyjna pod RLS
-- nie ma po co ich widzieć. `ALTER DEFAULT PRIVILEGES` z migracji RLS nadaje
-- uprawnienia każdej nowej tabeli, więc odbieramy je jawnie.
REVOKE ALL ON public."platform_audit_log" FROM kelbroo_app;
