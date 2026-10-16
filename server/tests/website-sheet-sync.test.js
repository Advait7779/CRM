const test = require('node:test');
const assert = require('node:assert/strict');
const { processWebsiteSheetLeads, sheetConfig, isConfigured, configurationIssues } = require('../services/websiteSheetSync');

const env = {
  WEBSITE_SHEET_WEBHOOK_URL: 'https://script.google.com/macros/s/test-deployment/exec',
  WEBSITE_SHEET_READ_SECRET: 'test-read-secret-at-least-32-characters',
  WEBSITE_SHEET_START_AFTER_ID: '42'
};
const headers = ['ID', 'Name', 'Phone', 'Email', 'Service', 'Source Form', 'Status', 'Message', 'Date'];

function fakeFetch(rows) {
  return async (url, options) => {
    assert.equal(url, env.WEBSITE_SHEET_WEBHOOK_URL);
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    assert.equal(body.action, 'readLeads');
    assert.equal(body.secret, env.WEBSITE_SHEET_READ_SECRET);
    return {
      ok: true,
      json: async () => ({ success: true, headers, rows: rows.slice(1).filter(row => Number(row[0]) > body.afterId), hasMore: false })
    };
  };
}

test('sheet sync requires a starting ID and a secure Apps Script read secret', () => {
  assert.equal(isConfigured(sheetConfig({ ...env, WEBSITE_SHEET_START_AFTER_ID: '' })), false);
  assert.equal(isConfigured(sheetConfig({ ...env, WEBSITE_SHEET_READ_SECRET: '' })), false);
  assert.equal(isConfigured(sheetConfig({ ...env, WEBSITE_SHEET_WEBHOOK_URL: 'http://script.google.com/macros/s/test/exec' })), false);
  assert.equal(isConfigured(sheetConfig(env)), true);
});

test('disabled sync identifies invalid settings without logging their values', () => {
  const issues = configurationIssues(sheetConfig({
    WEBSITE_SHEET_WEBHOOK_URL: 'https://example.com/private-webhook',
    WEBSITE_SHEET_READ_SECRET: 'short-private-secret',
    WEBSITE_SHEET_START_AFTER_ID: 'not-an-id'
  }));
  assert.equal(issues.length, 3);
  assert.match(issues.join(' '), /WEBSITE_SHEET_WEBHOOK_URL/);
  assert.match(issues.join(' '), /WEBSITE_SHEET_READ_SECRET/);
  assert.match(issues.join(' '), /WEBSITE_SHEET_START_AFTER_ID/);
  assert.doesNotMatch(issues.join(' '), /private-webhook|private-secret/);
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
  const fetchImpl = async () => ({ ok: true, json: async () => ({ success: true, headers: ['Bad header', ...headers.slice(1)], rows: [], hasMore: false }) });
  await assert.rejects(processWebsiteSheetLeads({ leads: {} }, { env, fetchImpl }), /layout/);
});

test('sheet webhook pages through more than 250 new leads', async () => {
  const { readWebsiteRows } = require('../services/websiteSheetSync');
  const rows = Array.from({ length: 251 }, (_, index) => [43 + index, 'Name', '9000000000', '', 'CCTV', 'Contact', 'New', '', '2026-10-15T05:00:00.000Z']);
  let calls = 0;
  const fetchImpl = async (_url, options) => {
    const { afterId } = JSON.parse(options.body);
    const page = rows.filter(row => row[0] > afterId).slice(0, 250);
    calls += 1;
    return { ok: true, json: async () => ({ success: true, headers, rows: page, hasMore: rows.some(row => row[0] > page.at(-1)?.[0]) }) };
  };
  const result = await readWebsiteRows(sheetConfig(env), fetchImpl);
  assert.equal(result.length, 251);
  assert.equal(calls, 2);
});
