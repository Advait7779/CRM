// Sends a sample enquiry only to the API on this computer.
require('../config/env');
const crypto = require('node:crypto');

(async () => {
  const token = process.env.JUSTDIAL_WEBHOOK_TOKEN;
  if (!token || token.length < 32) throw new Error('Set JUSTDIAL_WEBHOOK_TOKEN in server/.env first.');
  const leadid = `JDLOCAL-${crypto.randomUUID()}`;
  const url = `http://127.0.0.1:${process.env.PORT || 5001}/api/integrations/justdial/${encodeURIComponent(token)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leadid, leadtype: 'category', name: 'LOCAL TEST - Justdial',
      mobile: '9000000000', date: new Date().toISOString().slice(0, 10),
      category: 'GPS Tracking', city: 'Local Test', dncmobile: 1,
      dncphone: 0, parentid: 'LOCAL-TEST'
    })
  });
  const body = await response.text();
  if (response.status !== 200 || body !== 'RECEIVED') {
    throw new Error(`Callback returned HTTP ${response.status}: ${body}`);
  }
  console.log(`Sample enquiry accepted: ${leadid}`);
  console.log('Open http://localhost:5174/leads and look for LOCAL TEST - Justdial.');
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
