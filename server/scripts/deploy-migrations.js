const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { getDatabaseUrl } = require('../config/databaseUrl');

function deploy(migrationsPath) {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: path.resolve(__dirname, '..'), stdio: 'inherit',
    env: { ...process.env, ...(migrationsPath ? { PRISMA_MIGRATIONS_PATH: migrationsPath } : {}) }
  });
  if (result.status !== 0) throw new Error('Prisma migration failed; web startup has been stopped.');
}

(async () => {
  const db = new Client({ connectionString: getDatabaseUrl(),
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' } } : {}) });
  await db.connect();
  let temporary;
  try {
    await db.query("SELECT pg_advisory_lock(hashtext('service-management-deploy'))");
    const { rows } = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    if (rows.length === 0) {
      // Preserve original migration names/checksums. Prisma records the baseline
      // normally, then applies all remaining pending migrations.
      temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-baseline-'));
      const baseline = '20260729_prisma_baseline';
      fs.mkdirSync(path.join(temporary, baseline));
      fs.copyFileSync(path.join(__dirname, '../prisma/migrations', baseline, 'migration.sql'), path.join(temporary, baseline, 'migration.sql'));
      fs.writeFileSync(path.join(temporary, 'migration_lock.toml'), 'provider = "postgresql"\n');
      console.log('Initializing an empty database with the original baseline.');
      deploy(temporary);
    }
    deploy();
  } finally {
    await db.query("SELECT pg_advisory_unlock(hashtext('service-management-deploy'))").catch(() => {});
    await db.end();
    if (temporary) {
      if (path.dirname(path.resolve(temporary)) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('crm-baseline-')) throw new Error('Unexpected temporary migration path');
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
