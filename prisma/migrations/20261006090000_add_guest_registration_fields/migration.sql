ALTER TABLE "User"
  ADD COLUMN "registrationType" TEXT NOT NULL DEFAULT 'UNIVERSITY',
  ADD COLUMN "guestInstitution" TEXT,
  ADD COLUMN "guestPurpose" TEXT,
  ADD COLUMN "guestHostName" TEXT,
  ADD COLUMN "guestValidUntil" TIMESTAMP(3),
  ADD COLUMN "guestApproved" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "User_registrationType_guestApproved_idx"
  ON "User"("registrationType", "guestApproved");
