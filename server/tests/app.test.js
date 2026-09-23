const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('node:child_process');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-only-used-for-automated-tests';

const { server } = require('../index');

test('HTTP app exposes health and safe unauthenticated responses', async (t) => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const health = await fetch(`${baseUrl}/health/live`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');

  const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(badLogin.status, 400);

  const unknownApi = await fetch(`${baseUrl}/api/not-a-real-endpoint`);
  assert.equal(unknownApi.status, 404);
});

test('production application registers the Express 5 SPA wildcard without crashing', () => {
  const result = spawnSync(
    process.execPath,
    ['-e', "process.env.NODE_ENV='production'; require('./index');"],
    {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'production' },
      encoding: 'utf8'
    }
  );
  assert.equal(result.status, 0, result.stderr);
});
