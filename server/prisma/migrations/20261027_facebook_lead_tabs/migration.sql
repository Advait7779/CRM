CREATE TABLE "FacebookLeadTabs" (
  "id" SERIAL PRIMARY KEY,
  "leadId" INTEGER NOT NULL REFERENCES "Leads"("id") ON DELETE CASCADE,
  "spreadsheetId" VARCHAR(255) NOT NULL,
  "sheetGid" INTEGER NOT NULL,
  "externalLeadId" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "facebook_lead_tabs_source_unique" ON "FacebookLeadTabs"("spreadsheetId", "sheetGid", "externalLeadId");
CREATE INDEX "facebook_lead_tabs_lead_id" ON "FacebookLeadTabs"("leadId");
CREATE INDEX "facebook_lead_tabs_sheet" ON "FacebookLeadTabs"("spreadsheetId", "sheetGid");
