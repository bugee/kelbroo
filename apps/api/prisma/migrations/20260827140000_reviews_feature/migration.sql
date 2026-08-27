-- Oceny gości jako funkcja planu Pro i wyższych.
--
-- Kolumna, a nie wyliczanie z `plan`: zaplecze ma móc włączyć oceny lokalowi
-- na Starterze — na przykład na czas rozmowy o przejściu na Pro — bez ruszania
-- jego abonamentu. Zmiana planu taki wyjątek kasuje.
ALTER TABLE public."subscription"
  ADD COLUMN "reviews_enabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE public."subscription"
   SET "reviews_enabled" = true
 WHERE "plan" IN ('pro', 'enterprise');
