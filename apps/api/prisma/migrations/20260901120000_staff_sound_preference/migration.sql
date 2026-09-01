-- Sygnał dźwiękowy przy nowej pracy do podjęcia.
--
-- Preferencja na koncie, nie na urządzeniu: kucharz staje przy tym tablecie,
-- przy którym jest wolne miejsce, a kelner przechodzi między nimi w trakcie
-- zmiany. Ustawienie zapamiętane w przeglądarce trzeba by odtwarzać na każdym
-- z osobna.
--
-- Domyślnie włączone — cichy ekran kuchni to zamówienie, którego nikt nie
-- zauważył. Wyciszenie jest jednym stuknięciem.
ALTER TABLE public."staff_member"
  ADD COLUMN "sound_enabled" BOOLEAN NOT NULL DEFAULT true;
