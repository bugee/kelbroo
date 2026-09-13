-- Alergeny przechodzą z pozycji na jej tłumaczenie.
--
-- Do tej pory lista była jedna na danie, więc niemiecki gość czytał „mleko,
-- gluten" — a alergeny to jedyne źródło tej informacji w aplikacji i lokal
-- odpowiada za nie wobec gościa (docs/03 §5). Lista, której gość nie rozumie,
-- jest w tej roli gorsza niż jej brak, bo wygląda na przeczytaną.
ALTER TABLE public."menu_item_translation"
  ADD COLUMN "allergens" TEXT[] NOT NULL DEFAULT '{}';

-- Przepisujemy istniejące listy **wyłącznie do języka domyślnego lokalu**.
-- Skopiowanie polskich alergenów do tłumaczenia angielskiego podałoby je
-- gościowi jako angielskie. Pozostałe języki startują puste, a gość zobaczy
-- tam odesłanie do obsługi — i to jest prawda o stanie tych danych.
UPDATE public."menu_item_translation" t
   SET "allergens" = i."allergens"
  FROM public."menu_item" i
  JOIN public."restaurant" r ON r."id" = i."restaurant_id"
 WHERE t."menu_item_id" = i."id"
   AND t."locale" = r."default_locale"
   AND COALESCE(array_length(i."allergens", 1), 0) > 0;

ALTER TABLE public."menu_item" DROP COLUMN "allergens";
