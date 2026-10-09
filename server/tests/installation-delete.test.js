const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'installation-delete-test-secret-only';
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-installation-delete-'));
process.env.UPLOAD_DIR = uploadDir;

const config = require('../config/prisma');
const users = [
  { id: 1, name: 'Admin', role: 'super_admin', email: 'admin@example.test', tokenVersion: 0 },
  { id: 2, name: 'Director', role: 'director', email: 'director@example.test', tokenVersion: 0 },
  { id: 3, name: 'Manager', role: 'installation_manager', email: 'manager@example.test', tokenVersion: 0 },
  { id: 4, name: 'Installer', role: 'gps_installer', email: 'installer@example.test', tokenVersion: 0 }
];
const jobs = new Map([
  [11, { id: 11, type: 'GPS', customer: 'Customer A', vehicle: 'MH 12 AB 1234', reportPhoto: JSON.stringify(['proof-a.jpg', 'proof-b.jpg']), reportSignature: null }],
  [12, { id: 12, type: 'CCTV', customer: 'Customer B', site: 'Office', reportPhoto: null, reportSignature: null }]
]);
const deleted = [];
const prisma = {
  users: { async findUnique({ where }) { return users.find(user => user.id === where.id) || null; } },
  installations: {
    async findUnique({ where }) { return jobs.get(where.id) || null; },
    async delete({ where }) {
      const job = jobs.get(where.id);
      jobs.delete(where.id);
      deleted.push(where.id);
      return job;
    }
  },
  activityLogs: { async create() { return {}; } },
  async $queryRaw() { return [{ column_name: 'id', data_type: 'integer' }]; }
};
require.cache[require.resolve('../config/prisma')].exports = { ...config, prisma };
const router = require('../routes/api');

test('only Super Admin can delete an installation and its proof, without deleting other jobs', async t => {
  t.after(() => fs.rmSync(uploadDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(uploadDir, 'proof-a.jpg'), 'photo A');
  fs.writeFileSync(path.join(uploadDir, 'proof-b.jpg'), 'photo B');

  const app = express();
  app.use('/api', router);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/installations`;
  const remove = (userId, jobId) => fetch(`${base}/${jobId}`, {
    method: 'DELETE',
    headers: userId ? { Authorization: `Bearer ${jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET)}` } : {}
  });

  assert.equal((await remove(null, 11)).status, 401);
  for (const userId of [2, 3, 4]) {
    const response = await remove(userId, 11);
    assert.equal(response.status, 403);
  }
  assert.deepEqual(deleted, []);
  assert.equal(jobs.has(11), true);

  assert.equal((await remove(1, 99)).status, 404);
  assert.equal((await remove(1, 11)).status, 200);
  assert.deepEqual(deleted, [11]);
  assert.equal(jobs.has(12), true);
  for (const file of ['proof-a.jpg', 'proof-b.jpg']) {
    for (let attempt = 0; attempt < 20 && fs.existsSync(path.join(uploadDir, file)); attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(fs.existsSync(path.join(uploadDir, file)), false);
  }
});
