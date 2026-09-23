const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('HRMS schema and migration cover leave, employee documents, and attendance-linked payroll', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260826_hrms_field_workforce/migration.sql');
  assert.match(schema, /model EmployeeDocuments/);
  assert.match(schema, /model LeaveRequests/);
  assert.match(schema, /attendanceDeduction Decimal/);
  assert.match(schema, /workingDays\s+Int/);
  assert.match(migration, /CREATE TABLE "EmployeeDocuments"/);
  assert.match(migration, /CREATE TABLE "LeaveRequests"/);
});

test('employee self-service and leave review routes are authenticated and role-scoped', () => {
  const api = read('routes/api.js');
  assert.match(api, /router\.get\('\/my\/hr', authMiddleware, checkRole\(ALL_STAFF\)/);
  assert.match(api, /router\.post\('\/leaves', authMiddleware, checkRole\(ALL_STAFF\)/);
  assert.match(api, /router\.put\('\/leaves\/:id\/status', authMiddleware, checkRole\(ADMIN\)/);
  assert.match(api, /router\.get\('\/my\/payslips', authMiddleware, checkRole\(ALL_STAFF\)/);
  assert.match(api, /calculatePayroll\(employee, period\)/);
});

test('retired field-workforce data remains in the schema without exposing routes', () => {
  const api = read('routes/api.js');
  const schema = read('prisma/schema.prisma');
  assert.match(schema, /model FieldVisits/);
  assert.doesNotMatch(api, /router\.(post|put|get)\('\/field-visits/);
});
test('notification endpoints remain compatible before the hardening migration is deployed', () => {
  const api = read('routes/api.js');
  assert.match(api, /const NOTIFICATION_SELECT = \{/);
  assert.match(api, /router\.get\('\/notifications'[\s\S]*select: NOTIFICATION_SELECT/);
  assert.match(api, /router\.put\('\/notifications\/:id\/read'[\s\S]*select: \{ id: true \}[\s\S]*select: NOTIFICATION_SELECT/);
});
test('task endpoints support databases before and after the stable-assignee migration', () => {
  const api = read('routes/api.js');
  assert.match(api, /async function hasTaskAssignedUserIdColumn\(\)/);
  assert.match(api, /async function databaseColumns\(model\)/);
  assert.match(api, /async function removeUndeployedFields\(model, payload\)/);
  assert.match(api, /\.\.\.\(await compatibilitySelect\(config\.model\)\)/);
  assert.match(api, /Database migration is required before assigning tasks/);
  assert.match(api, /prisma\.tasks\.findMany\([\s\S]*await compatibilitySelect\('tasks'\)/);
});
test('dashboard and calendar queries avoid undeployed stable-reference columns', () => {
  const api = read('routes/api.js');
  assert.match(api, /prisma\.renewals\.findMany\([^\n]*select: \{ id: true, customer: true, type: true, nextDue: true \}/);
  assert.match(api, /prisma\.installations\.findMany\([^\n]*select: \{ id: true, type: true, customer: true, date: true \}/);
  assert.match(api, /prisma\.leads\.findMany\([^\n]*take: 5, select: \{ id: true, name: true, company: true, phone: true, source: true, service: true, status: true \}/);
});
test('generic resource CRUD avoids columns from unapplied migrations', () => {
  const api = read('routes/api.js');
  assert.match(api, /Prisma\.dmmf\.datamodel\.models/);
  assert.match(api, /information_schema\.columns/);
  assert.match(api, /await removeUndeployedFields\(config\.model, payload\)/);
});
test('legacy formatted money fields are restored without Prisma decimal decoding errors', () => {
  const api = read('routes/api.js');
  assert.match(api, /SELECT column_name, data_type/);
  assert.match(api, /async function restoreLegacyDecimalFields\(model, records\)/);
  assert.match(api, /field\.type === 'Decimal'/);
  assert.match(api, /await restoreLegacyDecimalFields\(config\.model, records\)/);
});
test('retired field workforce does not leave active migration guards', () => {
  const api = read('routes/api.js');
  assert.doesNotMatch(api, /requireFieldWorkforceDatabase/);
});
