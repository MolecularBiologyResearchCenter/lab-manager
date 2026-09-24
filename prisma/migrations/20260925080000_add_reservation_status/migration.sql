ALTER TABLE "Reservation"
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS "Reservation_equipmentId_status_startTime_endTime_idx"
ON "Reservation"("equipmentId", "status", "startTime", "endTime");
