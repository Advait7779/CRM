import "dotenv/config";
import { defineConfig } from "prisma/config";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const user = encodeURIComponent(process.env.DB_USER || "postgres");
  const password = encodeURIComponent(process.env.DB_PASS || "");
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = process.env.DB_PORT || "5432";
  const database = encodeURIComponent(process.env.DB_NAME || "service_management");
  const ssl = String(process.env.DB_SSL || "").toLowerCase() === "true"
    ? "?sslmode=require"
    : "";

  return `postgresql://${user}:${password}@${host}:${port}/${database}${ssl}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: process.env.PRISMA_MIGRATIONS_PATH || "prisma/migrations"
  },
  datasource: {
    url: databaseUrl()
  }
});
