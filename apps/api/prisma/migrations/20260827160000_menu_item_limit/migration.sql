-- Limit pozycji w karcie, zależny od planu.
--
-- Domyślna wartość jest szeroka celowo: klient, który miał kartę bez limitu,
-- nie może z dnia na dzień stracić możliwości dodania dania. Uzupełnienie
-- wstecz ustawia limity planu, ale **istniejące pozycje zostają** — blokujemy
-- dodawanie nowych, nie zabieramy karty.
ALTER TABLE public."subscription"
  ADD COLUMN "menu_item_limit" INTEGER NOT NULL DEFAULT 9999;

UPDATE public."subscription" SET "menu_item_limit" = 10 WHERE "plan" = 'menu';
UPDATE public."subscription" SET "menu_item_limit" = 50 WHERE "plan" = 'starter';
