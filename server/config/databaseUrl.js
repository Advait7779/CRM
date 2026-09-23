require('./env');

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const user = encodeURIComponent(process.env.DB_USER || 'postgres');
  const password = encodeURIComponent(process.env.DB_PASS || '');
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || '5432';
  const database = encodeURIComponent(process.env.DB_NAME || 'service_management');

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

module.exports = { getDatabaseUrl };
