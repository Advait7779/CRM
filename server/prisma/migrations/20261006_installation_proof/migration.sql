ALTER TABLE "Installations"
  ADD COLUMN "phone" VARCHAR(255),
  ADD COLUMN "email" VARCHAR(255),
  ADD COLUMN "location" VARCHAR(255),
  ADD COLUMN "deviceType" VARCHAR(255);

ALTER TABLE "Installations" ALTER COLUMN "reportPhoto" TYPE TEXT;
