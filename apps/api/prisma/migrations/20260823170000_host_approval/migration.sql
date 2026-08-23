-- Host wpuszcza kolejnych gości; rozliczanie części stolika staje się przełącznikiem.
ALTER TABLE "restaurant"
  ADD COLUMN "host_approves_guests" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "partial_settlement_enabled" BOOLEAN NOT NULL DEFAULT true;

-- DEFAULT, bo oczekiwanie na zgodę jest wyjątkiem: uczestnik dopisany poza
-- ścieżką skanu QR ma być przy stoliku od razu, nie zawieszony w kolejce.
ALTER TABLE "table_participant"
  ADD COLUMN "approved_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Wszyscy dotychczasowi uczestnicy weszli, zanim akceptacja istniała. Bez tego
-- backfillu otwarte wizyty zawisłyby na ekranie „czekasz na zgodę hosta".
UPDATE "table_participant" SET "approved_at" = "joined_at";
