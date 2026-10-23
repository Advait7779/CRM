const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'gps-renewals-delete-test-secret';

const config = require('../config/prisma');
const users = [
  { id: 1, name: 'Admin', role: 'super_admin', email: 'admin@example.test', tokenVersion: 0 },
  { id: 2, name: 'Sales Manager', role: 'sales_manager', email: 'sales@example.test', tokenVersion: 0 },
  { id: 3, name: 'Technician', role: 'technician', email: 'tech@example.test', tokenVersion: 0 }
];

let renewalsList = [
  { id: 101, customer: 'Customer 1', type: 'GPS Renewal' },
  { id: 102, customer: 'Customer 2', type: 'GPS Renewal' },
  { id: 103, customer: 'Customer 3', type: 'GPS Renewal' },
  { id: 201, customer: 'Customer 4', type: 'AMC' }
];

const prisma = {
  users: { async findUnique({ where }) { return users.find(u => u.id === where.id) || null; } },
  renewals: {
    async findUnique({ where }) { return renewalsList.find(r => r.id === where.id) || null; },
    async delete({ where }) {
      const idx = renewalsList.findIndex(r => r.id === where.id);
      if (idx !== -1) return renewalsList.splice(idx, 1)[0];
      return null;
    },
    async deleteMany({ where }) {
      const initialCount = renewalsList.length;
      renewalsList = renewalsList.filter(r => {
        const isGps = r.type.toLowerCase().startsWith('gps');
        if (!isGps) return true; // keep non-GPS
        if (where?.id?.in) {
          return !where.id.in.includes(r.id);
        }
        return false; // delete all GPS
      });
      return { count: initialCount - renewalsList.length };
    }
  },
  activityLogs: { async create() { return {}; } },
  async $queryRaw() { return [{ column_name: 'id', data_type: 'integer' }]; }
};

require.cache[require.resolve('../config/prisma')].exports = { ...config, prisma };
const router = require('../routes/api');

test('GPS renewals bulk delete deletes all GPS renewals or selected IDs and restricts roles', async t => {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/gps-renewals`;

  const del = (userId, body) => fetch(base, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { Authorization: `Bearer ${jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET)}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  // 1. Unauthorized
  assert.equal((await del(null)).status, 401);

  // 2. Forbidden for non-sales/finance role (technician)
  assert.equal((await del(3)).status, 403);

  // 3. Delete specific IDs (only 101)
  const resFiltered = await del(2, { ids: [101] });
  assert.equal(resFiltered.status, 200);
  const dataFiltered = await resFiltered.json();
  assert.equal(dataFiltered.count, 1);
  assert.equal(renewalsList.some(r => r.id === 101), false);
  assert.equal(renewalsList.some(r => r.id === 102), true);
  assert.equal(renewalsList.some(r => r.id === 201), true); // AMC untouched

  // 4. Delete all remaining GPS renewals
  const resAll = await del(1);
  assert.equal(resAll.status, 200);
  const dataAll = await resAll.json();
  assert.equal(dataAll.count, 2); // 102 and 103 deleted
  assert.equal(renewalsList.length, 1);
  assert.equal(renewalsList[0].id, 201); // AMC renewal preserved
});
