-- Blokada stolika: ręczna przez obsługę i automatyczna po zamknięciu rachunku.
ALTER TABLE "restaurant_table" ADD COLUMN "blocked_until" TIMESTAMP(3);

-- Gość przy zablokowanym stoliku może tylko poprosić o jego otwarcie.
ALTER TYPE "WaiterCallReason" ADD VALUE IF NOT EXISTS 'open_table' BEFORE 'other';
