const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'lead-status-assignment-test-secret';

const config = require('../config/prisma');
const { Prisma } = config;
const { jsonReplacer } = require('../utils/prismaData');
const users = [
  { id: 1, name: 'Admin', role: 'super_admin', tokenVersion: 0 },
  { id: 2, name: 'Maya', role: 'sales_manager', tokenVersion: 0 },
  { id: 3, name: 'Ravi', role: 'sales_executive', tokenVersion: 0, justdialProducts: ['CCTV'] }
];
const leads = new Map([
  [11, { id: 11, name: 'New prospect', phone: '9000000011', source: 'Website', service: 'CCTV', justdialProduct: 'CCTV', status: 'New' }],
  [12, { id: 12, name: 'Existing customer', phone: '9000000012', source: 'Website', service: 'GPS Tracking', justdialProduct: 'GPS & Fuel Sensor', status: 'Converted', convertedCustomerId: 7 }]
]);
const customers = new Map();
const prisma = {
  users: {
    async findUnique({ where }) { return users.find(user => user.id === where.id) || null; },
    async findMany({ where, select }) {
      return users.filter(user => where.role.in.includes(user.role))
        .map(user => Object.fromEntries(Object.keys(select).map(key => [key, user[key]])));
    }
  },
  leads: {
    async findUnique({ where }) { return leads.get(where.id) || null; },
    async update({ where, data }) {
      const updated = { ...leads.get(where.id), ...data };
      leads.set(where.id, updated);
      return updated;
    }
  },
  customers: {
    async findMany() { return [...customers.values()]; },
    async findUnique({ where }) { return customers.get(where.id) || null; },
    async create({ data }) {
      const created = { id: customers.size + 1, ...data };
      customers.set(created.id, created);
      return created;
    },
    async update({ where, data }) {
      const updated = { ...customers.get(where.id), ...data };
      customers.set(where.id, updated);
      return updated;
    }
  },
  appSettings: { async findMany() { return []; } },
  activityLogs: { async create() { return {}; } },
  async $queryRaw() {
    return Prisma.dmmf.datamodel.models.flatMap(model => model.fields
      .filter(field => field.kind !== 'object')
      .map(field => ({ column_name: field.dbName || field.name, data_type: 'text' })));
  }
};
require.cache[require.resolve('../config/prisma')].exports = { ...config, prisma };
const apiRouter = require('../routes/api');

test('lead statuses persist, converted leads stay converted, and customer assignments round-trip', async t => {
  const app = express();
  app.set('json replacer', jsonReplacer);
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (path, { userId = 1, method = 'GET', body } = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET)}`,
        'Content-Type': 'application/json'
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, data: await response.json() };
  };

  const assignees = await request('/task-assignees', { userId: 3 });
  assert.equal(assignees.status, 200);
  assert.deepEqual(assignees.data.map(user => user.name), ['Maya', 'Ravi']);
  const systemUsers = await request('/system-users', { userId: 3 });
  assert.equal(systemUsers.status, 200);
  assert.deepEqual(systemUsers.data.map(user => user.name), ['Admin', 'Maya', 'Ravi']);

  for (const status of ['Connected', 'Future Prospect', 'Fake Enquiry', 'Interested', 'Not Interested', 'Follow-Up Required']) {
    const saved = await request('/leads/11', { method: 'PUT', body: { status, exec: 'Maya' } });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.status, status);
    assert.equal(saved.data.exec, 'Maya');
    assert.equal((await request('/leads/11')).data.status, status);
  }
  assert.equal((await request('/leads/11', { userId: 3 })).status, 200);
  const ownUpdate = await request('/leads/11', { userId: 3, method: 'PUT', body: { status: 'Interested', exec: 'Maya' } });
  assert.equal(ownUpdate.status, 200);
  assert.equal(ownUpdate.data.status, 'Interested');
  assert.equal(ownUpdate.data.exec, 'Maya');
  assert.equal((await request('/leads/12', { userId: 3 })).status, 404);
  assert.equal((await request('/leads/12', { method: 'PUT', body: { status: 'Connected' } })).status, 409);
  assert.equal(leads.get(12).status, 'Converted');

  const created = await request('/customers', {
    method: 'POST', body: { name: 'Test customer', phone: '9000000013', assignedTo: 'Ravi' }
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.assignedTo, 'Ravi');
  assert.equal((await request('/customers')).data[0].assignedTo, 'Ravi');
  const updated = await request(`/customers/${created.data.id}`, { method: 'PUT', body: { assignedTo: 'Maya' } });
  assert.equal(updated.status, 200);
  assert.equal((await request(`/customers/${created.data.id}`)).data.assignedTo, 'Maya');
});
