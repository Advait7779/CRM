const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'impersonation-test-secret-only';

const config = require('../config/prisma');
const { Prisma } = config;
const users = [
  { id: 1, name: 'Super Admin', email: 'admin@example.test', role: 'super_admin', tokenVersion: 0, justdialProducts: [] },
  { id: 2, name: 'Sanika', email: 'sanika@example.test', role: 'sales_executive', tokenVersion: 0, justdialProducts: ['CCTV'] },
  { id: 3, name: 'Director', email: 'director@example.test', role: 'director', tokenVersion: 0, justdialProducts: [] }
];
const auditEntries = [];
const prisma = {
  users: {
    async findUnique({ where }) { return users.find(user => user.id === where.id) || null; },
    async findMany() { return users; }
  },
  activityLogs: { async create({ data }) { auditEntries.push(data); return data; } },
  async $queryRaw() {
    return Prisma.dmmf.datamodel.models.flatMap(model => model.fields
      .filter(field => field.kind !== 'object')
      .map(field => ({ column_name: field.dbName || field.name, data_type: 'text' })));
  }
};
require.cache[require.resolve('../config/prisma')].exports = { ...config, prisma };
const apiRouter = require('../routes/api');

test('only a direct Super Admin session can switch to a non-root user and return', async t => {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const adminToken = jwt.sign({ id: 1, tokenVersion: 0 }, process.env.JWT_SECRET);
  const directorToken = jwt.sign({ id: 3, tokenVersion: 0 }, process.env.JWT_SECRET);
  const request = async (path, token, method = 'GET', cookie) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      }
    });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
  };

  assert.equal((await request('/users/2/impersonate', directorToken, 'POST')).status, 403);
  assert.equal((await request('/users/2/impersonate', null, 'POST', `sm_session=${adminToken}`)).status, 403);
  assert.equal((await request('/users/1/impersonate', adminToken, 'POST')).status, 403);
  assert.equal((await request('/users/999/impersonate', adminToken, 'POST')).status, 404);

  const switched = await request('/users/2/impersonate', adminToken, 'POST');
  assert.equal(switched.status, 200);
  assert.equal(switched.data.user.name, 'Sanika');
  assert.match(switched.cookie, /sm_session=/);
  assert.match(switched.cookie, /HttpOnly/i);
  const claims = jwt.verify(switched.data.token, process.env.JWT_SECRET);
  assert.equal(claims.id, 2);
  assert.equal(claims.impersonatedById, 1);
  assert.ok(claims.exp - claims.iat <= 1800);
  assert.equal(auditEntries.at(-1).action, 'impersonate');
  assert.equal(auditEntries.at(-1).userId, 1);
  assert.equal(auditEntries.at(-1).entityId, '2');

  const targetCookie = switched.cookie.split(';')[0];
  assert.equal((await request('/auth/profile', switched.data.token)).data.role, 'sales_executive');
  assert.equal((await request('/users', null, 'GET', targetCookie)).status, 403);
  assert.equal((await request('/users/3/impersonate', switched.data.token, 'POST')).status, 403);
  assert.equal((await request('/auth/password', switched.data.token, 'PUT')).status, 403);
  assert.equal((await request('/auth/restore-session', switched.data.token, 'POST')).status, 403);

  const restored = await request('/auth/restore-session', adminToken, 'POST');
  assert.equal(restored.status, 200);
  assert.match(restored.cookie, /sm_session=/);
  assert.equal((await request('/users', null, 'GET', restored.cookie.split(';')[0])).status, 200);

  users[0].tokenVersion += 1;
  assert.equal((await request('/auth/profile', switched.data.token)).status, 401);
  users[0].tokenVersion -= 1;
  users[1].tokenVersion += 1;
  assert.equal((await request('/auth/profile', switched.data.token)).status, 401);
});
