ALTER TABLE "Leads"
  ADD COLUMN "facebookLeadId" VARCHAR(255),
  ADD COLUMN "facebookSubmittedAt" TIMESTAMPTZ(6),
  ADD COLUMN "facebookPlatform" VARCHAR(20),
  ADD COLUMN "facebookPayload" JSONB;

CREATE UNIQUE INDEX "leads_facebook_lead_id" ON "Leads"("facebookLeadId");
CREATE INDEX "leads_facebook_submitted_at" ON "Leads"("facebookSubmittedAt");
