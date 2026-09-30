ALTER TABLE "AuditLog"
  ADD COLUMN "requestId" TEXT NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "result" TEXT NOT NULL DEFAULT 'success',
  ADD COLUMN "errorCode" TEXT;

CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- Older rows may have stored display names. Retain stable IDs only.
UPDATE "AuditLog"
SET "actorName" = COALESCE("actorId", 'SYSTEM'),
    "targetLabel" = NULL;
