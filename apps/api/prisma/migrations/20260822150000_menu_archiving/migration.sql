-- AlterTable
ALTER TABLE "menu_category" ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "menu_item" ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false;

