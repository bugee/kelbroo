-- Potwierdzanie adresu e-mail przy zakładaniu konta.
ALTER TABLE "staff_member"
  ADD COLUMN "email_verified_at"      TIMESTAMP(3),
  ADD COLUMN "email_token_hash"       TEXT,
  ADD COLUMN "email_token_expires_at" TIMESTAMP(3);

-- Konta istniejące w chwili wdrożenia są potwierdzone z urzędu. Inaczej
-- weryfikacja zamknęłaby drogę do panelu wszystkim, którzy już z niego korzystają
-- — łącznie z jedynym kontem właściciela na produkcji.
UPDATE "staff_member" SET "email_verified_at" = "created_at";

-- Wyszukiwanie po tokenie idzie po skrócie i musi być szybkie oraz jednoznaczne.
CREATE UNIQUE INDEX "staff_member_email_token_hash"
  ON "staff_member" ("email_token_hash")
  WHERE "email_token_hash" IS NOT NULL;
