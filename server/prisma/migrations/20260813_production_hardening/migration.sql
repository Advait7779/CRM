-- Preserve legacy display-name columns while introducing stable relationships.
ALTER TYPE "enum_Leads_status" ADD VALUE IF NOT EXISTS 'Converted';
ALTER TABLE "Leads" ADD COLUMN "convertedCustomerId" INTEGER;
ALTER TABLE "Installations" ADD COLUMN "customerId" INTEGER;
ALTER TABLE "InventoryTransactions" ADD COLUMN "customerId" INTEGER;
ALTER TABLE "Invoices" ADD COLUMN "customerId" INTEGER;
ALTER TABLE "Quotations" ADD COLUMN "customerId" INTEGER;
ALTER TABLE "Renewals" ADD COLUMN "customerId" INTEGER;
ALTER TABLE "Tickets" ADD COLUMN "customerId" INTEGER;
ALTER TABLE "Tasks" ADD COLUMN "assignedUserId" INTEGER;
ALTER TABLE "Notifications" ADD COLUMN "dedupeKey" VARCHAR(255);

-- Backfill only when a name identifies exactly one customer/user. Ambiguous legacy
-- rows remain nullable and can be reconciled by an administrator after deployment.
WITH unique_customers AS (
  SELECT MIN("id") AS "id", "name" FROM "Customers" GROUP BY "name" HAVING COUNT(*) = 1
)
UPDATE "Installations" r SET "customerId" = c."id" FROM unique_customers c WHERE r."customer" = c."name";
WITH unique_customers AS (
  SELECT MIN("id") AS "id", "name" FROM "Customers" GROUP BY "name" HAVING COUNT(*) = 1
)
UPDATE "InventoryTransactions" r SET "customerId" = c."id" FROM unique_customers c WHERE r."customer" = c."name";
WITH unique_customers AS (
  SELECT MIN("id") AS "id", "name" FROM "Customers" GROUP BY "name" HAVING COUNT(*) = 1
)
UPDATE "Invoices" r SET "customerId" = c."id" FROM unique_customers c WHERE r."customer" = c."name";
WITH unique_customers AS (
  SELECT MIN("id") AS "id", "name" FROM "Customers" GROUP BY "name" HAVING COUNT(*) = 1
)
UPDATE "Quotations" r SET "customerId" = c."id" FROM unique_customers c WHERE r."customer" = c."name";
WITH unique_customers AS (
  SELECT MIN("id") AS "id", "name" FROM "Customers" GROUP BY "name" HAVING COUNT(*) = 1
)
UPDATE "Renewals" r SET "customerId" = c."id" FROM unique_customers c WHERE r."customer" = c."name";
WITH unique_customers AS (
  SELECT MIN("id") AS "id", "name" FROM "Customers" GROUP BY "name" HAVING COUNT(*) = 1
)
UPDATE "Tickets" r SET "customerId" = c."id" FROM unique_customers c WHERE r."customer" = c."name";
WITH unique_users AS (
  SELECT MIN("id") AS "id", "name" FROM "Users" GROUP BY "name" HAVING COUNT(*) = 1
)
UPDATE "Tasks" r SET "assignedUserId" = u."id" FROM unique_users u WHERE r."assignedTo" = u."name";

-- Use exact fixed-point storage for money. Existing values are rounded to paise.
ALTER TABLE "Invoices" ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "Invoices" ALTER COLUMN "gst" TYPE DECIMAL(5,2) USING ROUND("gst"::numeric, 2);
ALTER TABLE "Invoices" ALTER COLUMN "total" TYPE DECIMAL(14,2) USING ROUND("total"::numeric, 2);
ALTER TABLE "Payments" ALTER COLUMN "amount" TYPE DECIMAL(14,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "Employees" ALTER COLUMN "basicSalary" TYPE DECIMAL(14,2) USING ROUND("basicSalary"::numeric, 2);
ALTER TABLE "Employees" ALTER COLUMN "incentive" TYPE DECIMAL(14,2) USING ROUND("incentive"::numeric, 2);
ALTER TABLE "Employees" ALTER COLUMN "deduction" TYPE DECIMAL(14,2) USING ROUND("deduction"::numeric, 2);
ALTER TABLE "Payrolls" ALTER COLUMN "basic" TYPE DECIMAL(14,2) USING ROUND("basic"::numeric, 2);
ALTER TABLE "Payrolls" ALTER COLUMN "incentive" TYPE DECIMAL(14,2) USING ROUND("incentive"::numeric, 2);
ALTER TABLE "Payrolls" ALTER COLUMN "deduction" TYPE DECIMAL(14,2) USING ROUND("deduction"::numeric, 2);
ALTER TABLE "Inventories" ALTER COLUMN "price" TYPE DECIMAL(14,2) USING ROUND(COALESCE(NULLIF(REGEXP_REPLACE("price", '[^0-9.-]', '', 'g'), ''), '0')::numeric, 2);
ALTER TABLE "Quotations" ADD COLUMN "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Quotations" ADD COLUMN "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Quotations" ADD COLUMN "taxable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Quotations" ALTER COLUMN "amount" TYPE DECIMAL(14,2)
  USING ROUND(COALESCE(NULLIF(REGEXP_REPLACE("amount", '[^0-9.-]', '', 'g'), ''), '0')::numeric, 2);
ALTER TABLE "Renewals" ALTER COLUMN "amount" TYPE DECIMAL(14,2)
  USING ROUND(COALESCE(NULLIF(REGEXP_REPLACE("amount", '[^0-9.-]', '', 'g'), ''), '0')::numeric, 2);
UPDATE "Quotations" SET "subtotal" = "amount", "taxAmount" = 0;

ALTER TABLE "Leads" ADD CONSTRAINT "Leads_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "Customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "leads_converted_customer_id" ON "Leads"("convertedCustomerId");
ALTER TABLE "InventoryTransactions" ADD CONSTRAINT "InventoryTransactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Installations" ADD CONSTRAINT "Installations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoices" ADD CONSTRAINT "Invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quotations" ADD CONSTRAINT "Quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Renewals" ADD CONSTRAINT "Renewals_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tickets" ADD CONSTRAINT "Tickets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Never erase payment history when an invoice is removed.
ALTER TABLE "Payments" DROP CONSTRAINT "Payments_invoiceId_fkey";
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Notifications_dedupeKey_key" ON "Notifications"("dedupeKey");
CREATE INDEX "customers_name" ON "Customers"("name");
CREATE INDEX "customers_status" ON "Customers"("status");
CREATE INDEX "inventory_transactions_customer_id" ON "InventoryTransactions"("customerId");
CREATE INDEX "installations_customer_id" ON "Installations"("customerId");
CREATE INDEX "installations_date" ON "Installations"("date");
CREATE INDEX "installations_status" ON "Installations"("status");
CREATE INDEX "invoices_customer_id" ON "Invoices"("customerId");
CREATE INDEX "invoices_date" ON "Invoices"("date");
CREATE INDEX "invoices_status" ON "Invoices"("status");
CREATE INDEX "leads_created_at" ON "Leads"("createdAt");
CREATE INDEX "leads_status" ON "Leads"("status");
CREATE INDEX "leads_source" ON "Leads"("source");
CREATE INDEX "quotations_customer_id" ON "Quotations"("customerId");
CREATE INDEX "quotations_date" ON "Quotations"("date");
CREATE INDEX "quotations_status" ON "Quotations"("status");
CREATE INDEX "renewals_customer_id" ON "Renewals"("customerId");
CREATE INDEX "renewals_next_due" ON "Renewals"("nextDue");
CREATE INDEX "renewals_status" ON "Renewals"("status");
CREATE INDEX "tasks_assigned_user_id" ON "Tasks"("assignedUserId");
CREATE INDEX "tasks_due" ON "Tasks"("due");
CREATE INDEX "tasks_status" ON "Tasks"("status");
CREATE INDEX "tickets_customer_id" ON "Tickets"("customerId");
CREATE INDEX "tickets_status" ON "Tickets"("status");
CREATE INDEX "tickets_created_at" ON "Tickets"("createdAt");

CREATE INDEX "employees_dept" ON "Employees"("dept");
CREATE INDEX "employees_status" ON "Employees"("status");
CREATE INDEX "inventories_barcode" ON "Inventories"("barcode");
CREATE INDEX "inventories_status" ON "Inventories"("status");
CREATE INDEX "payrolls_period" ON "Payrolls"("period");
CREATE INDEX "payrolls_status" ON "Payrolls"("status");
