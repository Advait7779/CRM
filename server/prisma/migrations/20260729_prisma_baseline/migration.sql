-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "enum_Attendances_status" AS ENUM ('Present', 'Late', 'Absent', 'Leave');

-- CreateEnum
CREATE TYPE "enum_Employees_dept" AS ENUM ('Accountants', 'Sales', 'Support Team', 'Developers', 'Technicians');

-- CreateEnum
CREATE TYPE "enum_Employees_payrollStatus" AS ENUM ('Pending', 'Paid');

-- CreateEnum
CREATE TYPE "enum_Installations_status" AS ENUM ('Pending', 'In Progress', 'Completed');

-- CreateEnum
CREATE TYPE "enum_Installations_type" AS ENUM ('GPS', 'CCTV', 'Website');

-- CreateEnum
CREATE TYPE "enum_InventoryTransactions_direction" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "enum_Invoices_status" AS ENUM ('Paid', 'Partially Paid', 'Unpaid', 'Overdue');

-- CreateEnum
CREATE TYPE "enum_Leads_source" AS ENUM ('Website', 'Facebook', 'WhatsApp', 'Reference', 'Call');

-- CreateEnum
CREATE TYPE "enum_Leads_status" AS ENUM ('New', 'Contacted', 'Demo Given', 'Quotation Sent', 'Negotiation', 'Won', 'Lost');

-- CreateEnum
CREATE TYPE "enum_Payrolls_status" AS ENUM ('Pending', 'Paid');

-- CreateEnum
CREATE TYPE "enum_Quotations_status" AS ENUM ('Pending Approval', 'Approved', 'Converted', 'Rejected');

-- CreateEnum
CREATE TYPE "enum_Tasks_dept" AS ENUM ('Accountants', 'Sales', 'Support Team', 'Developers', 'Technicians');

-- CreateEnum
CREATE TYPE "enum_Tasks_priority" AS ENUM ('High', 'Medium', 'Low');

-- CreateEnum
CREATE TYPE "enum_Tasks_status" AS ENUM ('Pending', 'Ongoing', 'Completed', 'Not Completed');

-- CreateEnum
CREATE TYPE "enum_Tickets_priority" AS ENUM ('High', 'Medium', 'Low');

-- CreateEnum
CREATE TYPE "enum_Tickets_status" AS ENUM ('Open', 'In Progress', 'Resolved');

-- CreateTable
CREATE TABLE "ActivityLogs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "userName" VARCHAR(255),
    "action" VARCHAR(255) NOT NULL,
    "entity" VARCHAR(255) NOT NULL,
    "entityId" VARCHAR(255),
    "metadata" JSONB,
    "ip" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ActivityLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendances" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "status" "enum_Attendances_status" NOT NULL,
    "checkIn" TIME(6),
    "checkOut" TIME(6),
    "hoursWorked" DOUBLE PRECISION,
    "recordedBy" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDocuments" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "storedName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(255) NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CustomerDocuments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "contact" VARCHAR(255),
    "phone" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "gst" VARCHAR(255),
    "address" TEXT,
    "services" TEXT DEFAULT '[]',
    "vehicles" INTEGER DEFAULT 0,
    "cctv" INTEGER DEFAULT 0,
    "domain" VARCHAR(255),
    "hosting" VARCHAR(255),
    "renewalDate" DATE,
    "status" VARCHAR(255) DEFAULT 'Active',
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employees" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "dept" "enum_Employees_dept" NOT NULL,
    "role" VARCHAR(255),
    "phone" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "status" VARCHAR(255) DEFAULT 'Present',
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "basicSalary" DOUBLE PRECISION DEFAULT 20000,
    "incentive" DOUBLE PRECISION DEFAULT 0,
    "deduction" DOUBLE PRECISION DEFAULT 0,
    "payrollStatus" "enum_Employees_payrollStatus" DEFAULT 'Pending',

    CONSTRAINT "Employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installations" (
    "id" SERIAL NOT NULL,
    "type" "enum_Installations_type" NOT NULL,
    "customer" VARCHAR(255) NOT NULL,
    "vehicle" VARCHAR(255),
    "imei" VARCHAR(255),
    "sim" VARCHAR(255),
    "installer" VARCHAR(255),
    "site" TEXT,
    "cameras" INTEGER DEFAULT 0,
    "dvr" VARCHAR(255),
    "tech" VARCHAR(255),
    "domain" VARCHAR(255),
    "hosting" VARCHAR(255),
    "design" VARCHAR(255) DEFAULT 'Pending',
    "dev" VARCHAR(255) DEFAULT 'Pending',
    "goLive" DATE,
    "date" DATE,
    "status" "enum_Installations_status" DEFAULT 'Pending',
    "reportPhoto" VARCHAR(255),
    "reportSignature" VARCHAR(255),
    "reportNotes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(255) NOT NULL,
    "barcode" VARCHAR(255) NOT NULL,
    "stock" INTEGER DEFAULT 0,
    "min" INTEGER DEFAULT 10,
    "price" VARCHAR(255),
    "status" VARCHAR(255) DEFAULT 'OK',
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Inventories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransactions" (
    "id" SERIAL NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "direction" "enum_InventoryTransactions_direction" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "purpose" VARCHAR(255),
    "customer" VARCHAR(255),
    "reference" VARCHAR(255),
    "recordedBy" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "InventoryTransactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoices" (
    "id" VARCHAR(255) NOT NULL,
    "customer" VARCHAR(255) NOT NULL,
    "date" DATE NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "gst" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "status" "enum_Invoices_status" DEFAULT 'Unpaid',
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leads" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "company" VARCHAR(255),
    "source" "enum_Leads_source" DEFAULT 'Website',
    "service" VARCHAR(255) NOT NULL,
    "status" "enum_Leads_status" DEFAULT 'New',
    "exec" VARCHAR(255),
    "followUp" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notifications" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "type" VARCHAR(255) DEFAULT 'system',
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "link" VARCHAR(255),
    "read" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payments" (
    "id" VARCHAR(255) NOT NULL,
    "invoiceId" VARCHAR(255) NOT NULL,
    "customer" VARCHAR(255) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" VARCHAR(255) DEFAULT 'NEFT',
    "date" DATE NOT NULL,
    "reference" VARCHAR(255),
    "recordedBy" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payrolls" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "basic" DOUBLE PRECISION NOT NULL,
    "incentive" DOUBLE PRECISION DEFAULT 0,
    "deduction" DOUBLE PRECISION DEFAULT 0,
    "status" "enum_Payrolls_status" DEFAULT 'Pending',
    "paidAt" TIMESTAMPTZ(6),
    "paidBy" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotations" (
    "id" VARCHAR(255) NOT NULL,
    "customer" VARCHAR(255) NOT NULL,
    "date" DATE NOT NULL,
    "items" TEXT NOT NULL,
    "amount" VARCHAR(255) NOT NULL,
    "status" "enum_Quotations_status" DEFAULT 'Pending Approval',
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Renewals" (
    "id" SERIAL NOT NULL,
    "customer" VARCHAR(255) NOT NULL,
    "type" VARCHAR(255) NOT NULL,
    "lastDate" DATE,
    "nextDue" DATE NOT NULL,
    "amount" VARCHAR(255) NOT NULL,
    "daysLeft" INTEGER,
    "status" VARCHAR(255) DEFAULT 'Active',
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Renewals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tasks" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "desc" TEXT,
    "dept" "enum_Tasks_dept" NOT NULL,
    "assignedTo" VARCHAR(255) NOT NULL,
    "priority" "enum_Tasks_priority" DEFAULT 'Medium',
    "status" "enum_Tasks_status" DEFAULT 'Pending',
    "due" DATE,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tickets" (
    "id" SERIAL NOT NULL,
    "customer" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "service" VARCHAR(255) NOT NULL,
    "priority" "enum_Tickets_priority" DEFAULT 'Medium',
    "status" "enum_Tickets_status" DEFAULT 'Open',
    "resolution" VARCHAR(255) DEFAULT 'Pending SLA',
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "description" TEXT,

    CONSTRAINT "Tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(255),
    "role" VARCHAR(255) NOT NULL DEFAULT 'support_executive',
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_created_at" ON "ActivityLogs"("createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_entity_entity_id" ON "ActivityLogs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_user_id" ON "ActivityLogs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_employee_id_date" ON "Attendances"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDocuments_storedName_key" ON "CustomerDocuments"("storedName");

-- CreateIndex
CREATE INDEX "customer_documents_customer_id" ON "CustomerDocuments"("customerId");

-- CreateIndex
CREATE INDEX "inventory_transactions_created_at" ON "InventoryTransactions"("createdAt");

-- CreateIndex
CREATE INDEX "inventory_transactions_inventory_id" ON "InventoryTransactions"("inventoryId");

-- CreateIndex
CREATE INDEX "notifications_user_id_read" ON "Notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "payments_date" ON "Payments"("date");

-- CreateIndex
CREATE INDEX "payments_invoice_id" ON "Payments"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payrolls_employee_id_period" ON "Payrolls"("employeeId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- AddForeignKey
ALTER TABLE "Attendances" ADD CONSTRAINT "Attendances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDocuments" ADD CONSTRAINT "CustomerDocuments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransactions" ADD CONSTRAINT "InventoryTransactions_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payments" ADD CONSTRAINT "Payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payrolls" ADD CONSTRAINT "Payrolls_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
