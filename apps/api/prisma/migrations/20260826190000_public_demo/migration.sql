-- Publiczna restauracja pokazowa.
--
-- Flaga na organizacji, a nie osobna tabela: pokazowa restauracja jest
-- normalnym najemcą i ma podlegać tej samej izolacji co każdy inny. Różni ją
-- tylko to, że nikt za nią nie płaci i że wolno kasować jej wizyty.
ALTER TABLE public."organization"
  ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;
