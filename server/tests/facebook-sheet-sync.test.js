const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { sheetConfig, configurationIssues, listFacebookTabs, readFacebookTab, analyzeFacebookTab, rowToLead, processFacebookSheetLeads } = require('../services/facebookSheetSync');

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
  assert.match(configurationIssues(sheetConfig({})).join(' '), /WEBHOOK_URL/);
  assert.match(configurationIssues(sheetConfig({ FACEBOOK_SHEET_CLIENT_EMAIL: env.FACEBOOK_SHEET_CLIENT_EMAIL })).join(' '), /PRIVATE_KEY/);
});

test('Apps Script connection lists tabs and reads paged rows without a service account key', async () => {
  const scriptEnv = {
    FACEBOOK_SHEET_WEBHOOK_URL: 'https://script.google.com/macros/s/test-deployment/exec',
    FACEBOOK_SHEET_READ_SECRET: 'test-facebook-script-secret-at-least-32-characters'
  };
  const config = sheetConfig(scriptEnv);
  assert.deepEqual(configurationIssues(config), []);
  assert.match(configurationIssues(sheetConfig({ FACEBOOK_SHEET_WEBHOOK_URL: scriptEnv.FACEBOOK_SHEET_WEBHOOK_URL })).join(' '), /READ_SECRET/);
  const calls = [];
  const scriptFetch = async (url, options) => {
    assert.equal(url, scriptEnv.FACEBOOK_SHEET_WEBHOOK_URL);
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    assert.equal(body.secret, scriptEnv.FACEBOOK_SHEET_READ_SECRET);
    calls.push(body);
    if (body.action === 'listTabs') return { ok: true, json: async () => ({ success: true, tabs: [
      { gid: 1497736270, title: "Allinone Leads - Oct'26", index: 0, rowCount: 3, columnCount: 19 }
    ] }) };
    assert.equal(body.action, 'readTab');
    if (body.startRow === 1) return { ok: true, json: async () => ({ success: true, values: rows.slice(0, 2), nextRow: 3, hasMore: true }) };
    assert.equal(body.startRow, 3);
    return { ok: true, json: async () => ({ success: true, values: rows.slice(2), nextRow: 4, hasMore: false }) };
  };
  assert.equal((await listFacebookTabs(config, scriptFetch)).length, 1);
  const tab = await readFacebookTab(config, 1497736270, scriptFetch);
  assert.deepEqual(tab.values, rows);
  assert.equal(calls.filter(call => call.action === 'readTab').length, 2);
  await assert.rejects(readFacebookTab(config, 1497736270, async (_url, options) => {
    const body = JSON.parse(options.body);
    return body.action === 'listTabs'
      ? { ok: true, json: async () => ({ success: true, tabs: [{ gid: 1497736270, title: 'October', index: 0 }] }) }
      : { ok: true, json: async () => ({ success: true, values: [], nextRow: 1, hasMore: true }) };
  }), /invalid tab rows/);
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
  const links = new Set();
  const prisma = { leads: {
    async findMany({ where }) { return [...saved.values()].filter(lead => where.facebookLeadId.in.includes(lead.facebookLeadId)); },
    async createMany({ data }) {
      let count = 0;
      for (const lead of data) {
        if (saved.has(lead.facebookLeadId)) continue;
        saved.set(lead.facebookLeadId, { ...lead, id: saved.size + 1 });
        count += 1;
      }
      return { count };
    },
    async create({ data }) {
      assert.equal(data.source, 'Facebook');
      saved.set(data.facebookLeadId, { ...data, id: saved.size + 1 });
    }
  }, facebookLeadTabs: { async createMany({ data }) {
    let count = 0;
    for (const link of data) {
      const key = `${link.sheetGid}:${link.externalLeadId}`;
      if (!links.has(key)) { links.add(key); count += 1; }
    }
    return { count };
  } } };
  const first = await processFacebookSheetLeads(prisma, { env, fetchImpl: fakeFetch });
  assert.equal(first.imported, 2);
  assert.equal(first.mapped, 2);
  assert.deepEqual([...saved.keys()], ['l:101', 'l:102']);
  saved.get('l:102').status = 'Connected';
  const second = await processFacebookSheetLeads(prisma, { env, fetchImpl: fakeFetch });
  assert.equal(second.imported, 0);
  assert.equal(second.mapped, 0);
  assert.equal(saved.get('l:102').status, 'Connected');

  const anotherTabFetch = async (url, options) => {
    if (url.includes('?fields=')) return { ok: true, json: async () => ({ sheets: [
      { properties: { sheetId: 44413567, title: "GPS-Oct'26", gridProperties: { columnCount: 26 } } }
    ] }) };
    if (url.includes('/values/')) return { ok: true, json: async () => ({ values: [headers, rows[1]] }) };
    return fakeFetch(url, options);
  };
  const third = await processFacebookSheetLeads(prisma, { env, fetchImpl: anotherTabFetch, gid: 44413567 });
  assert.equal(third.imported, 0);
  assert.equal(third.mapped, 1);
  assert.equal(saved.size, 2);
  assert.equal(saved.get('l:102').status, 'Connected');
});

test('changed sheet headers stop the sync before any writes', async () => {
  const badFetch = async (url, options) => {
    const result = await fakeFetch(url, options);
    if (url.includes('/values/')) return { ok: true, json: async () => ({ values: [['wrong', ...headers.slice(1)], ...rows.slice(1)] }) };
    return result;
  };
  await assert.rejects(processFacebookSheetLeads({ leads: {} }, { env, fetchImpl: badFetch }), /header layout/);
});

test('different Meta tab layouts map safely while non-sales and empty tabs stay read-only', () => {
  const gpsHeader = [...headers.slice(0, 12), 'are_you_looking_to_buy_gps_tracking_device?', 'for_which_tracking_device_you_are_looking_to_buy?', 'full_name', 'phone_number', 'city', 'lead_status'];
  const gpsRow = [...rows[1].slice(0, 12), 'yes', 'four_wheeler_tracking_device', 'GPS customer', 'p:+919000000003', 'Pune', 'CREATED'];
  const gps = analyzeFacebookTab({ gid: 44413567, title: "GPS-Oct'26", values: [gpsHeader, gpsRow] });
  assert.equal(gps.importable, true);
  assert.equal(rowToLead(gps.headers, gps.rows[0].values, gps).service, 'GPS Tracking');
  assert.equal(rowToLead(gps.headers, gps.rows[0].values, gps).name, 'GPS customer');

  const headerless = analyzeFacebookTab({ gid: 1146694168, title: 'AI Kalyan', values: [rows[1].slice(0, 18)] });
  assert.equal(headerless.importable, true);
  assert.equal(headerless.rows[0].rowNumber, 1);

  const job = analyzeFacebookTab({ gid: 1248816267, title: 'GPS Installation Job', values: [gpsHeader, gpsRow] });
  assert.equal(job.importable, false);
  assert.equal(analyzeFacebookTab({ gid: 2099327806, title: 'Sheet20', values: [] }).kind, 'empty');
});
