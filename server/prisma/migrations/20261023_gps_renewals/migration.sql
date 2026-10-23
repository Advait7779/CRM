ALTER TABLE "Renewals" ADD COLUMN "contactNo" VARCHAR(40);
ALTER TABLE "Renewals" ADD COLUMN "imeiNo" VARCHAR(80);
ALTER TABLE "Renewals" ADD COLUMN "vehicleNumber" VARCHAR(80);
ALTER TABLE "Renewals" ADD COLUMN "renewalDate" DATE;
ALTER TABLE "Renewals" ADD COLUMN "confirmedAt" TIMESTAMPTZ(6);

CREATE INDEX "renewals_imei_expiry" ON "Renewals"("imeiNo", "nextDue");
