CREATE TABLE IF NOT EXISTS "AuthThrottle" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthThrottle_kind_key_key"
ON "AuthThrottle"("kind", "key");

CREATE INDEX IF NOT EXISTS "AuthThrottle_lockedUntil_idx"
ON "AuthThrottle"("lockedUntil");

CREATE INDEX IF NOT EXISTS "AuthThrottle_updatedAt_idx"
ON "AuthThrottle"("updatedAt");
