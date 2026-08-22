-- Wejście po skanie QR jest z definicji bez kontekstu tenanta: z tokenu trzeba
-- dopiero ustalić, o którą organizację chodzi. RLS na tym etapie nie przepuszcza
-- niczego — i tak ma być.
--
-- Rozwiązaniem nie jest osłabienie polityki na restaurant_table ani sięganie
-- superuserem z aplikacji, tylko dwie wąskie funkcje SECURITY DEFINER: jedyne
-- miejsce, w którym rola aplikacyjna widzi coś poza swoim tenantem, zwracające
-- wyłącznie identyfikatory i wyłącznie dla aktywnych rekordów.
--
-- SET search_path jest tu obowiązkowy — bez niego SECURITY DEFINER daje się
-- przejąć podstawionym schematem.

CREATE FUNCTION app.resolve_qr_token(p_token text)
  RETURNS TABLE (organization_id uuid, restaurant_id uuid, table_id uuid)
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public, pg_temp
AS $$
  SELECT t.organization_id, t.restaurant_id, t.id
  FROM public.restaurant_table t
  WHERE t.qr_token = p_token
    AND t.is_active
$$;

REVOKE ALL ON FUNCTION app.resolve_qr_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.resolve_qr_token(text) TO kelbroo_app;

CREATE FUNCTION app.resolve_guest_session(p_token_hash text)
  RETURNS TABLE (organization_id uuid, guest_session_id uuid)
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public, pg_temp
AS $$
  SELECT g.organization_id, g.id
  FROM public.guest_session g
  WHERE g.token_hash = p_token_hash
    AND g.expires_at > now()
$$;

REVOKE ALL ON FUNCTION app.resolve_guest_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.resolve_guest_session(text) TO kelbroo_app;
