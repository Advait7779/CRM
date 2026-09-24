ALTER TYPE "enum_Leads_source" ADD VALUE IF NOT EXISTS 'Justdial';

ALTER TABLE "Leads"
  ADD COLUMN "justdialLeadId" VARCHAR(255),
  ADD COLUMN "justdialPayload" JSONB;

CREATE UNIQUE INDEX "leads_justdial_lead_id" ON "Leads"("justdialLeadId");
