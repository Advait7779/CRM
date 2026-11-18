const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { sheetConfig, configurationIssues, listFacebookTabs, readFacebookTab, analyzeFacebookTab, rowToLead, processFacebookSheetLeads, processAllFacebookSheetLeads } = require('../services/facebookSheetSync');

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
  assert.equal(sheetConfig({}).spreadsheetId, '16wyHLQBQcCqPTKKM3snje5xrAZqM4MF1vekrmzu9-VE');
  assert.equal(sheetConfig({}).sheetId, 1627876618);
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
    assert.equal(body.spreadsheetId, config.spreadsheetId);
    calls.push(body);
    if (body.action === 'listTabs') return { ok: true, json: async () => ({ success: true, spreadsheetId: config.spreadsheetId, tabs: [
      { gid: 1497736270, title: "Allinone Leads - Oct'26", index: 0, rowCount: 3, columnCount: 19 }
    ] }) };
    assert.equal(body.action, 'readTab');
    if (body.startRow === 1) return { ok: true, json: async () => ({ success: true, spreadsheetId: config.spreadsheetId, values: rows.slice(0, 2), nextRow: 3, hasMore: true }) };
    assert.equal(body.startRow, 3);
    return { ok: true, json: async () => ({ success: true, spreadsheetId: config.spreadsheetId, values: rows.slice(2), nextRow: 4, hasMore: false }) };
  };
  assert.equal((await listFacebookTabs(config, scriptFetch)).length, 1);
  const tab = await readFacebookTab(config, 1497736270, scriptFetch);
  assert.deepEqual(tab.values, rows);
  assert.equal(calls.filter(call => call.action === 'readTab').length, 2);
  await assert.rejects(readFacebookTab(config, 1497736270, async (_url, options) => {
    const body = JSON.parse(options.body);
    return body.action === 'listTabs'
      ? { ok: true, json: async () => ({ success: true, spreadsheetId: config.spreadsheetId, tabs: [{ gid: 1497736270, title: 'October', index: 0 }] }) }
      : { ok: true, json: async () => ({ success: true, spreadsheetId: config.spreadsheetId, values: [], nextRow: 1, hasMore: true }) };
  }), /invalid tab rows/);
});

test('reader for a retired workbook is rejected before its tabs are displayed', async () => {
  const config = sheetConfig({
    FACEBOOK_SHEET_WEBHOOK_URL: 'https://script.google.com/macros/s/test-retired-deployment/exec',
    FACEBOOK_SHEET_READ_SECRET: 'test-retired-script-secret-at-least-32-characters'
  });
  await assert.rejects(listFacebookTabs(config, async () => ({
    ok: true,
    json: async () => ({ success: true, spreadsheetId: 'retired-workbook', tabs: [{ gid: 1, title: 'Old tab', index: 0 }] })
  })), /different workbook/);
});

test('Apps Script tab chunks are fetched concurrently and kept in sheet order', async () => {
  const config = sheetConfig({
    FACEBOOK_SHEET_WEBHOOK_URL: 'https://script.google.com/macros/s/test-deployment/exec',
    FACEBOOK_SHEET_READ_SECRET: 'test-facebook-script-secret-at-least-32-characters'
  });
  let active = 0;
  let peak = 0;
  const scriptFetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.action === 'listTabs') return { ok: true, json: async () => ({ success: true, spreadsheetId: config.spreadsheetId, tabs: [
      { gid: 1497736270, title: 'Large tab', index: 0, rowCount: 751, columnCount: 1 }
    ] }) };
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolve => setImmediate(resolve));
    active -= 1;
    const count = Math.min(250, 752 - body.startRow);
    const values = Array.from({ length: count }, (_, index) => [String(body.startRow + index)]);
    return { ok: true, json: async () => ({ success: true, spreadsheetId: config.spreadsheetId, values,
      nextRow: body.startRow + count, hasMore: body.startRow + count <= 751 }) };
  };
  const tab = await readFacebookTab(config, 1497736270, scriptFetch);
  assert.equal(peak, 4);
  assert.equal(tab.values.length, 751);
  assert.deepEqual(tab.values.map(row => Number(row[0])), Array.from({ length: 751 }, (_, index) => index + 1));
});

test('updated Apps Script lists tabs once and reads 1000-row chunks', async () => {
  const config = sheetConfig({
    FACEBOOK_SHEET_WEBHOOK_URL: 'https://script.google.com/macros/s/test-updated-deployment/exec',
    FACEBOOK_SHEET_READ_SECRET: 'test-updated-script-secret-at-least-32-characters'
  });
  let listCalls = 0;
  const limits = [];
  const scriptFetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.action === 'listTabs') {
      listCalls += 1;
      return { ok: true, json: async () => ({ success: true, spreadsheetId: config.spreadsheetId, tabs: [
        { gid: 1497736270, title: 'Updated tab', index: 0, maxPageSize: 1000 }
      ] }) };
    }
    limits.push(body.limit);
    const count = Math.min(body.limit, 3002 - body.startRow);
    const values = Array.from({ length: count }, (_, index) => [String(body.startRow + index)]);
    return { ok: true, json: async () => ({ success: true, spreadsheetId: config.spreadsheetId, values,
      nextRow: body.startRow + count, lastRow: 3001, hasMore: body.startRow + count <= 3001 }) };
  };
  const tab = await readFacebookTab(config, 1497736270, scriptFetch);
  assert.equal(tab.values.length, 3001);
  assert.deepEqual(limits, [1000, 1000, 1000, 1000]);
  assert.equal(listCalls, 1);
  await listFacebookTabs(config, scriptFetch);
  assert.equal(listCalls, 1);
  await listFacebookTabs(config, scriptFetch, true);
  assert.equal(listCalls, 2);
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

test('new Computer Repair tab maps its service question', () => {
  const computerHeaders = headers.map(header => header === 'what_services_are_you_looking_for?'
    ? 'what_service_do_you_require?' : header);
  const tab = analyzeFacebookTab({ gid: 0, title: 'Computer Repair', values: [computerHeaders,
    ['l:301', '2026-11-17T08:55:31-05:00', '', '', '', '', '', '', '', '', 'false', 'ig',
      'data_recovery', 'Example Lead', 'p:+919000000003', '', 'Pune', 'CREATED']
  ] });
  assert.equal(tab.importable, true);
  assert.equal(rowToLead(tab.headers, tab.rows[0].values, tab).service, 'data recovery');
});

test('sync imports both platforms once and preserves CRM status on repeat scans', async () => {
  const saved = new Map();
  const links = new Set();
  const notifications = [];
  let notificationSetting;
  const sendCustomerNotifications = async (_prisma, lead) => { notifications.push(lead.facebookLeadId); };
  const prisma = { appSettings: {
    async findUnique() { return notificationSetting || null; },
    async create({ data }) { notificationSetting = data; return data; }
  }, facebookSheetRowStatuses: { async findMany() { return []; } }, leads: {
    async findMany({ where }) { return [...saved.values()].filter(lead => where.facebookLeadId.in.includes(lead.facebookLeadId)); },
    async createManyAndReturn({ data }) {
      const created = [];
      for (const lead of data) {
        if (saved.has(lead.facebookLeadId)) continue;
        const row = { ...lead, id: saved.size + 1 };
        saved.set(lead.facebookLeadId, row);
        created.push(row);
      }
      return created;
    },
    async create({ data }) {
      assert.equal(data.source, 'Facebook');
      const row = { ...data, id: saved.size + 1 };
      saved.set(data.facebookLeadId, row);
      return row;
    }
  }, facebookLeadTabs: { async createMany({ data }) {
    let count = 0;
    for (const link of data) {
      const key = `${link.sheetGid}:${link.externalLeadId}`;
      if (!links.has(key)) { links.add(key); count += 1; }
    }
    return { count };
  } } };
  const first = await processFacebookSheetLeads(prisma, { env, fetchImpl: fakeFetch, sendCustomerNotifications });
  assert.equal(first.imported, 2);
  assert.equal(first.mapped, 2);
  assert.equal(first.notificationsQueued, 0, 'existing sheet rows are not messaged at activation');
  assert.deepEqual([...saved.keys()], ['l:101', 'l:102']);
  saved.get('l:102').status = 'Connected';
  const second = await processFacebookSheetLeads(prisma, { env, fetchImpl: fakeFetch, sendCustomerNotifications });
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
  const third = await processFacebookSheetLeads(prisma, { env, fetchImpl: anotherTabFetch, gid: 44413567, sendCustomerNotifications });
  assert.equal(third.imported, 0);
  assert.equal(third.mapped, 1);
  assert.equal(saved.size, 2);
  assert.equal(saved.get('l:102').status, 'Connected');

  const fresh = [...rows[1]];
  fresh[0] = 'l:103';
  fresh[1] = new Date(Date.now() + 1000).toISOString();
  const unclassified = [...fresh];
  unclassified[0] = 'l:104';
  unclassified[12] = 'other';
  const freshFetch = async (url, options) => url.includes('/values/')
    ? { ok: true, json: async () => ({ values: [headers, ...rows.slice(1), fresh, unclassified] }) }
    : fakeFetch(url, options);
  const fourth = await processFacebookSheetLeads(prisma, { env, fetchImpl: freshFetch, sendCustomerNotifications });
  assert.equal(fourth.imported, 2);
  assert.equal(fourth.notificationsQueued, 1);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(notifications, ['l:103']);
  const fifth = await processFacebookSheetLeads(prisma, { env, fetchImpl: freshFetch, sendCustomerNotifications });
  assert.equal(fifth.notificationsQueued, 0);
  assert.deepEqual(notifications, ['l:103']);
});

test('changed sheet headers stop the sync before any writes', async () => {
  const badFetch = async (url, options) => {
    const result = await fakeFetch(url, options);
    if (url.includes('/values/')) return { ok: true, json: async () => ({ values: [['wrong', ...headers.slice(1)], ...rows.slice(1)] }) };
    return result;
  };
  await assert.rejects(processFacebookSheetLeads({
    appSettings: { async findUnique() { return { value: new Date().toISOString() }; } }, leads: {}
  }, { env, fetchImpl: badFetch }), /header layout/);
});

test('automatic sync imports every Meta tab and leaves historical tabs read-only', async () => {
  const saved = new Map();
  let valueReads = 0;
  const allTabsFetch = async (url, options) => {
    if (url === 'https://oauth2.googleapis.com/token') return fakeFetch(url, options);
    if (url.includes('?fields=')) return { ok: true, json: async () => ({ sheets: [
      { properties: { sheetId: 10, title: 'Computer Repair', index: 0, gridProperties: { columnCount: 26 } } },
      { properties: { sheetId: 11, title: 'GPS Tracker', index: 1, gridProperties: { columnCount: 26 } } },
      { properties: { sheetId: 12, title: 'Historical', index: 2, gridProperties: { columnCount: 26 } } }
    ] }) };
    valueReads += 1;
    const title = decodeURIComponent(url);
    const lead = [...rows[1]];
    lead[0] = title.includes('GPS Tracker') ? 'l:402' : 'l:401';
    return { ok: true, json: async () => ({ values: title.includes('Historical')
      ? [['Date', 'full_name', 'phone_number'], ['11-16-26', 'Old Lead', '919000000002']]
      : [headers, lead] }) };
  };
  const prisma = {
    appSettings: { async findUnique() { return { value: new Date().toISOString() }; } },
    facebookSheetRowStatuses: { async findMany() { return []; } },
    leads: {
      async findMany({ where }) { return [...saved.values()].filter(row => where.facebookLeadId.in.includes(row.facebookLeadId)); },
      async createManyAndReturn({ data }) {
        const created = data.map(row => ({ ...row, id: saved.size + 1 }));
        for (const row of created) saved.set(row.facebookLeadId, row);
        return created;
      }
    },
    facebookLeadTabs: { async createMany({ data }) { return { count: data.length }; } }
  };
  const result = await processAllFacebookSheetLeads(prisma, { env, fetchImpl: allTabsFetch,
    sendCustomerNotifications: async () => { throw new Error('Historical leads must not be messaged'); } });
  assert.equal(result.imported, 2);
  assert.equal(result.notificationsQueued, 0);
  assert.deepEqual([...saved.keys()], ['l:401', 'l:402']);
  assert.equal(valueReads, 3, 'each tab is fetched only once');
});

test('new Meta layouts map safely while historical tabs remain read-only', () => {
  const gpsHeader = [...headers.slice(0, 12), 'are_you_looking_to_buy_gps_tracking_device?', 'for_which_tracking_device_you_are_looking_to_buy?', 'full_name', 'phone_number', 'city', 'lead_status'];
  const gpsRow = [...rows[1].slice(0, 12), 'yes', 'four_wheeler_tracking_device', 'GPS customer', 'p:+919000000003', 'Pune', 'CREATED'];
  const gps = analyzeFacebookTab({ gid: 44413567, title: "GPS-Oct'26", values: [gpsHeader, gpsRow] });
  assert.equal(gps.importable, true);
  assert.equal(rowToLead(gps.headers, gps.rows[0].values, gps).service, 'GPS Tracking');
  assert.equal(rowToLead(gps.headers, gps.rows[0].values, gps).name, 'GPS customer');

  const historical = analyzeFacebookTab({ gid: 1564797242, title: "GPS-Tracker(1-16th Nov'26)", values: [
    ['Date', 'are_you_looking_to_buy_gps_tracking_device?', 'full_name', 'phone_number', 'city'],
    ['11-16-26', 'yes', 'Example Lead', '919000000003', 'Pune']
  ] });
  assert.equal(historical.importable, false);
  assert.equal(historical.headers[0], 'Date');
  assert.equal(historical.rows.length, 1);
  assert.equal(historical.rows[0].rowNumber, 2);
  assert.equal(analyzeFacebookTab({ gid: 2099327806, title: 'Sheet20', values: [] }).kind, 'empty');
});
