const crypto = require('node:crypto');
const { importWebsiteLead } = require('./websiteLeadImport');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

function sheetConfig(env = process.env) {
  const start = String(env.WEBSITE_SHEET_START_AFTER_ID || '').trim();
  const startAfterId = /^\d+$/.test(start) ? Number(start) : NaN;
  const key = env.WEBSITE_SHEET_PRIVATE_KEY_BASE64
    ? Buffer.from(env.WEBSITE_SHEET_PRIVATE_KEY_BASE64, 'base64').toString('utf8')
    : String(env.WEBSITE_SHEET_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return {
    spreadsheetId: String(env.WEBSITE_SHEET_SPREADSHEET_ID || '').trim(),
    sheetName: String(env.WEBSITE_SHEET_TAB_NAME || 'Website Cms').trim(),
    clientEmail: String(env.WEBSITE_SHEET_CLIENT_EMAIL || '').trim(),
    privateKey: key,
    startAfterId,
    intervalMinutes: Math.max(1, Number.parseInt(env.WEBSITE_SHEET_SYNC_INTERVAL_MINUTES || '5', 10) || 5)
  };
}

function isConfigured(config) {
  return Boolean(config.spreadsheetId && config.sheetName && config.clientEmail && config.privateKey
    && Number.isSafeInteger(config.startAfterId) && config.startAfterId >= 0);
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function readJson(response, label) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${label} failed (${response.status}): ${data?.error?.message || data.error_description || data.error || response.statusText}`);
  return data;
}

async function getAccessToken(config, fetchImpl = fetch) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({
    iss: config.clientEmail, scope: SHEETS_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600
  })}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).end().sign(config.privateKey, 'base64url');
  const data = await readJson(await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(15000)
  }), 'Google authorization');
  if (!data.access_token) throw new Error('Google authorization returned no access token.');
  return data.access_token;
}

async function readWebsiteRows(config, fetchImpl = fetch) {
  const token = await getAccessToken(config, fetchImpl);
  const range = `'${config.sheetName.replace(/'/g, "''")}'!A1:I`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
  const data = await readJson(await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000)
  }), 'Google Sheets read');
  const rows = data.values || [];
  const expected = ['ID', 'Name', 'Phone', 'Email', 'Service', 'Source Form', 'Status', 'Message', 'Date'];
  if (!Array.isArray(rows) || !expected.every((header, index) => String(rows[0]?.[index] || '').trim() === header)) {
    throw new Error('Website Cms sheet headers do not match the expected lead columns.');
  }
  return rows.slice(1);
}

function rowToLead(row) {
  return {
    leadId: row[0], name: row[1], phone: row[2], email: row[3], service: row[4],
    formSource: row[5], message: row[7], submittedAt: row[8]
  };
}

async function processWebsiteSheetLeads(prisma, { env = process.env, fetchImpl = fetch } = {}) {
  const config = sheetConfig(env);
  if (!isConfigured(config)) return { enabled: false, imported: 0 };
  const rows = await readWebsiteRows(config, fetchImpl);
  const eligible = rows.filter(row => {
    const id = Number(row?.[0]);
    return Number.isSafeInteger(id) && id > config.startAfterId;
  });
  const ids = eligible.map(row => String(row[0]).trim());
  const existing = ids.length ? await prisma.leads.findMany({
    where: { websiteLeadId: { in: ids } }, select: { websiteLeadId: true }
  }) : [];
  const known = new Set(existing.map(lead => lead.websiteLeadId));
  let imported = 0;
  let skipped = 0;
  for (const row of eligible) {
    const id = String(row[0]).trim();
    if (known.has(id)) continue;
    try {
      const result = await importWebsiteLead(prisma, rowToLead(row));
      if (result.imported) imported += 1;
      known.add(id);
    } catch (error) {
      skipped += 1;
      console.error(`Website sheet lead ${id} could not be imported:`, error.message);
    }
  }
  return { enabled: true, imported, skipped, examined: eligible.length };
}

function startWebsiteSheetSync(prisma, options = {}) {
  const config = sheetConfig(options.env || process.env);
  if (!isConfigured(config)) {
    console.log('Website sheet sync disabled: configure sheet access and WEBSITE_SHEET_START_AFTER_ID.');
    return () => {};
  }
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await processWebsiteSheetLeads(prisma, options);
      if (result.imported || result.skipped) console.log(`Website sheet sync: ${result.imported} imported, ${result.skipped} skipped.`);
    } catch (error) {
      console.error('Website sheet sync failed:', error.message);
    } finally {
      running = false;
    }
  };
  const startup = setTimeout(run, 15000);
  const interval = setInterval(run, config.intervalMinutes * 60000);
  startup.unref();
  interval.unref();
  console.log(`Website sheet sync enabled (every ${config.intervalMinutes} minutes).`);
  return () => { clearTimeout(startup); clearInterval(interval); };
}

module.exports = { sheetConfig, isConfigured, readWebsiteRows, rowToLead, processWebsiteSheetLeads, startWebsiteSheetSync };
