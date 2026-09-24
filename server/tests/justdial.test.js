const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createJustdialRouter, normalizeJustdialPayload, toLeadData } = require('../routes/justdial');

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
  assert.equal(lead.justdialPayload.dncmobile, '1');
  assert.match(lead.notes, /Mobile marked DND/);
  assert.equal(lead.status, 'New');
  assert.throws(() => normalizeJustdialPayload({ mobile: '9876543210' }), /leadid/);
  assert.throws(() => normalizeJustdialPayload({ leadid: 'JD123' }), /mobile or phone/);
  assert.throws(() => normalizeJustdialPayload({ leadid: 'x'.repeat(256), mobile: '9876543210' }), /too long/);
});

test('Justdial callback accepts JSON, form and GET; repeated lead IDs acknowledge once', async (t) => {
  const saved = new Map();
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
    notifications: { async createMany() { throw new Error('Unexpected notification'); } }
  };
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use('/api/integrations/justdial', createJustdialRouter(prisma, () => token));
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
});
