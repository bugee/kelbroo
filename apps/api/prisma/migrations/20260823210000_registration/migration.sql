-- Rejestracja restauracji: zgody i jednoznaczność konta.

-- Zgody zapisujemy z wersją dokumentu. Sam znacznik czasu nie wystarcza, bo
-- regulamin będzie się zmieniał, a zgoda dotyczy konkretnego brzmienia.
ALTER TABLE "organization"
  ADD COLUMN "terms_accepted_at"   TIMESTAMP(3),
  ADD COLUMN "terms_version"       TEXT,
  ADD COLUMN "privacy_accepted_at" TIMESTAMP(3),
  ADD COLUMN "privacy_version"     TEXT;

-- Logowanie szuka pracownika po samym adresie e-mail, bez kontekstu organizacji
-- — bo w chwili logowania jeszcze nie wiadomo, o którą chodzi. Dotychczasowa
-- unikalność była tylko w obrębie organizacji, więc dwa konta z tym samym
-- adresem w różnych lokalach dawały logowanie trafiające w przypadkowe z nich.
--
-- Migracja przerwie się, jeśli takie duplikaty już istnieją. To zamierzone:
-- cicho wybrany „zwycięzca" byłby gorszy niż zatrzymane wdrożenie.
CREATE UNIQUE INDEX "staff_member_email_global" ON "staff_member" ("email");
