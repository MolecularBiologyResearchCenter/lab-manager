ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "affiliationType" TEXT NOT NULL DEFAULT 'FACULTY_STAFF',
  ADD COLUMN IF NOT EXISTS "enrollmentStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "affiliationTypeSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "annualRegistrationFee" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "UserAffiliationChange" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "previousType" TEXT NOT NULL,
  "nextType" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "changedById" TEXT,
  "changedByName" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAffiliationChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserAffiliationChange_userId_changedAt_idx"
  ON "UserAffiliationChange"("userId", "changedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserAffiliationChange_userId_fkey'
  ) THEN
    ALTER TABLE "UserAffiliationChange"
      ADD CONSTRAINT "UserAffiliationChange_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
