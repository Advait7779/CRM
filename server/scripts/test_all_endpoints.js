const http = require('http');

async function request(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function testAll() {
  console.log('--- 1. Testing Login ---');
  const loginBody = JSON.stringify({ email: 'admin@company.com', password: 'Password@1234' });
  const loginRes = await request({
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginBody)
    }
  }, loginBody);

  console.log('Login status:', loginRes.status);
  const loginData = JSON.parse(loginRes.body);
  console.log('User:', loginData.user?.name, loginData.user?.role);
  console.log('Token present in response:', !!loginData.token);

  const cookies = loginRes.headers['set-cookie'] || [];
  const sessionCookie = cookies.find(c => c.startsWith('sm_session='));
  const cookieHeader = sessionCookie ? sessionCookie.split(';')[0] : '';
  console.log('Cookie present:', !!sessionCookie);

  const token = loginData.token;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Cookie': cookieHeader
  };

  console.log('\n--- 2. Testing Endpoints with Auth ---');
  const endpoints = [
    '/api/auth/profile',
    '/api/notifications',
    '/api/dashboard/stats',
    '/api/invoices?page=1&pageSize=200',
    '/api/tasks?page=1&pageSize=200',
    '/api/leads?page=1&pageSize=200',
    '/api/customers?page=1&pageSize=200',
    '/api/quotations?page=1&pageSize=200',
    '/api/renewals?page=1&pageSize=200',
    '/api/installations?page=1&pageSize=200',
    '/api/inventory?page=1&pageSize=200',
    '/api/employees?page=1&pageSize=200',
    '/api/attendance',
    '/api/payroll',
    '/api/calendar/events'
  ];

  let passed = 0;
  let failed = 0;

  for (const endpoint of endpoints) {
    const res = await request({
      hostname: 'localhost',
      port: 5001,
      path: endpoint,
      method: 'GET',
      headers
    });

    if (res.status === 200) {
      console.log(`[PASS] ${endpoint} -> 200 OK (${res.body.length} bytes)`);
      passed++;
    } else {
      console.error(`[FAIL] ${endpoint} -> ${res.status} Error:`, res.body.substring(0, 150));
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
}

testAll().catch(console.error);
