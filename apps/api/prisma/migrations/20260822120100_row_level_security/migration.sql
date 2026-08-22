-- Multi-tenancy wymuszone w bazie, nie tylko w kodzie aplikacji.
-- docs/architecture.md §3 i §8.
--
-- Model ról:
--   kelbroo       — właściciel schematu (superuser). Migracje i seed. Omija RLS.
--   kelbroo_app   — rola aplikacyjna używana przez API w czasie działania.
--                   Podlega RLS; bez ustawionego kontekstu tenanta nie widzi
--                   ani jednego wiersza.
--
-- Kontekst tenanta ustawia API na początku każdego żądania, w tej samej
-- transakcji co zapytania:
--   SET LOCAL app.current_organization_id = '<uuid z JWT>';

CREATE SCHEMA IF NOT EXISTS app;

-- Brak ustawionego kontekstu → NULL → polityka nie przepuszcza żadnego wiersza.
-- To celowe: błąd w kodzie kończy się pustym wynikiem, nie wyciekiem danych.
CREATE OR REPLACE FUNCTION app.current_organization_id() RETURNS uuid
  LANGUAGE sql
  STABLE
  PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', true), '')::uuid
$$;

GRANT USAGE ON SCHEMA app TO PUBLIC;

-- --------------------------------------------------------------------------
-- Włączenie RLS i polityka izolacji na każdej tabeli z danymi klienta.
-- --------------------------------------------------------------------------

DO $$
DECLARE
  target text;
  tenant_tables text[] := ARRAY[
    'subscription',
    'restaurant',
    'staff_member',
    'restaurant_table',
    'menu_category',
    'menu_category_translation',
    'menu_item',
    'menu_item_translation',
    'menu_item_modifier_group',
    'menu_item_modifier_group_translation',
    'menu_item_modifier',
    'menu_item_modifier_translation',
    'table_session',
    'guest_session',
    'table_participant',
    'settlement_group',
    'order',
    'order_item',
    'order_item_share',
    'order_event',
    'payment',
    'review',
    'waiter_call',
    'audit_log'
  ];
BEGIN
  FOREACH target IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I
         USING (organization_id = app.current_organization_id())
         WITH CHECK (organization_id = app.current_organization_id())',
      target
    );
  END LOOP;
END
$$;

-- Organizacja nie ma kolumny organization_id — izoluje ją własny klucz główny.
ALTER TABLE public."organization" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public."organization"
  USING (id = app.current_organization_id())
  WITH CHECK (id = app.current_organization_id());

-- --------------------------------------------------------------------------
-- Uprawnienia roli aplikacyjnej.
-- Rola musi istnieć wcześniej (docker/postgres/init.sql lokalnie, provisioning
-- infrastruktury na staging/production).
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kelbroo_app') THEN
    RAISE EXCEPTION
      'Rola kelbroo_app nie istnieje. Utwórz ją przed migracją — patrz docker/postgres/init.sql.';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO kelbroo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kelbroo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kelbroo_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kelbroo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kelbroo_app;

-- OrderEvent jest append-only i jest źródłem prawdy o historii zamówienia.
-- Wymuszamy to uprawnieniami, nie tylko dyscypliną w kodzie: aplikacja może
-- dopisywać i czytać zdarzenia, ale nie może ich zmienić ani usunąć.
REVOKE UPDATE, DELETE ON public.order_event FROM kelbroo_app;

-- Tabela migracji Prismy nie jest danymi klienta — rola aplikacyjna jej nie
-- potrzebuje. Objął ją GRANT ... ON ALL TABLES powyżej, więc odbieramy jawnie.
--
-- Warunek jest konieczny: w shadow database, na której Prisma weryfikuje
-- migracje, ta tabela jeszcze nie istnieje i bezwarunkowy REVOKE wywraca
-- `prisma migrate dev` błędem P3006.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = '_prisma_migrations'
  ) THEN
    EXECUTE 'REVOKE ALL ON public."_prisma_migrations" FROM kelbroo_app';
  END IF;
END
$$;
