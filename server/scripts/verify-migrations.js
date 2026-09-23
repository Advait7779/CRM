// Rehearse migrations in a transaction-local schema. Never migrate business tables.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
const { Prisma } = require('@prisma/client');
const { getDatabaseUrl } = require('../config/databaseUrl');

(async () => {
  const schema = 'crm_migration_check_' + crypto.randomBytes(8).toString('hex');
  const db = new Client({ connectionString: getDatabaseUrl(),
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' } } : {}) });
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query('CREATE SCHEMA "' + schema + '"');
    await db.query('SET LOCAL search_path TO "' + schema + '"');
    const root = path.join(__dirname, '../prisma/migrations');
    const names = fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    const baseline = '20260729_prisma_baseline';
    const migrations = [baseline, ...names.filter(name => name !== baseline)];
    for (const migration of migrations) {
      const sql = fs.readFileSync(path.join(root, migration, 'migration.sql'), 'utf8');
      // The baseline's public-schema declaration is unnecessary in this rehearsal.
      const isolated = sql.replace('CREATE SCHEMA IF NOT EXISTS "public";', '');
      if (/\bpublic\s*\.|"public"\s*\.|\b(?:BEGIN|COMMIT|ROLLBACK)\s*;/i.test(isolated)) throw new Error('Migration needs manual isolation review: ' + migration);
      await db.query(isolated);
      console.log('Applied in isolated schema:', migration);
    }
    const { rows } = await db.query('SELECT table_name, column_name FROM information_schema.columns WHERE table_schema=$1', [schema]);
    const missing = [];
    for (const model of Prisma.dmmf.datamodel.models) {
      for (const field of model.fields.filter(item => item.kind !== 'object')) {
        if (!rows.some(row => row.table_name === (model.dbName || model.name) && row.column_name === (field.dbName || field.name))) missing.push(model.name + '.' + field.name);
      }
    }
    if (missing.length) throw new Error('Missing migration coverage: ' + missing.join(', '));
    console.log('All Prisma model columns exist after a fresh migration.');
  } finally {
    await db.query('ROLLBACK');
    await db.end();
    console.log('Rehearsal rolled back; business tables were not changed.');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
