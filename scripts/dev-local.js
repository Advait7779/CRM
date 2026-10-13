const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const serverDir = path.join(root, 'server');
const clientDir = path.join(root, 'client');
const { getDatabaseUrl } = require('../server/config/databaseUrl');
const apiPort = Number(process.env.PORT || 5001);
const clientPort = Number(process.env.DEV_CLIENT_PORT || 5174);
const apiUrl = `http://127.0.0.1:${apiPort}`;
const children = new Set();
let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) child.kill();
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

function start(script, args, cwd, env = process.env, nodeArgs = []) {
  const child = spawn(process.execPath, [...nodeArgs, script, ...args], {
    cwd,
    env,
    stdio: 'inherit',
    windowsHide: true
  });
  children.add(child);
  child.on('exit', (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(`Local development process stopped unexpectedly (exit ${code ?? 'unknown'}).`);
      stop(1);
    }
  });
  child.on('error', (error) => {
    console.error(`Could not start local development process: ${error.message}`);
    stop(1);
  });
  return child;
}

function run(script, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${path.basename(script)} exited with code ${code}`)));
  });
}

async function getResponse(url) {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(1500) });
  } catch {
    return null;
  }
}

async function apiReady() {
  const response = await getResponse(`${apiUrl}/health/ready`);
  return response?.ok || false;
}

async function frontendRunning() {
  for (const host of ['[::1]', '127.0.0.1']) {
    const response = await getResponse(`http://${host}:${clientPort}/`);
    if (!response) continue;
    const html = await response.text();
    if (!html.includes('/@vite/client')) {
      throw new Error(`Port ${clientPort} is already occupied by another application.`);
    }
    return true;
  }
  return false;
}

async function waitForApi(child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && !stopping && child.exitCode === null) {
    if (await apiReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`API did not become ready at ${apiUrl}/health/ready. Check the backend output above.`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Use this command only for local development.');
  const databaseHost = new URL(getDatabaseUrl()).hostname.replace(/^\[|\]$/g, '');
  if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost)) {
    throw new Error('Local development requires a local database. Check server/.env before starting.');
  }
  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) throw new Error('Invalid API port.');
  if (!Number.isInteger(clientPort) || clientPort < 1 || clientPort > 65535) throw new Error('Invalid client port.');

  console.log('Checking local database migrations...');
  await run(path.join(serverDir, 'scripts', 'deploy-migrations.js'), serverDir);
  await run(path.join(serverDir, 'migrate.js'), serverDir);

  if (await apiReady()) {
    console.log(`API is already ready at ${apiUrl}.`);
  } else {
    const api = start(path.join(serverDir, 'index.js'), [], serverDir, process.env, ['--watch']);
    await waitForApi(api);
    console.log(`API is ready at ${apiUrl}.`);
  }

  if (await frontendRunning()) {
    console.log(`Frontend is already running on port ${clientPort}.`);
  } else {
    start(path.join(clientDir, 'node_modules', 'vite', 'bin', 'vite.js'),
      ['--host', 'localhost', '--port', String(clientPort), '--strictPort'], clientDir,
      { ...process.env, VITE_API_PROXY_TARGET: apiUrl });
  }
  console.log(`Open http://localhost:${clientPort}/login`);
}

main().catch((error) => {
  console.error(`Local startup failed: ${error.message}`);
  stop(1);
});
