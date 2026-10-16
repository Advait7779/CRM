ALTER TABLE "Customers"
  ADD COLUMN "birthday" DATE,
  ADD COLUMN "anniversary" DATE;

CREATE TABLE "CustomerGreetingDeliveries" (
  "id" UUID NOT NULL,
  "customerId" INTEGER NOT NULL,
  "occasion" VARCHAR(20) NOT NULL,
  "channel" VARCHAR(10) NOT NULL,
  "requestedById" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "providerStatus" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerGreetingDeliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_greetings_customer_created" ON "CustomerGreetingDeliveries"("customerId", "createdAt");
