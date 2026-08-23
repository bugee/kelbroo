-- Gość przy prośbie o rachunek mówi, czym zapłaci i czy potrzebuje faktury.
--
-- Kelner czyta to, zanim ruszy do stolika: bez tego wraca po terminal albo po
-- dane do faktury, których nie miał jak przewidzieć.
CREATE TYPE "PaymentPreference" AS ENUM ('cash', 'card', 'mixed');

ALTER TABLE "table_session"
  ADD COLUMN "payment_preference" "PaymentPreference",
  ADD COLUMN "invoice_requested" BOOLEAN NOT NULL DEFAULT false;
