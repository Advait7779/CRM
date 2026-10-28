ALTER TYPE "enum_Leads_status" ADD VALUE IF NOT EXISTS 'Didn''t Answered';

CREATE TABLE "FacebookSheetRowStatuses" (
    "spreadsheetId" VARCHAR(255) NOT NULL,
    "sheetGid" INTEGER NOT NULL,
    "rowKey" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FacebookSheetRowStatuses_pkey" PRIMARY KEY ("spreadsheetId", "sheetGid", "rowKey")
);
