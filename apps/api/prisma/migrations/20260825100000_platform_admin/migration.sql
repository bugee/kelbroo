-- Konta zaplecza kelbroo (System 4).
CREATE TABLE "platform_admin" (
  "id"            UUID PRIMARY KEY,
  "email"         TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "last_login_at" TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "platform_admin_email_key" ON "platform_admin" ("email");

-- Tabela nie ma `organization_id`, więc nie obejmuje jej polityka izolacji
-- najemców — i nie ma czym jej objąć: to konta spoza jakiejkolwiek organizacji.
--
-- Uprawnienia odbieramy roli aplikacyjnej jawnie. `ALTER DEFAULT PRIVILEGES`
-- z migracji RLS nadaje je każdej nowej tabeli, a akurat ta zawiera skróty haseł
-- do zaplecza całej platformy. Ruch gościa i panelu obsługuje rola pod RLS —
-- niech nie ma tam nawet prawa odczytu.
REVOKE ALL ON public."platform_admin" FROM kelbroo_app;
