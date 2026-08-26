-- Gość może raz wpisać własny nick zamiast wylosowanego.
--
-- Znacznik czasu, nie flaga: mówi zarazem „już wybrał" i „kiedy", a to drugie
-- przydaje się przy sporze o to, kto co zamawiał.
ALTER TABLE public."table_participant"
  ADD COLUMN "name_chosen_at" TIMESTAMP(3);
