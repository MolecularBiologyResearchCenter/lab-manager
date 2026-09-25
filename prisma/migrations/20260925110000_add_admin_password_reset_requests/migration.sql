CREATE TABLE IF NOT EXISTS "PasswordResetRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PasswordResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PasswordResetRequest_userId_createdAt_idx"
ON "PasswordResetRequest"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PasswordResetRequest_codeHash_idx"
ON "PasswordResetRequest"("codeHash");
CREATE INDEX IF NOT EXISTS "PasswordResetRequest_usedAt_invalidatedAt_codeExpiresAt_idx"
ON "PasswordResetRequest"("usedAt", "invalidatedAt", "codeExpiresAt");
