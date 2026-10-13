CREATE TABLE IF NOT EXISTS "PerformanceSample" (
 "id" TEXT PRIMARY KEY,
 "category" TEXT NOT NULL CHECK ("category" IN ('login', 'dashboard', 'reservations', 'admin')),
 "recordedAt" TIMESTAMPTZ(3) NOT NULL,
 "durationMs" DOUBLE PRECISION NOT NULL CHECK ("durationMs" >= 0 AND "durationMs" < 'Infinity'::float8)
);
CREATE INDEX IF NOT EXISTS "PerformanceSample_recordedAt_category_idx" ON "PerformanceSample" ("recordedAt", "category");
