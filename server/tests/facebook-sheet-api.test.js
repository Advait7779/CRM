const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const ExcelJS = require('exceljs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'facebook-sheet-api-test-secret-at-least-32-characters';

const config = require('../config/prisma');
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  FACEBOOK_SHEET_CLIENT_EMAIL: 'crm-test@example.gserviceaccount.com',
  FACEBOOK_SHEET_PRIVATE_KEY: privateKey.export({ format: 'pem', type: 'pkcs8' }),
  FACEBOOK_SHEET_SPREADSHEET_ID: 'test-spreadsheet', FACEBOOK_SHEET_GID: '1497736270'
};
const users = new Map([
  [1, { id: 1, role: 'super_admin', tokenVersion: 0, justdialProducts: [] }],
  [2, { id: 2, role: 'sales_executive', tokenVersion: 0, justdialProducts: ['WhatsApp WABA'] }],
  [3, { id: 3, role: 'accounts', tokenVersion: 0, justdialProducts: [] }]
]);
const saved = new Map();
const links = new Set();
const prisma = {
  users: { async findUnique({ where }) { return users.get(where.id) || null; } },
  leads: {
    async findMany({ where, skip = 0, take = 10000 }) {
      let rows = [...saved.values()];
      if (where?.facebookLeadId?.in) rows = rows.filter(row => where.facebookLeadId.in.includes(row.facebookLeadId));
      if (where?.source) rows = rows.filter(row => row.source === where.source);
      if (where?.justdialProduct?.in) rows = rows.filter(row => where.justdialProduct.in.includes(row.justdialProduct));
      return rows.slice(skip, skip + take);
    },
    async count({ where }) { return (await this.findMany({ where })).length; },
    async createMany({ data }) {
      let count = 0;
      for (const row of data) {
        if (saved.has(row.facebookLeadId)) continue;
        saved.set(row.facebookLeadId, { ...row, id: saved.size + 1 });
        count += 1;
      }
      return { count };
    }
  },
  facebookLeadTabs: {
    async createMany({ data }) {
      let count = 0;
      for (const row of data) {
        const key = `${row.sheetGid}:${row.externalLeadId}`;
        if (!links.has(key)) { links.add(key); count += 1; }
      }
      return { count };
    },
    async count({ where }) { return [...links].filter(key => key.startsWith(`${where.sheetGid}:`)).length; }
  }
};
require.cache[require.resolve('../config/prisma')].exports = { ...config, prisma };
const { createFacebookSheetRouter } = require('../routes/facebookSheet');

const metaHeader = ['id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name', 'form_id', 'form_name', 'is_organic', 'platform', 'what_services_are_you_looking_for?', 'full_name', 'phone_number', 'email', 'city', 'lead_status'];
const metaRows = [metaHeader,
  ['l:201', '2026-10-26T22:04:23+05:30', '', '', '', '', '', '', '', '', 'false', 'ig', 'whatsapp_api_for_business', 'WhatsApp customer', 'p:+919000000001', '', 'Pune', 'CREATED'],
  ['l:202', '2026-10-26T21:04:23+05:30', '', '', '', '', '', '', '', '', 'false', 'fb', 'sms_marketing', 'SMS customer', 'p:+919000000002', '', 'Mumbai', 'CREATED']
];
const otherRows = [['ID', 'Name', 'Phone'], ['42', 'Website customer', '9000000000']];
let sheetReads = 0;
let tabListReads = 0;
async function fakeFetch(url) {
  if (url === 'https://oauth2.googleapis.com/token') return { ok: true, json: async () => ({ access_token: 'test-token', expires_in: 3600 }) };
  if (url.includes('?fields=')) { tabListReads += 1; return { ok: true, json: async () => ({ sheets: [
    { properties: { sheetId: 1497736270, title: "Allinone Leads - Oct'26", index: 0, gridProperties: { columnCount: 26 } } },
    { properties: { sheetId: 590930498, title: 'Website Cms', index: 1, gridProperties: { columnCount: 26 } } }
  ] }) }; }
  const decoded = decodeURIComponent(url);
  sheetReads += 1;
  return { ok: true, json: async () => ({ values: decoded.includes('Website Cms') ? otherRows : metaRows }) };
}

test('tab browsing respects sales permissions; only admins can sync mapped Meta tabs', async t => {
  const app = express();
  app.use(express.json());
  app.use('/api/facebook-sheet', createFacebookSheetRouter(prisma, { env, fetchImpl: fakeFetch, prewarm: false }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const request = async (id, path, method = 'GET') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/facebook-sheet${path}`, {
      method, headers: { Authorization: `Bearer ${jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET)}` }
    });
    return { status: response.status, body: await response.json() };
  };

  assert.equal((await request(3, '/tabs')).status, 403);
  const tabs = await request(1, '/tabs');
  assert.equal(tabs.status, 200);
  assert.equal(tabs.body.tabs.length, 2);
  assert.equal((await request(1, '/tabs')).status, 200);
  assert.equal(tabListReads, 1);
  assert.equal((await request(1, '/tabs?refresh=1')).status, 200);
  assert.equal(tabListReads, 2);
  const meta = await request(2, '/tabs/1497736270');
  assert.equal(meta.status, 200);
  assert.equal(meta.body.total, 1);
  assert.equal(meta.body.rows[0].lead.name, 'WhatsApp customer');
  const firstReadCount = sheetReads;
  assert.equal((await request(2, '/tabs/1497736270?page=2')).status, 200);
  assert.equal(sheetReads, firstReadCount);
  assert.equal((await request(2, '/tabs/1497736270?refresh=1')).status, 200);
  assert.equal(sheetReads, firstReadCount + 1);
  assert.equal((await request(2, '/tabs/590930498')).status, 403);
  assert.equal((await request(1, '/tabs/590930498')).body.total, 1);
  assert.equal((await request(2, '/tabs/1497736270/sync', 'POST')).status, 403);
  assert.equal((await request(1, '/tabs/590930498/sync', 'POST')).status, 422);

  const synced = await request(1, '/tabs/1497736270/sync', 'POST');
  assert.equal(synced.status, 200);
  assert.equal(synced.body.imported, 2);
  assert.equal(synced.body.mapped, 2);
  assert.equal((await request(1, '/crm')).body.total, 2);
  assert.equal((await request(2, '/crm')).body.total, 1);

  const exportResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/facebook-sheet/tabs/1497736270/export.xlsx`, {
    headers: { Authorization: `Bearer ${jwt.sign({ id: 2, tokenVersion: 0 }, process.env.JWT_SECRET)}` }
  });
  assert.equal(exportResponse.status, 200);
  const workbook = await new ExcelJS.Workbook().xlsx.load(Buffer.from(await exportResponse.arrayBuffer()));
  const sheet = workbook.getWorksheet('Sheet rows');
  const nameColumn = sheet.getRow(1).values.indexOf('full_name');
  assert.equal(sheet.getRow(2).getCell(nameColumn).value, 'WhatsApp customer');
  assert.equal(sheet.getRow(3).getCell(nameColumn).value, null);
});

test('opening the tab picker warms sheet rows before a tab is selected', async t => {
  let reads = 0;
  const warmFetch = async (url, options) => {
    if (url.includes('/values/')) reads += 1;
    return fakeFetch(url, options);
  };
  const app = express();
  app.use('/api/facebook-sheet', createFacebookSheetRouter(prisma, { env, fetchImpl: warmFetch }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const token = jwt.sign({ id: 1, tokenVersion: 0 }, process.env.JWT_SECRET);
  const request = path => fetch(`http://127.0.0.1:${server.address().port}/api/facebook-sheet${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal((await request('/tabs')).status, 200);
  for (let attempt = 0; reads < 2 && attempt < 20; attempt += 1) await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads, 2);
  assert.equal((await request('/tabs/1497736270')).status, 200);
  assert.equal(reads, 2);
});
