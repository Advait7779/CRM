ALTER TABLE "Renewals" ADD COLUMN "followUpDate" DATE;
ALTER TABLE "Renewals" ADD COLUMN "remarks" VARCHAR(500);

CREATE INDEX "renewals_follow_up_date" ON "Renewals"("followUpDate");
