-- Limit kont personelu w planie.
--
-- Cennik obiecywał go od początku (1 / 3 / bez limitu), ale nic go nie
-- egzekwowało. Domyślna wartość jest szeroka celowo: istniejący klienci nie mogą
-- z dnia na dzień stracić możliwości założenia konta, którą mieli wczoraj.
ALTER TABLE public."subscription"
  ADD COLUMN "staff_limit" INTEGER NOT NULL DEFAULT 9999;

-- Uzupełnienie wstecz według planu. Ci, którzy mają już więcej kont niż
-- przewiduje plan, zachowują je — limit blokuje wyłącznie zakładanie nowych.
UPDATE public."subscription" SET "staff_limit" = 1 WHERE "plan" = 'menu';
UPDATE public."subscription" SET "staff_limit" = 3 WHERE "plan" = 'starter';
