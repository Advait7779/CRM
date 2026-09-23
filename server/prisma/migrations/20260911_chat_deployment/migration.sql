-- Some development databases already contain these tables. Preserve their data.
CREATE TABLE IF NOT EXISTS "ChatMessages" (
  "id" SERIAL PRIMARY KEY,
  "senderId" INTEGER NOT NULL,
  "receiverId" INTEGER,
  "groupId" INTEGER,
  "message" TEXT NOT NULL,
  "attachment" VARCHAR(255),
  "attachmentName" VARCHAR(255),
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(6) NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE TABLE IF NOT EXISTS "ChatGroups" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "avatarColor" VARCHAR(50) DEFAULT '#10b981',
  "createdBy" INTEGER NOT NULL,
  "members" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE TABLE IF NOT EXISTS "AppSettings" (
  "key" VARCHAR(255) PRIMARY KEY,
  "value" TEXT,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL
);
CREATE TABLE IF NOT EXISTS "ChatUploads" (
  "storedName" VARCHAR(255) PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "chat_messages_sender_receiver" ON "ChatMessages"("senderId", "receiverId");
CREATE INDEX IF NOT EXISTS "chat_messages_group_id" ON "ChatMessages"("groupId");
CREATE INDEX IF NOT EXISTS "chat_messages_receiver_read" ON "ChatMessages"("receiverId", "read");
CREATE INDEX IF NOT EXISTS "chat_messages_created_at" ON "ChatMessages"("createdAt");
CREATE INDEX IF NOT EXISTS "chat_groups_created_at" ON "ChatGroups"("createdAt");
CREATE INDEX IF NOT EXISTS "chat_uploads_user" ON "ChatUploads"("userId");

-- Only uniquely matching legacy assignments can be linked automatically.
UPDATE "Tasks" t SET "assignedUserId" = u.id
FROM (SELECT name, MIN(id) AS id FROM "Users" GROUP BY name HAVING COUNT(*) = 1) u
WHERE t."assignedUserId" IS NULL AND t."assignedTo" = u.name;
