const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { sheetConfig, configurationIssues, rowToLead, processFacebookSheetLeads } = require('../services/facebookSheetSync');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  FACEBOOK_SHEET_CLIENT_EMAIL: 'crm-test@example.gserviceaccount.com',
  FACEBOOK_SHEET_PRIVATE_KEY: privateKey.export({ format: 'pem', type: 'pkcs8' }),
  FACEBOOK_SHEET_SPREADSHEET_ID: 'test-spreadsheet',
  FACEBOOK_SHEET_GID: '1497736270'
};
const headers = [
  'id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name',
  'campaign_id', 'campaign_name', 'form_id', 'form_name', 'is_organic',
  'platform', 'what_services_are_you_looking_for?', 'full_name',
  'phone_number', 'email', 'city', 'lead_status', 'Sales note'
];
const rows = [
  headers,
  ['l:102', '2026-10-26T22:04:23+05:30', '', '', '', '', '', 'October campaign', '', 'Lead form', 'false', 'ig', 'whatsapp_api_for_business', 'Newer lead', 'p:+919000000002', 'newer@example.com', 'Pune', 'CREATED', 'Asked for details'],
  ['l:101', '2026-10-26T15:56:05+05:30', '', '', '', '', '', 'October campaign', '', 'Lead form', 'false', 'fb', 'sms_marketing', 'Older lead', 'p:+919000000001', '', 'Mumbai', 'CREATED', 'Call later']
];

function fakeFetch(url, options) {
  if (url === 'https://oauth2.googleapis.com/token') {
    const claim = JSON.parse(Buffer.from(String(options.body.get('assertion')).split('.')[1], 'base64url'));
    assert.equal(claim.scope, 'https://www.googleapis.com/auth/spreadsheets.readonly');
    return Promise.resolve({ ok: true, json: async () => ({ access_token: 'test-token', expires_in: 3600 }) });
  }
  assert.equal(options.headers.Authorization, 'Bearer test-token');
  if (url.includes('?fields=')) return Promise.resolve({ ok: true, json: async () => ({ sheets: [{ properties: { sheetId: 1497736270, title: "Allinone Leads - Oct'26" } }] }) });
  assert.match(decodeURIComponent(url), /Allinone Leads - Oct''26'!A1:Z/);
  return Promise.resolve({ ok: true, json: async () => ({ values: rows }) });
}

test('configuration requires server-only service account credentials', () => {
  assert.deepEqual(configurationIssues(sheetConfig(env)), []);
  assert.match(configurationIssues(sheetConfig({})).join(' '), /CLIENT_EMAIL/);
  assert.match(configurationIssues(sheetConfig({})).join(' '), /PRIVATE_KEY/);
});

test('mapping preserves source date and platform, normalizes phone and service', () => {
  const lead = rowToLead(headers, rows[1]);
  assert.equal(lead.facebookLeadId, 'l:102');
  assert.equal(lead.facebookSubmittedAt.toISOString(), '2026-10-26T16:34:23.000Z');
  assert.equal(lead.phone, '+919000000002');
  assert.equal(lead.source, 'Facebook');
  assert.equal(lead.facebookPlatform, 'ig');
  assert.equal(lead.justdialProduct, 'WhatsApp WABA');
  assert.match(lead.notes, /Asked for details/);
});

test('sync imports both platforms once and preserves CRM status on repeat scans', async () => {
  const saved = new Map();
  const prisma = { leads: {
    async findMany({ where }) { return [...saved.values()].filter(lead => where.facebookLeadId.in.includes(lead.facebookLeadId)); },
    async create({ data }) {
      assert.equal(data.source, 'Facebook');
      saved.set(data.facebookLeadId, { ...data, id: saved.size + 1 });
    }
  } };
  const first = await processFacebookSheetLeads(prisma, { env, fetchImpl: fakeFetch });
  assert.equal(first.imported, 2);
  assert.deepEqual([...saved.keys()], ['l:101', 'l:102']);
  saved.get('l:102').status = 'Connected';
  const second = await processFacebookSheetLeads(prisma, { env, fetchImpl: fakeFetch });
  assert.equal(second.imported, 0);
  assert.equal(saved.get('l:102').status, 'Connected');
});

test('changed sheet headers stop the sync before any writes', async () => {
  const badFetch = async (url, options) => {
    const result = await fakeFetch(url, options);
    if (url.includes('/values/')) return { ok: true, json: async () => ({ values: [['wrong', ...headers.slice(1)], ...rows.slice(1)] }) };
    return result;
  };
  await assert.rejects(processFacebookSheetLeads({ leads: {} }, { env, fetchImpl: badFetch }), /header layout changed/);
});
