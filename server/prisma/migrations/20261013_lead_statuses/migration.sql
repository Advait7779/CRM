ALTER TYPE "enum_Leads_status" ADD VALUE IF NOT EXISTS 'Connected';
ALTER TYPE "enum_Leads_status" ADD VALUE IF NOT EXISTS 'Future Prospect';
ALTER TYPE "enum_Leads_status" ADD VALUE IF NOT EXISTS 'Fake Enquiry';
ALTER TYPE "enum_Leads_status" ADD VALUE IF NOT EXISTS 'Interested';
ALTER TYPE "enum_Leads_status" ADD VALUE IF NOT EXISTS 'Not Interested';
ALTER TYPE "enum_Leads_status" ADD VALUE IF NOT EXISTS 'Follow-Up Required';

ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "assignedTo" VARCHAR(255);
