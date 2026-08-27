-- Zdjęcia dań: funkcja włączana planem, z możliwością ręcznego włączenia.
--
-- Kolumna, a nie wyliczanie z `plan`: zaplecze ma móc włączyć zdjęcia
-- pojedynczemu klientowi na Starterze — na przykład na czas rozmowy o przejściu
-- na Pro — bez ruszania jego abonamentu.
ALTER TABLE public."subscription"
  ADD COLUMN "menu_photos_enabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE public."subscription"
   SET "menu_photos_enabled" = true
 WHERE "plan" IN ('pro', 'enterprise');
