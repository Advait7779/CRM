ALTER TABLE "Renewals" ADD COLUMN "expiredSmsStatus" VARCHAR(16);
ALTER TABLE "Renewals" ADD COLUMN "expiredSmsClaimId" VARCHAR(36);
ALTER TABLE "Renewals" ADD COLUMN "expiredSmsClaimedAt" TIMESTAMPTZ(6);
ALTER TABLE "Renewals" ADD COLUMN "expiredSmsSentAt" TIMESTAMPTZ(6);

CREATE INDEX "renewals_expired_sms_claim_id" ON "Renewals"("expiredSmsClaimId");
