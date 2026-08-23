-- Znak rozpoznawczy gościa: zmiana nazwy kolumny, nie skasowanie i dodanie.
-- Wizyty otwarte w chwili wdrożenia mają zachować swoich uczestników.
ALTER TABLE "table_participant" RENAME COLUMN "avatar_key" TO "symbol";

-- Stare wartości (`avatar-07`) nie znaczą nic w nowym zestawie kształtów.
-- Mapujemy po numerze, deterministycznie — nie po losowaniu, żeby powtórzone
-- uruchomienie migracji dało ten sam wynik.
UPDATE "table_participant"
   SET "symbol" = (ARRAY[
         'star','heart','square','triangle','circle','house','arrow','moon','diamond','bolt'
       ])[(COALESCE(NULLIF(regexp_replace("symbol", '\D', '', 'g'), ''), '1')::int - 1) % 10 + 1]
 WHERE "symbol" NOT IN
       ('star','heart','square','triangle','circle','house','arrow','moon','diamond','bolt');

-- Barwy marki zastąpione nazwami kolorów, które gość wypowie kelnerowi.
-- Trzy odcienie teal rozdzielamy na różne kolory, żeby nie zlały się w jeden.
UPDATE "table_participant"
   SET "color" = CASE "color"
         WHEN '#2A8F8C' THEN 'green'
         WHEN '#37AAA3' THEN 'blue'
         WHEN '#5FC9BE' THEN 'purple'
         WHEN '#E8722F' THEN 'orange'
         WHEN '#F7A85C' THEN 'yellow'
         WHEN '#6B807E' THEN 'black'
         ELSE 'red'
       END
 WHERE "color" NOT IN ('red','blue','green','yellow','purple','orange','brown','black');
