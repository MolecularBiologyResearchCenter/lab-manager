ALTER TABLE "User"
ADD COLUMN "microsoftGroupSyncStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN "microsoftGroupSyncErrorCode" TEXT,
ADD COLUMN "microsoftGroupSyncAt" TIMESTAMP(3);
