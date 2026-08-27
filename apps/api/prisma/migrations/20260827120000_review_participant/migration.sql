-- Kto wystawił ocenę.
--
-- Bez tego pola „jedno zgłoszenie na wizytę" znaczyłoby, że przy stoliku na
-- sześć osób oceni wyłącznie pierwsza. Uczestnik jest tożsamością na czas
-- wizyty, nie kontem — i znika razem z nią, dlatego kasowanie ustawia NULL
-- zamiast zabierać ocenę.
ALTER TABLE public."review"
  ADD COLUMN "participant_id" UUID,
  ADD CONSTRAINT "review_participant_fkey" FOREIGN KEY ("participant_id")
    REFERENCES public."table_participant" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
