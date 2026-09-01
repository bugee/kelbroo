-- Eksport raportu sprzedaży do CSV — funkcja planu Pro i wyższych.
--
-- Sam ekran sprzedaży widzi każdy plan z zamawianiem („podstawowy pulpit"
-- z product.md §5.1). Płatny jest wynos danych: to on odróżnia zaglądanie
-- w liczby od pracy na nich w arkuszu.
ALTER TABLE public."subscription"
  ADD COLUMN "reports_export_enabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE public."subscription" SET "reports_export_enabled" = true
 WHERE "plan" IN ('pro', 'enterprise');
