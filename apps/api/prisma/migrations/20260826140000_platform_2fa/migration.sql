-- Drugi składnik logowania do zaplecza: kod na adres e-mail administratora.
CREATE TABLE "platform_login_challenge" (
  "id"         UUID PRIMARY KEY,
  "admin_id"   UUID NOT NULL,
  "code_hash"  TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "attempts"   INTEGER NOT NULL DEFAULT 0,
  "used_at"    TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Skasowanie konta zabiera ze sobą jego niedokończone próby logowania.
  CONSTRAINT "platform_login_challenge_admin_fkey" FOREIGN KEY ("admin_id")
    REFERENCES public."platform_admin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "platform_login_challenge_expires" ON "platform_login_challenge" ("expires_at");

-- Jak pozostałe tabele zaplecza: to nie są dane najemcy, a rola aplikacyjna
-- pod RLS nie ma powodu ich widzieć. `ALTER DEFAULT PRIVILEGES` z migracji RLS
-- nadaje uprawnienia każdej nowej tabeli, więc odbieramy je jawnie.
REVOKE ALL ON public."platform_login_challenge" FROM kelbroo_app;
