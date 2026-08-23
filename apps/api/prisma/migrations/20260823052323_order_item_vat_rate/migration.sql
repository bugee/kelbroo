-- AlterTable
ALTER TABLE "order_item" ADD COLUMN     "vat_rate" DECIMAL(5,4) NOT NULL DEFAULT 0;

-- Uzupełnienie istniejących pozycji: stawka z pozycji menu, do której się odnoszą.
-- Wiersze po skasowanej pozycji menu zostają z 0 — nie ma z czego ich odtworzyć,
-- a zmyślona stawka byłaby gorsza niż jawne zero.
UPDATE "order_item" AS oi
   SET "vat_rate" = mi."vat_rate"
  FROM "menu_item" AS mi
 WHERE oi."menu_item_id" = mi."id";
