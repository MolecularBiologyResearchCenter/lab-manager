ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "annualRegistrationPeriodStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "annualRegistrationPeriodEnd" TIMESTAMP(3);
