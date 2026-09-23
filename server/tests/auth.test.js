const test = require('node:test');
const assert = require('node:assert/strict');
const { checkRole } = require('../middleware/auth');

function runRoleCheck(user, allowedRoles) {
  let nextCalled = false;
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  checkRole(allowedRoles)({ user }, response, () => { nextCalled = true; });
  return { nextCalled, response };
}

test('role middleware rejects missing and insufficient identities', () => {
  assert.equal(runRoleCheck(null, ['accounts']).response.statusCode, 401);
  const denied = runRoleCheck({ role: 'sales_executive' }, ['accounts']);
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.response.statusCode, 403);
});

test('role middleware permits allowed roles and protected super admin', () => {
  assert.equal(runRoleCheck({ role: 'accounts' }, ['accounts']).nextCalled, true);
  assert.equal(runRoleCheck({ role: 'super_admin' }, ['accounts']).nextCalled, true);
});