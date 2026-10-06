const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'installation-proof-test-secret-only';
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-proof-test-'));
process.env.UPLOAD_DIR = uploadDir;

const config = require('../config/prisma');
const users = [
  { id: 1, name: 'Admin', role: 'super_admin', email: 'admin@example.test', tokenVersion: 0 },
  { id: 2, name: 'Assigned Installer', role: 'gps_installer', email: 'installer@example.test', tokenVersion: 0 }
];
const jobs = new Map([
  [11, { id: 11, type: 'GPS', customer: 'A', installer: 'Assigned Installer', status: 'Pending', reportPhoto: null, reportNotes: null }],
  [12, { id: 12, type: 'GPS', customer: 'B', installer: 'Someone Else', status: 'Pending', reportPhoto: null, reportNotes: null }]
]);
const prisma = {
  users: { async findUnique({ where }) { return users.find(user => user.id === where.id) || null; } },
  installations: {
    async findUnique({ where }) { return jobs.get(where.id) || null; },
    async update({ where, data }) {
      const updated = { ...jobs.get(where.id), ...data };
      jobs.set(where.id, updated);
      return updated;
    }
  },
  activityLogs: { async create() { return {}; } }
};
require.cache[require.resolve('../config/prisma')].exports = { ...config, prisma };
const router = require('../routes/api');

test('completion requires five images and only the assigned installer can submit or download proof', async t => {
  t.after(() => {
    if (path.dirname(uploadDir) === os.tmpdir() && path.basename(uploadDir).startsWith('crm-proof-test-')) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }
  });
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = id => jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET);
  const submit = async (id, jobId, count) => {
    const form = new FormData();
    form.append('reportNotes', 'Installed and tested');
    for (let index = 0; index < count; index += 1) {
      form.append('photos', new Blob([Buffer.from([137, 80, 78, 71])], { type: 'image/png' }), `proof-${index}.png`);
    }
    return fetch(`${base}/installations/${jobId}/proof`, { method: 'POST', headers: { Authorization: `Bearer ${token(id)}` }, body: form });
  };

  assert.equal((await submit(2, 12, 5)).status, 404);
  assert.equal((await submit(2, 11, 0)).status, 400);
  assert.equal((await submit(2, 11, 4)).status, 400);
  assert.equal(jobs.get(11).status, 'Pending');
  const completed = await submit(2, 11, 5);
  assert.equal(completed.status, 200);
  assert.equal(jobs.get(11).status, 'Completed');
  assert.equal(JSON.parse(jobs.get(11).reportPhoto).length, 5);
  assert.equal((await submit(2, 11, 5)).status, 409);
  const proof = await fetch(`${base}/installations/11/proof/photo?index=2`, { headers: { Authorization: `Bearer ${token(2)}` } });
  assert.equal(proof.status, 200);
  assert.equal((await fetch(`${base}/installations/11/proof/photo?index=2`, { headers: { Authorization: `Bearer ${token(1)}` } })).status, 200);
  assert.equal((await fetch(`${base}/installations/12/proof/photo`, { headers: { Authorization: `Bearer ${token(2)}` } })).status, 404);
});
