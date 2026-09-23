-- Extend admin notifications for persistent invoice issue reminders.
ALTER TABLE "AdminNotification" ALTER COLUMN "targetUserId" DROP NOT NULL;

ALTER TABLE "AdminNotification"
    ADD COLUMN "fiscalYear" INTEGER,
    ADD COLUMN "quarter" INTEGER,
    ADD COLUMN "dedupeKey" TEXT,
    ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "AdminNotification_dedupeKey_key"
    ON "AdminNotification"("dedupeKey");
