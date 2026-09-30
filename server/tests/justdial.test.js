const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createJustdialRouter, normalizeJustdialPayload, toLeadData } = require('../routes/justdial');
const { sendJustdialWebhookNotifications } = require('../services/savedWebhookNotifications');

const token = 'justdial-test-token-at-least-32-characters';

test('Justdial fields map to a lead and retain the complete payload', () => {
  const payload = normalizeJustdialPayload({
    leadid: 'JD123', name: 'ABHAY SHAH', mobile: '9876543210',
    category: 'Generator Dealers', date: '2020-12-24', time: '13:10:11',
    city: 'Mumbai', dncmobile: 1, parentid: 'CONTRACT-1'
  });
  const lead = toLeadData(payload);
  assert.equal(lead.justdialLeadId, 'JD123');
  assert.equal(lead.phone, '9876543210');
  assert.equal(lead.source, 'Justdial');
  assert.equal(lead.service, 'Generator Dealers');
  assert.equal(lead.justdialProduct, 'Unclassified');
  assert.equal(lead.justdialPayload.dncmobile, '1');
  assert.match(lead.notes, /Mobile marked DND/);
  assert.equal(lead.status, 'New');
  assert.throws(() => normalizeJustdialPayload({ mobile: '9876543210' }), /leadid/);
  assert.throws(() => normalizeJustdialPayload({ leadid: 'JD123' }), /mobile or phone/);
  assert.throws(() => normalizeJustdialPayload({ leadid: 'x'.repeat(256), mobile: '9876543210' }), /too long/);
});

test('Justdial callback accepts JSON, form and GET; repeated lead IDs acknowledge once', async (t) => {
  const saved = new Map();
  const delivered = [];
  const prisma = {
    leads: {
      async create({ data }) {
        if (saved.has(data.justdialLeadId)) throw Object.assign(new Error('duplicate'), { code: 'P2002' });
        const record = { id: saved.size + 1, ...data };
        saved.set(data.justdialLeadId, record);
        return record;
      },
      async findUnique({ where }) { return saved.get(where.justdialLeadId) || null; }
    },
    users: { async findMany() { return []; } },
    notifications: { async createMany() { throw new Error('Unexpected notification'); } },
    appSettings: { async findMany() { return []; } }
  };
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use('/api/integrations/justdial', createJustdialRouter(prisma, () => token, async (_prisma, lead) => { delivered.push(lead.justdialLeadId); }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/integrations/justdial`;

  const invalid = await fetch(`${base}/incorrect`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadid: 'JD1', mobile: '9876543210' })
  });
  assert.equal(invalid.status, 404);
  assert.equal(saved.size, 0);

  const json = await fetch(`${base}/${token}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadid: 'JD1', name: 'User', mobile: '9876543210', category: 'GPS' })
  });
  assert.equal(json.status, 200);
  assert.match(json.headers.get('content-type'), /^text\/plain/);
  assert.equal(await json.text(), 'RECEIVED');
  assert.equal(saved.size, 1);

  const duplicate = await fetch(`${base}/${token}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ leadid: 'JD1', mobile: '9876543210' })
  });
  assert.equal(await duplicate.text(), 'RECEIVED');
  assert.equal(saved.size, 1);

  const get = await fetch(`${base}/${token}?leadid=JD2&phone=02224100086&name=Caller`);
  assert.equal(get.status, 200);
  assert.equal(await get.text(), 'RECEIVED');
  assert.equal(saved.size, 2);
  assert.equal(saved.get('JD2').phone, '02224100086');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(delivered, ['JD1', 'JD2']);
});

test('Justdial notifications go to admins and users assigned the matching product', async (t) => {
  let receiveNotifications;
  const notifications = new Promise(resolve => { receiveNotifications = resolve; });
  const prisma = {
    leads: { async create({ data }) { return { id: 42, ...data }; } },
    users: { async findMany() { return [
      { id: 1, role: 'super_admin', justdialProducts: [] },
      { id: 2, role: 'director', justdialProducts: [] },
      { id: 3, role: 'sales_executive', justdialProducts: ['CCTV'] },
      { id: 4, role: 'sales_executive', justdialProducts: ['GPS & Fuel Sensor'] }
    ]; } },
    notifications: { async createMany({ data }) { receiveNotifications(data); } },
    appSettings: { async findMany() { return []; } }
  };
  const app = express();
  app.use(express.json());
  app.use('/api/integrations/justdial', createJustdialRouter(prisma, () => token));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/integrations/justdial/${token}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadid: 'JD-CCTV', mobile: '9000000000', category: 'CCTV Installation' })
  });
  assert.equal(await response.text(), 'RECEIVED');
  const sent = await notifications;
  assert.deepEqual(sent.map(item => item.userId), [1, 2, 3]);
  assert.ok(sent.every(item => item.dedupeKey === `justdial:42:${item.userId}`));
});

test('Justdial callback reaches all four locally mocked channels for each product group once', async t => {
  const saved = new Map();
  const requests = [];
  const jobs = [];
  let base;
  const prisma = {
    leads: {
      async create({ data }) {
        if (saved.has(data.justdialLeadId)) throw Object.assign(new Error('duplicate'), { code: 'P2002' });
        const lead = { id: saved.size + 1, ...data };
        saved.set(data.justdialLeadId, lead);
        return lead;
      },
      async findUnique({ where }) { return saved.get(where.justdialLeadId) || null; }
    },
    users: { async findMany() { return []; } },
    appSettings: { async findMany({ where }) {
      return where.key.in.map(key => ({ key, value: `${base}/mock-provider/${key}?number=0000000000` }));
    } }
  };
  const app = express();
  app.use(express.json());
  app.get('/mock-provider/:key', (req, res) => {
    requests.push({ key: req.params.key, number: req.query.number });
    res.sendStatus(200);
  });
  app.use('/api/integrations/justdial', createJustdialRouter(prisma, () => token, (...args) => {
    const job = sendJustdialWebhookNotifications(...args);
    jobs.push(job);
    return job;
  }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  for (const [leadid, category] of [
    ['JD-CCTV', 'CCTV Installation'],
    ['JD-GPS', 'GPS Tracking'],
    ['JD-DIGITAL', 'Website Development'],
    ['JD-UNCLEAR', 'Generator Dealer']
  ]) {
    const response = await fetch(`${base}/api/integrations/justdial/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadid, category, mobile: '9000000000' })
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'RECEIVED');
  }
  const duplicate = await fetch(`${base}/api/integrations/justdial/${token}?leadid=JD-CCTV&mobile=9000000000`);
  assert.equal(await duplicate.text(), 'RECEIVED');
  await new Promise(resolve => setImmediate(resolve));
  await Promise.all(jobs);

  assert.equal(saved.size, 4);
  assert.equal(requests.length, 12);
  for (const group of ['cctv', 'gps_fuel', 'digital']) {
    const groupRequests = requests.filter(request => request.key.startsWith(`justdial_${group}_`));
    assert.equal(groupRequests.length, 4);
    assert.ok(groupRequests.every(request => request.number === '9000000000'));
    assert.deepEqual(groupRequests.map(request => request.key.split('_').at(-3)).sort(), ['sms', 'rcs', 'voice', 'whatsapp'].sort());
  }
});
