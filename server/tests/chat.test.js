const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'automated-tests-only-not-a-production-secret';
const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-chat-test-'));
process.env.UPLOAD_DIR = fixtureDirectory;
const config = require('../config/prisma');
const { Prisma } = config;
const unexpected = async () => { throw new Error('Unexpected database access in isolated test'); };
const prisma = { $queryRaw: unexpected };
for (const model of Prisma.dmmf.datamodel.models) {
  const key = model.name[0].toLowerCase() + model.name.slice(1);
  prisma[key] = Object.fromEntries(['findUnique', 'findMany', 'findFirst', 'create', 'update', 'updateMany', 'count', 'groupBy'].map(method => [method, unexpected]));
}
require.cache[require.resolve('../config/prisma')].exports = { ...config, prisma };
const { server } = require('../index');
const { isAllowedOrigin } = require('../utils/accessPolicy');

test('production origin validation rejects hostname-prefix impersonation', () => {
  const allow = ['https://crm.example.com'];
  assert.equal(isAllowedOrigin(allow[0], allow, true), true);
  assert.equal(isAllowedOrigin(undefined, allow, true), true);
  for (const origin of ['http://192.168.untrusted.example', 'http://10.evil.example', 'http://localhost:5000', 'http://192.168.1.4']) {
    assert.equal(isAllowedOrigin(origin, allow, true), false);
  }
  assert.equal(isAllowedOrigin('http://192.168.1.4:5174', allow, false), true);
  assert.equal(isAllowedOrigin('http://192.168.untrusted.example', allow, false), false);
});

test('HTTP authorization and pagination regressions (isolated fixtures, no database writes)', async t => {
  t.after(() => {
    if (path.dirname(path.resolve(fixtureDirectory)) !== path.resolve(os.tmpdir()) || !path.basename(fixtureDirectory).startsWith('crm-chat-test-')) throw new Error('Unexpected fixture cleanup path');
    fs.rmSync(fixtureDirectory, { recursive: true, force: true });
  });
  const users = [
    { id: 1, role: 'super_admin', name: 'Admin', email: 'admin@example.test', tokenVersion: 0 },
    { id: 2, role: 'sales_executive', name: 'Same Name', email: 'two@example.test', tokenVersion: 0 },
    { id: 3, role: 'sales_executive', name: 'Same Name', email: 'three@example.test', tokenVersion: 0 }
  ];
  const groups = [{ id: 8, name: 'Private', createdBy: 1, members: [1, 3] }];
  const task = { id: 7, title: 'Private task', assignedTo: 'Same Name', assignedUserId: 3 };
  const messages = Array.from({ length: 601 }, (_, index) => ({
    id: index + 1, groupId: 8, senderId: 3, receiverId: null,
    message: 'fixture', createdAt: new Date(2026, 0, 1, 0, 0, index)
  }));
  const uploads = [];
  const groupVisible = (group, where) => !where || where.OR.some(condition =>
    condition.createdBy === group.createdBy || condition.members?.array_contains?.some(id => group.members.includes(id)));
  t.mock.method(prisma.users, 'findUnique', async ({ where }) => users.find(user => user.id === where.id) || null);
  t.mock.method(prisma.users, 'findMany', async () => users);
  t.mock.method(prisma.attendances, 'findMany', async () => []);
  t.mock.method(prisma.employees, 'findMany', async () => []);
  t.mock.method(prisma.chatGroups, 'findUnique', async ({ where }) => groups.find(group => group.id === where.id) || null);
  t.mock.method(prisma.chatGroups, 'findMany', async ({ where } = {}) => groups.filter(group => groupVisible(group, where)));
  t.mock.method(prisma.chatMessages, 'groupBy', async () => []);
  t.mock.method(prisma.chatMessages, 'findFirst', async ({ where }) => {
    if (where.attachment) {
      assert.ok(where.OR.some(clause => clause.groupId === null && clause.OR.some(part => part.senderId || part.receiverId)), 'private files must check direct participants');
      assert.ok(where.OR.some(clause => Array.isArray(clause.groupId?.in)), 'private files must restrict group membership');
      return messages.find(message => message.attachment === where.attachment && where.OR.some(clause =>
        clause.groupId?.in?.includes(message.groupId) || (clause.groupId === null && message.groupId === null && clause.OR.some(part => part.senderId === message.senderId || part.receiverId === message.receiverId)))) || null;
    }
    return messages.at(-1);
  });
  t.mock.method(prisma.chatMessages, 'findMany', async ({ where, orderBy, take }) => {
    let rows = messages.filter(message => message.groupId === where.groupId && (!where.id?.lt || message.id < where.id.lt));
    if (orderBy?.id === 'desc') rows = rows.toReversed();
    return rows.slice(0, take || rows.length);
  });
  let writes = 0;
  t.mock.method(prisma.chatMessages, 'create', async ({ data }) => { writes++; const row = { ...data, id: messages.length + 1 }; messages.push(row); return row; });
  t.mock.method(prisma.chatUploads, 'findUnique', async ({ where }) => uploads.find(upload => upload.storedName === where.storedName) || null);
  t.mock.method(prisma.chatUploads, 'create', async ({ data }) => { uploads.push(data); return data; });
  t.mock.method(prisma.tasks, 'findMany', async ({ where }) => where.assignedUserId && where.assignedUserId !== task.assignedUserId ? [] : [task]);
  t.mock.method(prisma.tasks, 'findUnique', async () => task);
  t.mock.method(prisma.tasks, 'update', async () => { writes++; throw new Error('Unexpected task write'); });
  t.mock.method(prisma.customers, 'findUnique', async () => ({ id: 1, name: 'Fixture', CustomerDocuments: [] }));
  for (const model of ['invoices', 'tickets', 'renewals', 'installations', 'quotations']) t.mock.method(prisma[model], 'findMany', async () => []);
  t.mock.method(prisma, '$queryRaw', async () => Prisma.dmmf.datamodel.models.flatMap(model => model.fields.filter(field => field.kind !== 'object').map(field => ({ column_name: field.dbName || field.name, data_type: field.type === 'Decimal' ? 'numeric' : 'text' }))));

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const request = async (userId, path, method = 'GET', body) => {
    const response = await fetch(base + path, {
      method, headers: { Authorization: 'Bearer ' + jwt.sign({ id: userId, tokenVersion: 0 }, process.env.JWT_SECRET), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, data: response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text(), remaining: response.headers.get('ratelimit-remaining') };
  };

  const adminFirst = await request(1, '/customers/1/overview');
  const staffFirst = await request(2, '/customers/1/overview');
  assert.equal(adminFirst.status, 200);
  assert.equal(staffFirst.status, 200);
  assert.equal(adminFirst.remaining, staffFirst.remaining, 'verified users on one IP have separate rate-limit buckets');
  assert.equal((await request(2, '/chat/messages/8?type=group')).status, 404);
  assert.equal((await request(2, '/chat/messages', 'POST', { groupId: 8, message: 'denied' })).status, 404);
  assert.equal((await request(2, '/chat/users')).data.some(contact => contact.isGroup), false);
  assert.equal((await request(2, '/chat/messages', 'POST', { receiverId: 3, attachment: 'employee-document.pdf' })).status, 403);
  assert.equal((await request(2, '/chat/download/employee-document.pdf')).status, 404);
  assert.equal((await request(2, '/chat/media/employee-document.pdf')).status, 404);
  assert.deepEqual((await request(2, '/tasks')).data, []);
  assert.equal((await request(2, '/tasks/7')).status, 404);
  assert.equal((await request(2, '/tasks/7/status', 'PUT', { status: 'Completed' })).status, 403);
  assert.equal((await request(3, '/tasks')).data[0].id, 7);
  const newest = await request(3, '/chat/messages/8?type=group');
  assert.equal(newest.status, 200);
  assert.equal(newest.data.length, 100);
  assert.equal(newest.data[0].id, 502);
  assert.equal(newest.data.at(-1).id, 601);
  const older = await request(3, '/chat/messages/8?type=group&before=502');
  assert.equal(older.data[0].id, 402);
  assert.equal(older.data.at(-1).id, 501);
  assert.equal((await request(3, '/chat/messages/8?type=group&before=invalid')).status, 400);
  assert.equal((await request(1, '/field-visits')).status, 404);
  assert.equal(writes, 0);
  const form = new FormData();
  form.append('file', new Blob(['private fixture'], { type: 'text/plain' }), 'fixture.txt');
  const uploaded = await fetch(base + '/chat/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + jwt.sign({ id: 3, tokenVersion: 0 }, process.env.JWT_SECRET) }, body: form });
  assert.equal(uploaded.status, 201);
  const file = await uploaded.json();
  assert.equal((await request(2, '/chat/messages', 'POST', { receiverId: 3, attachment: file.storedName })).status, 403);
  assert.equal((await request(3, '/chat/messages', 'POST', { groupId: 8, attachment: file.storedName, attachmentName: 'fixture.txt' })).status, 201);
  assert.equal((await request(3, '/chat/media/' + file.storedName)).data, 'private fixture');
  assert.equal((await request(1, '/chat/download/' + file.storedName)).status, 200);
  assert.equal((await request(2, '/chat/download/' + file.storedName)).status, 404);
  assert.equal(writes, 1);
});
