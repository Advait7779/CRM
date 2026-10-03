const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'justdial-api-access-test-secret-only';

const config = require('../config/prisma');
const { Prisma } = config;
const users = [
  { id: 1, name: 'Admin', role: 'super_admin', email: 'admin@example.test', tokenVersion: 0, justdialProducts: [] },
  { id: 2, name: 'CCTV', role: 'sales_executive', email: 'cctv@example.test', tokenVersion: 0, justdialProducts: ['CCTV'] },
  { id: 3, name: 'GPS', role: 'sales_executive', email: 'gps@example.test', tokenVersion: 0, justdialProducts: ['GPS & Fuel Sensor'] },
  { id: 4, name: 'CCTV too', role: 'sales_manager', email: 'cctv2@example.test', tokenVersion: 0, justdialProducts: ['CCTV'] }
];
const leads = [
  { id: 11, name: 'Camera enquiry', phone: '9000000011', source: 'Justdial', service: 'CCTV Installation', justdialProduct: 'CCTV', createdAt: new Date() },
  { id: 12, name: 'Vehicle enquiry', phone: '9000000012', source: 'Justdial', service: 'GPS Tracking', justdialProduct: 'GPS & Fuel Sensor', createdAt: new Date() },
  { id: 13, name: 'Unclear enquiry', phone: '9000000013', source: 'Justdial', service: 'Generator Dealer', justdialProduct: 'Unclassified', createdAt: new Date() },
  { id: 14, name: 'Website lead', phone: '9000000014', source: 'Website', service: 'Website', justdialProduct: null, createdAt: new Date() }
];
const settings = new Map();
const prisma = {
  users: { async findUnique({ where }) { return users.find(user => user.id === where.id) || null; } },
  leads: {
    async findMany({ where }) {
      const access = where.OR?.find(clause => clause.source === 'Justdial');
      return leads.filter(lead => !access || lead.source !== 'Justdial' || access.justdialProduct.in.includes(lead.justdialProduct));
    },
    async findUnique({ where }) { return leads.find(lead => lead.id === where.id) || null; }
  },
  appSettings: {
    async findMany({ where }) { return where.key.in.filter(key => settings.has(key)).map(key => ({ key, value: settings.get(key) })); },
    async upsert({ where, create, update }) { settings.set(where.key, settings.has(where.key) ? update.value : create.value); return { key: where.key, value: settings.get(where.key) }; }
  },
  activityLogs: { async create() { return {}; } },
  async $queryRaw() {
    return Prisma.dmmf.datamodel.models.flatMap(model => model.fields
      .filter(field => field.kind !== 'object')
      .map(field => ({ column_name: field.dbName || field.name, data_type: field.type === 'Decimal' ? 'numeric' : 'text' })));
  }
};
require.cache[require.resolve('../config/prisma')].exports = { ...config, prisma };
const apiRouter = require('../routes/api');

test('Leads API scopes Justdial enquiries per user and Settings API keeps all 17 URL fields', async t => {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (id, path, method = 'GET', body) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET)}`,
        'Content-Type': 'application/json'
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, data: await response.json() };
  };

  for (const [userId, expectedIds] of [[1, [11, 12, 13, 14]], [2, [11, 14]], [3, [12, 14]], [4, [11, 14]]]) {
    const result = await request(userId, '/leads');
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.map(lead => lead.id), expectedIds);
  }
  assert.equal((await request(2, '/leads/12')).status, 404);
  assert.equal((await request(2, '/leads/12', 'PUT', { status: 'Contacted' })).status, 404);
  assert.equal((await request(2, '/leads/11')).status, 200);
  assert.equal((await request(3, '/leads/11')).status, 404);

  const initial = await request(1, '/settings');
  assert.equal(initial.status, 200);
  assert.equal(Object.keys(initial.data).length, 17);
  assert.equal((await request(2, '/settings')).status, 403);
  const saved = await request(1, '/settings', 'PUT', {
    sms_webhook_url: 'https://provider.example/customer?number=000',
    new_lead_sms_webhook_url: 'https://provider.example/new-lead?number=000',
    justdial_cctv_sms_webhook_url: 'https://provider.example/cctv?number=000'
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.sms_webhook_url, 'https://provider.example/customer?number=000');
  assert.equal(saved.data.new_lead_sms_webhook_url, 'https://provider.example/new-lead?number=000');
  assert.equal(saved.data.justdial_cctv_sms_webhook_url, 'https://provider.example/cctv?number=000');
  assert.equal(Object.keys(saved.data).length, 17);
});
