-- Przeniesienie wizyty na inny stolik zmienia adres, pod który idzie jedzenie.
--
-- Zapisujemy to w historii zamówienia, bo `OrderEvent` jest źródłem prawdy
-- o tym, co się z zamówieniem działo (CLAUDE.md). Bez wpisu numer stolika
-- zmieniałby się na bonie bez żadnego śladu, kto i kiedy go zmienił — a to
-- pierwsze pytanie po tym, jak jedzenie trafi pod zły stolik.
ALTER TYPE "OrderEventType" ADD VALUE IF NOT EXISTS 'table_moved' AFTER 'item_reassigned';
