const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { currentDateOnly } = require('../utils/prismaData');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'gps-renewal-sms-api-test-secret';

const config = require('../config/prisma');
const sent = [];
const today = currentDateOnly();
const offsetDate = days => {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};
const pastDue = offsetDate(-10);
const futureDue = offsetDate(4);
const rows = [
  { id: 1, type: 'GPS Renewal', customer: 'One customer', contactNo: '9876543210(C), 8282982829(H)', vehicleNumber: 'MH12AB1234', imeiNo: '111', nextDue: pastDue },
  { id: 2, type: 'GPS Renewal', customer: 'One customer', contactNo: '9876543210(C)', vehicleNumber: 'MH 12 AB 1234', imeiNo: '222', nextDue: pastDue },
  { id: 3, type: 'GPS Renewal', customer: 'One customer', contactNo: '9876543210(C)', vehicleNumber: 'MH12AB9999', imeiNo: '333', nextDue: futureDue },
  { id: 4, type: 'GPS Renewal', customer: 'Another customer', contactNo: '8282982829(H)', vehicleNumber: 'MH12AB5555', imeiNo: '444', nextDue: pastDue }
];
const prisma = {
  users: { async findUnique({ where }) { return where.id === 1 ? { id: 1, role: 'super_admin', tokenVersion: 0 } :
    where.id === 2 ? { id: 2, role: 'sales_manager', tokenVersion: 0 } : null; } },
  appSettings: { async findUnique() { return { value: 'https://provider.example/send?number={phone}&sms=Reminder' }; } },
  renewals: {
    async findMany({ where } = {}) { return where?.expiredSmsClaimId
      ? rows.filter(row => row.expiredSmsClaimId === where.expiredSmsClaimId) : rows; },
    async findUnique({ where }) { return rows.find(row => row.id === where.id) || null; },
    async updateMany({ where, data }) {
      const selected = rows.filter(row => (where.id?.in ? where.id.in.includes(row.id) : where.id === row.id)
        && (!where.expiredSmsClaimId || row.expiredSmsClaimId === where.expiredSmsClaimId)
        && (where.confirmedAt !== null || !row.confirmedAt && !row.renewalDate)
        && (!where.OR || [null, 'failed'].includes(row.expiredSmsStatus || null)));
      for (const row of selected) Object.assign(row, data);
      return { count: selected.length };
    }
  },
  activityLogs: { async create() { return {}; } },
  async $transaction(work) { return work(this); },
  async $queryRaw() { return [{ column_name: 'id', data_type: 'integer' }]; }
};
require.cache[require.resolve('../config/prisma')].exports = { ...config, prisma };
const smsService = require('../services/gpsRenewalSms');
require.cache[require.resolve('../services/gpsRenewalSms')].exports = {
  ...smsService, async sendGpsRenewalSms(_template, row) { sent.push(row.id); }
};
const router = require('../routes/api');

test('GPS renewal SMS preview and send respect dates, roles, vehicles, customer phones and prior sends', async t => {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const request = async (id, path, body) => {
    const route = path.startsWith('/') ? path : `/gps-renewals/sms/${path}`;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET)}` },
      body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await request(2, 'preview', { mode: 'all' })).status, 403);
  assert.equal((await request(1, 'preview', { mode: 'range', from: futureDue.toISOString().slice(0, 10), to: pastDue.toISOString().slice(0, 10) })).status, 400);
  const dateRange = await request(1, 'preview', { mode: 'range', from: pastDue.toISOString().slice(0, 10), to: futureDue.toISOString().slice(0, 10) });
  assert.equal(dateRange.status, 200);
  assert.deepEqual(dateRange.body.recipientIds, [1]);
  assert.equal(dateRange.body.notExpired, 1);
  assert.equal(dateRange.body.duplicates, 1);
  assert.equal(dateRange.body.missingMobile, 1);
  const all = await request(1, 'preview', { mode: 'all' });
  assert.deepEqual(all.body.recipientIds, [1]);
  assert.equal(all.body.notExpired, 1);
  assert.equal((await request(1, 'send', { mode: 'all' })).status, 400);
  const queued = await request(1, 'send', { mode: 'all', recipientIds: all.body.recipientIds });
  assert.equal(queued.body.queued, 1);
  for (let attempt = 0; sent.length < 1 && attempt < 20; attempt += 1) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(sent, [1]);
  const again = await request(1, 'preview', { mode: 'all' });
  assert.equal(again.body.eligible, 0);
  assert.equal(again.body.alreadySent, 1);
  assert.equal((await request(1, 'send', { mode: 'all', recipientIds: all.body.recipientIds })).body.queued, 0);

  rows[0].expiredSmsStatus = null;
  rows[1].expiredSmsStatus = null;
  assert.equal((await request(2, '/gps-renewals/2/sms', {})).status, 403);
  assert.equal((await request(1, '/gps-renewals/4/sms', {})).status, 400);
  assert.equal((await request(1, '/gps-renewals/3/sms', {})).status, 409);
  assert.equal((await request(1, '/gps-renewals/bad/sms', {})).status, 400);
  assert.equal((await request(1, '/gps-renewals/2/sms', {})).body.queued, 1);
  for (let attempt = 0; sent.length < 2 && attempt < 20; attempt += 1) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(sent, [1, 2]);
  assert.equal((await request(1, '/gps-renewals/1/sms', {})).status, 409);
});
