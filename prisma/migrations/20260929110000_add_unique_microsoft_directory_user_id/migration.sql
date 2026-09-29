ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "microsoftDirectoryUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_microsoftDirectoryUserId_key"
  ON "User" ("microsoftDirectoryUserId");
