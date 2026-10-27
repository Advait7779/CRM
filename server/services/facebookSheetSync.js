const crypto = require('node:crypto');
const { prepareData } = require('../utils/prismaData');
const { classifyJustdialCategory } = require('./justdialProducts');

const DEFAULT_SPREADSHEET_ID = '1S-ZvDpj2LSc6-z4Cs35PDzDDmsj-Ht_txQCOCOMeubs';
const DEFAULT_SHEET_ID = 1497736270;
const HEADERS = [
  'id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name',
  'campaign_id', 'campaign_name', 'form_id', 'form_name', 'is_organic',
  'platform', 'what_services_are_you_looking_for?', 'full_name',
  'phone_number', 'email', 'city', 'lead_status'
];
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
let cachedToken = null;

function sheetConfig(env = process.env) {
  return {
    spreadsheetId: String(env.FACEBOOK_SHEET_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID).trim(),
    sheetId: Number(env.FACEBOOK_SHEET_GID || DEFAULT_SHEET_ID),
    clientEmail: String(env.FACEBOOK_SHEET_CLIENT_EMAIL || '').trim(),
    privateKey: String(env.FACEBOOK_SHEET_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim(),
    intervalMinutes: Math.max(1, Number.parseInt(env.FACEBOOK_SHEET_SYNC_INTERVAL_MINUTES || '5', 10) || 5)
  };
}

function configurationIssues(config) {
  const issues = [];
  if (!/^[A-Za-z0-9_-]+$/.test(config.spreadsheetId)) issues.push('FACEBOOK_SHEET_SPREADSHEET_ID is invalid');
  if (!Number.isSafeInteger(config.sheetId) || config.sheetId < 0) issues.push('FACEBOOK_SHEET_GID is invalid');
  if (!/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(config.clientEmail)) issues.push('FACEBOOK_SHEET_CLIENT_EMAIL is missing or invalid');
  try { crypto.createPrivateKey(config.privateKey); }
  catch { issues.push('FACEBOOK_SHEET_PRIVATE_KEY is missing or invalid'); }
  return issues;
}

async function jsonResponse(response, label) {
  if (!response.ok) throw new Error(`${label} failed (HTTP ${response.status}).`);
  return response.json();
}

async function accessToken(config, fetchImpl = fetch) {
  if (cachedToken?.email === config.clientEmail && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const assertionBody = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: config.clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  })}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(assertionBody), config.privateKey).toString('base64url');
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${assertionBody}.${signature}` }),
    signal: AbortSignal.timeout(20000)
  });
  const token = await jsonResponse(response, 'Facebook sheet authentication');
  if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Facebook sheet authentication returned no access token.');
  cachedToken = { email: config.clientEmail, value: token.access_token, expiresAt: Date.now() + Math.min(Number(token.expires_in) || 3600, 3600) * 1000 };
  return cachedToken.value;
}

async function readFacebookRows(config, fetchImpl = fetch) {
  const token = await accessToken(config, fetchImpl);
  const headers = { Authorization: `Bearer ${token}` };
  const base = `${SHEETS_URL}/${encodeURIComponent(config.spreadsheetId)}`;
  const metadataResponse = await fetchImpl(`${base}?fields=sheets(properties(sheetId,title))`, {
    headers, signal: AbortSignal.timeout(20000)
  });
  const metadata = await jsonResponse(metadataResponse, 'Facebook sheet metadata read');
  const tab = metadata.sheets?.find(sheet => sheet.properties?.sheetId === config.sheetId)?.properties;
  if (!tab?.title) throw new Error('Facebook sheet tab ID was not found.');
  const range = `'${tab.title.replace(/'/g, "''")}'!A1:Z`;
  const valuesResponse = await fetchImpl(`${base}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`, {
    headers, signal: AbortSignal.timeout(30000)
  });
  const data = await jsonResponse(valuesResponse, 'Facebook sheet values read');
  if (!Array.isArray(data.values) || !HEADERS.every((header, index) => data.values[0]?.[index] === header)) {
    throw new Error('Facebook sheet header layout changed; no leads were imported.');
  }
  return { headers: data.values[0], rows: data.values.slice(1) };
}

function displayService(raw) {
  const service = String(raw || '').trim();
  if (!service) return 'Other';
  const known = {
    sms_marketing: 'SMS Marketing', whatsapp_api_for_business: 'WhatsApp API for Business',
    voice_call: 'Voice Call', rcs_messaging: 'RCS Messaging', other: 'Other'
  };
  return (known[service] || service.replaceAll('_', ' ')).slice(0, 255);
}

function rowToLead(headers, row) {
  const raw = Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, String(row[index] ?? '').trim()]));
  const id = raw.id;
  const platform = raw.platform.toLowerCase();
  if (!/^(?:l:)?\d+$/.test(id) || !['fb', 'ig'].includes(platform)) return null;
  const name = raw.full_name.slice(0, 255);
  const phone = raw.phone_number.replace(/^p:/i, '').replace(/[\s()-]/g, '').slice(0, 255);
  const date = new Date(raw.created_time);
  if (!name || !/^\+?\d{7,15}$/.test(phone) || Number.isNaN(date.getTime())) throw new Error(`Facebook sheet lead ${id} has invalid required fields.`);
  const service = displayService(raw['what_services_are_you_looking_for?']);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email) ? raw.email.slice(0, 255) : null;
  const extraNotes = headers.slice(18).map(header => raw[header] && `${header}: ${raw[header]}`).filter(Boolean);
  return {
    name, phone, email, source: 'Facebook', service,
    justdialProduct: classifyJustdialCategory(service), status: 'New',
    notes: [raw.city && `City: ${raw.city}`, `Platform: ${platform === 'ig' ? 'Instagram' : 'Facebook'}`,
      raw.campaign_name && `Campaign: ${raw.campaign_name}`, raw.form_name && `Form: ${raw.form_name}`,
      ...extraNotes].filter(Boolean).join('\n'),
    facebookLeadId: id, facebookSubmittedAt: date, facebookPlatform: platform,
    facebookPayload: raw
  };
}

async function processFacebookSheetLeads(prisma, { env = process.env, fetchImpl = fetch } = {}) {
  const config = sheetConfig(env);
  if (configurationIssues(config).length) return { enabled: false, imported: 0 };
  const { headers, rows } = await readFacebookRows(config, fetchImpl);
  const candidates = rows.filter(row => Array.isArray(row) && row.length && String(row[0] || '').trim());
  const ids = [...new Set(candidates.map(row => String(row[0]).trim()))];
  const existing = [];
  for (let start = 0; start < ids.length; start += 250) {
    existing.push(...await prisma.leads.findMany({
      where: { facebookLeadId: { in: ids.slice(start, start + 250) } },
      select: { facebookLeadId: true }
    }));
  }
  const known = new Set(existing.map(lead => lead.facebookLeadId));
  let imported = 0;
  let skipped = 0;
  // The sheet is newest first. Import oldest first so the CRM list shows the newest leads first.
  for (const row of candidates.reverse()) {
    const id = String(row[0]).trim();
    if (known.has(id)) continue;
    try {
      const data = rowToLead(headers, row);
      if (!data) { skipped += 1; continue; }
      await prisma.leads.create({ data: prepareData('leads', data, { create: true }) });
      imported += 1;
      known.add(id);
    } catch (error) {
      if (error.code === 'P2002') {
        const duplicate = await prisma.leads.findUnique({ where: { facebookLeadId: id }, select: { id: true } });
        if (duplicate) { known.add(id); continue; }
      }
      skipped += 1;
      console.error(`Facebook sheet lead ${id} could not be imported:`, error.message);
    }
  }
  return { enabled: true, imported, skipped, examined: candidates.length };
}

function startFacebookSheetSync(prisma, options = {}) {
  const config = sheetConfig(options.env || process.env);
  const issues = configurationIssues(config);
  if (issues.length) {
    console.log(`Facebook sheet sync disabled: ${issues.join('; ')}.`);
    return () => {};
  }
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await processFacebookSheetLeads(prisma, options);
      if (result.imported || result.skipped) console.log(`Facebook sheet sync: ${result.imported} imported, ${result.skipped} skipped.`);
    } catch (error) {
      console.error('Facebook sheet sync failed:', error.message);
    } finally {
      running = false;
    }
  };
  const startup = setTimeout(run, 15000);
  const interval = setInterval(run, config.intervalMinutes * 60000);
  startup.unref();
  interval.unref();
  console.log(`Facebook sheet sync enabled (every ${config.intervalMinutes} minutes).`);
  return () => { clearTimeout(startup); clearInterval(interval); };
}

module.exports = { sheetConfig, configurationIssues, readFacebookRows, rowToLead, processFacebookSheetLeads, startFacebookSheetSync };
