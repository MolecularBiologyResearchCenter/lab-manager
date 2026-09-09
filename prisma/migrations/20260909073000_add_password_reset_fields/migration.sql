ALTER TABLE "User"
ADD COLUMN "passwordResetTokenHash" TEXT,
ADD COLUMN "passwordResetTokenExpiresAt" TIMESTAMP(3);

CREATE INDEX "User_passwordResetTokenHash_idx"
ON "User"("passwordResetTokenHash");
