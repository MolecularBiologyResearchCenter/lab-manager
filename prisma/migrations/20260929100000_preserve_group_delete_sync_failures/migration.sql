ALTER TABLE "AdminNotification"
  ADD COLUMN IF NOT EXISTS "microsoftDirectoryUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "microsoftGroupSyncErrorCode" TEXT;
