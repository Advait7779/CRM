const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'invoice-create-test-secret';

const config = require('../config/prisma');
const { Prisma } = config;
const customer = { id: 7, name: 'Example Customer' };
const createdInvoices = [];
const prisma = {
  users: { async findUnique() { return { id: 1, name: 'Admin', role: 'super_admin', tokenVersion: 0 }; } },
  customers: { async findUnique({ where }) { return where.id === customer.id ? customer : null; } },
  invoices: {
    async create({ data }) {
      assert.equal(typeof data.customer, 'string', 'Prisma requires the customer name');
      createdInvoices.push(data);
      return data;
    }
  },
  activityLogs: { async create() { return {}; } },
  async $queryRaw() {
    return Prisma.dmmf.datamodel.models.flatMap(model => model.fields
      .filter(field => field.kind !== 'object')
      .map(field => ({ column_name: field.dbName || field.name, data_type: field.type === 'Decimal' ? 'numeric' : 'text' })));
  }
};

require.cache[require.resolve('../config/prisma')].exports = { ...config, prisma };
const router = require('../routes/api');

test('invoice creation resolves the selected customer and rejects missing customers', async t => {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/invoices`;
  const headers = {
    Authorization: `Bearer ${jwt.sign({ id: 1, tokenVersion: 0 }, process.env.JWT_SECRET)}`,
    'Content-Type': 'application/json'
  };
  const post = async body => {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const invoice = { date: '2026-11-14', amount: 36000, gst: 9, status: 'Unpaid' };

  const created = await post({ ...invoice, customerId: customer.id });
  assert.equal(created.status, 201);
  assert.equal(created.body.customer, customer.name);
  assert.equal(created.body.customerId, customer.id);
  assert.equal(created.body.total, 39240);
  assert.equal(createdInvoices.length, 1);

  const invalid = await post({ ...invoice, customerId: 999 });
  assert.equal(invalid.status, 404);
  assert.equal(createdInvoices.length, 1);

  const missing = await post(invoice);
  assert.equal(missing.status, 400);
  assert.match(missing.body.message, /customer/i);
  assert.equal(createdInvoices.length, 1);
});
