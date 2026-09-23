const { PrismaClient, Prisma } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { getDatabaseUrl } = require('./databaseUrl');

const pgConfig = {
  connectionString: getDatabaseUrl(),
  max: Number(process.env.DB_POOL_MAX || 10)
};

if (String(process.env.DB_SSL || '').toLowerCase() === 'true') {
  pgConfig.ssl = {
    rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true'
  };
}

const adapter = new PrismaPg(pgConfig);
const prisma = new PrismaClient({
  adapter,
  log: String(process.env.DB_LOGGING || '').toLowerCase() === 'true'
    ? ['query', 'warn', 'error']
    : ['warn', 'error']
});

async function connectDB() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  console.log('PostgreSQL connected successfully via Prisma ORM.');
}

module.exports = { prisma, Prisma, connectDB };
