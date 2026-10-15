const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { processWebsiteSheetLeads, sheetConfig, isConfigured } = require('../services/websiteSheetSync');

const privateKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const env = {
  WEBSITE_SHEET_SPREADSHEET_ID: 'test-spreadsheet',
  WEBSITE_SHEET_TAB_NAME: 'Website Cms',
  WEBSITE_SHEET_CLIENT_EMAIL: 'reader@example.iam.gserviceaccount.com',
  WEBSITE_SHEET_PRIVATE_KEY: privateKey,
  WEBSITE_SHEET_START_AFTER_ID: '42'
};
const headers = ['ID', 'Name', 'Phone', 'Email', 'Service', 'Source Form', 'Status', 'Message', 'Date'];

function fakeFetch(rows) {
  return async (url, options) => {
    if (String(url).includes('oauth2.googleapis.com/token')) {
      assert.match(String(options.body), /jwt-bearer/);
      return { ok: true, json: async () => ({ access_token: 'test-access-token' }) };
    }
    assert.match(String(url), /sheets.googleapis.com/);
    assert.match(String(url), /Website%20Cms/);
    assert.equal(options.headers.Authorization, 'Bearer test-access-token');
    return { ok: true, json: async () => ({ values: rows }) };
  };
}

test('sheet sync requires a starting ID and Google credentials before running', () => {
  assert.equal(isConfigured(sheetConfig({ ...env, WEBSITE_SHEET_START_AFTER_ID: '' })), false);
  assert.equal(isConfigured(sheetConfig(env)), true);
});

test('sheet sync imports only IDs after activation and keeps CRM status on repeat scans', async () => {
  const saved = new Map();
  const prisma = {
    leads: {
      async findMany({ where }) {
        return [...saved.values()].filter(lead => where.websiteLeadId.in.includes(lead.websiteLeadId));
      },
      async create({ data }) {
        if (saved.has(data.websiteLeadId)) throw Object.assign(new Error('duplicate'), { code: 'P2002' });
        const lead = { id: saved.size + 1, ...data };
        saved.set(data.websiteLeadId, lead);
        return lead;
      },
      async findUnique({ where }) { return saved.get(where.websiteLeadId) || null; }
    },
    users: { async findMany() { return []; } },
    notifications: { async createMany() { throw new Error('Unexpected notification'); } }
  };
  const rows = [
    headers,
    [42, 'Old lead', '9000000000', '', 'CCTV', 'Contact', 'New', '', '2026-10-15T04:00:00.000Z'],
    [43, 'New lead', '9000000001', 'new@example.com', 'Website Design & Development', 'Popup Free Demo Modal', 'New', 'Please call', '2026-10-15T04:30:00.000Z']
  ];
  const options = { env, fetchImpl: fakeFetch(rows) };
  const first = await processWebsiteSheetLeads(prisma, options);
  assert.equal(first.imported, 1);
  assert.equal(saved.size, 1);
  const lead = saved.get('43');
  assert.equal(lead.source, 'Website');
  assert.equal(lead.justdialProduct, 'Website Development');
  assert.equal(lead.websiteFormSource, 'Popup Free Demo Modal');
  assert.equal(lead.websiteSubmittedAt.toISOString(), '2026-10-15T04:30:00.000Z');
  lead.status = 'Connected';
  const second = await processWebsiteSheetLeads(prisma, options);
  assert.equal(second.imported, 0);
  assert.equal(saved.size, 1);
  assert.equal(lead.status, 'Connected');
});

test('a malformed new row is skipped without blocking the next valid row', async () => {
  const saved = [];
  const prisma = {
    leads: {
      async findMany() { return []; },
      async create({ data }) { saved.push(data); return { id: saved.length, ...data }; }
    },
    users: { async findMany() { return []; } }
  };
  const rows = [
    headers,
    [43, 'Incomplete', '', '', 'CCTV', 'Contact', 'New', '', '2026-10-15T05:00:00.000Z'],
    [44, 'Valid', '9000000002', '', 'CCTV', 'Contact', 'New', '', '2026-10-15T05:01:00.000Z']
  ];
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await processWebsiteSheetLeads(prisma, { env, fetchImpl: fakeFetch(rows) });
    assert.equal(result.imported, 1);
    assert.equal(result.skipped, 1);
    assert.equal(saved[0].websiteLeadId, '44');
  } finally {
    console.error = originalError;
  }
});

test('sheet header mismatch stops import', async () => {
  const rows = [['Bad header', ...headers.slice(1)]];
  await assert.rejects(processWebsiteSheetLeads({ leads: {} }, { env, fetchImpl: fakeFetch(rows) }), /headers/);
});
