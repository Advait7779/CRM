ALTER TABLE "Leads"
  ADD COLUMN "websiteLeadId" VARCHAR(255),
  ADD COLUMN "websiteFormSource" VARCHAR(150),
  ADD COLUMN "websiteSubmittedAt" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "leads_website_lead_id" ON "Leads"("websiteLeadId");
CREATE INDEX "leads_website_submitted_at" ON "Leads"("websiteSubmittedAt");
