-- Uruchamiane raz, przy pierwszym starcie kontenera Postgresa.
-- Tworzy rolę aplikacyjną, która podlega RLS (w odróżnieniu od superusera
-- `kelbroo`, którym działają migracje i seed).
--
-- Na staging i production rola jest zakładana przez provisioning infrastruktury
-- z hasłem z sekretów — tutaj hasło jest jawne wyłącznie dla środowiska lokalnego.

CREATE ROLE kelbroo_app WITH LOGIN PASSWORD 'kelbroo_app' NOBYPASSRLS;
