CREATE TYPE "enum_LeaveRequests_type" AS ENUM ('Paid', 'Sick', 'Unpaid', 'Other');
CREATE TYPE "enum_LeaveRequests_status" AS ENUM ('Pending', 'Approved', 'Rejected', 'Cancelled');
CREATE TYPE "enum_FieldVisits_status" AS ENUM ('In Progress', 'Completed');

ALTER TABLE "Customers" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Customers" ADD COLUMN "longitude" DOUBLE PRECISION;

ALTER TABLE "Payrolls" ADD COLUMN "workingDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payrolls" ADD COLUMN "presentDays" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payrolls" ADD COLUMN "leaveDays" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payrolls" ADD COLUMN "absentDays" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payrolls" ADD COLUMN "lateDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payrolls" ADD COLUMN "attendanceDeduction" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payrolls" ADD COLUMN "gross" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payrolls" ADD COLUMN "net" DECIMAL(14,2) NOT NULL DEFAULT 0;
UPDATE "Payrolls"
SET "gross" = "basic" + COALESCE("incentive", 0),
    "net" = GREATEST(0, "basic" + COALESCE("incentive", 0) - COALESCE("deduction", 0));

CREATE TABLE "EmployeeDocuments" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "type" VARCHAR(100) NOT NULL DEFAULT 'Other',
  "originalName" VARCHAR(255) NOT NULL,
  "storedName" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(255) NOT NULL,
  "size" INTEGER NOT NULL,
  "uploadedBy" VARCHAR(255),
  "createdAt" TIMESTAMPTZ(6) NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "EmployeeDocuments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveRequests" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "type" "enum_LeaveRequests_type" NOT NULL DEFAULT 'Paid',
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "days" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "enum_LeaveRequests_status" NOT NULL DEFAULT 'Pending',
  "reviewedBy" VARCHAR(255),
  "reviewedAt" TIMESTAMPTZ(6),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "LeaveRequests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FieldVisits" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "taskId" INTEGER,
  "installationId" INTEGER,
  "status" "enum_FieldVisits_status" NOT NULL DEFAULT 'In Progress',
  "checkInAt" TIMESTAMPTZ(6) NOT NULL,
  "checkOutAt" TIMESTAMPTZ(6),
  "checkInLatitude" DOUBLE PRECISION NOT NULL,
  "checkInLongitude" DOUBLE PRECISION NOT NULL,
  "checkOutLatitude" DOUBLE PRECISION,
  "checkOutLongitude" DOUBLE PRECISION,
  "accuracy" DOUBLE PRECISION,
  "notes" TEXT,
  "completionNotes" TEXT,
  "proofPhoto" VARCHAR(255),
  "signature" VARCHAR(255),
  "createdAt" TIMESTAMPTZ(6) NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "FieldVisits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeDocuments_storedName_key" ON "EmployeeDocuments"("storedName");
CREATE INDEX "employee_documents_employee_id" ON "EmployeeDocuments"("employeeId");
CREATE INDEX "leave_requests_employee_date" ON "LeaveRequests"("employeeId", "startDate");
CREATE INDEX "leave_requests_status" ON "LeaveRequests"("status");
CREATE INDEX "field_visits_employee_date" ON "FieldVisits"("employeeId", "checkInAt");
CREATE INDEX "field_visits_customer_date" ON "FieldVisits"("customerId", "checkInAt");
CREATE INDEX "field_visits_status" ON "FieldVisits"("status");

ALTER TABLE "EmployeeDocuments" ADD CONSTRAINT "EmployeeDocuments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequests" ADD CONSTRAINT "LeaveRequests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldVisits" ADD CONSTRAINT "FieldVisits_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldVisits" ADD CONSTRAINT "FieldVisits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldVisits" ADD CONSTRAINT "FieldVisits_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldVisits" ADD CONSTRAINT "FieldVisits_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installations"("id") ON DELETE SET NULL ON UPDATE CASCADE;