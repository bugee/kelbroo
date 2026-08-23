-- Gość może wycofać wezwanie kelnera, dopóki nikt go nie przyjął.
--
-- Osobna wartość, nie `resolved`: „załatwione" znaczy, że obsługa podeszła do
-- stolika. Wrzucenie tu wycofanych zgłoszeń zafałszowałoby każdą późniejszą
-- statystykę czasu reakcji.
ALTER TYPE "WaiterCallStatus" ADD VALUE IF NOT EXISTS 'canceled' AFTER 'resolved';
