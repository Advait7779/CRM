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
const NON_SALES_TABS = new Set([590930498, 1248816267]); // Website Cms and installer applications.
const HEADERLESS_LAYOUTS = new Map([
  [1146694168, ['id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name', 'form_id', 'form_name', 'is_organic', 'platform', 'what_services_are_you_looking_for?', 'full_name', 'phone_number', 'email', 'city', 'lead_status']],
  [451346684, ['id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name', 'form_id', 'form_name', 'is_organic', 'platform', 'for_which_tracking_device_you_are_looking_to_buy?', 'full_name', 'phone_number', 'city', 'lead_status']]
]);
const SERVICE_FIELDS = [
  'what_services_are_you_looking_for?', 'which_service_are_you_interested_in?',
  'for_which_tracking_device_you_are_looking_to_buy?', 'what_device_you_are_looking_for?',
  'are_you_looking_for_fuel_tracking_device?', 'are_you_looking_to_buy_gps_tracking_device?',
  'are_you_looking_for_a_new_cctv_device_or_to_repair_cctv_device??', 'requirement_details?'
];
const MACHINE_FIELDS = new Set(['processing_status', 'whatsapp_status', 'sms_status', 'rcs_status', 'email_status', 'voice_status', 'error_message', 'processed_at']);
let cachedToken = null;

function sheetConfig(env = process.env) {
  return {
    spreadsheetId: String(env.FACEBOOK_SHEET_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID).trim(),
    sheetId: Number(env.FACEBOOK_SHEET_GID || DEFAULT_SHEET_ID),
    webhookUrl: String(env.FACEBOOK_SHEET_WEBHOOK_URL || '').trim(),
    readSecret: String(env.FACEBOOK_SHEET_READ_SECRET || '').trim(),
    clientEmail: String(env.FACEBOOK_SHEET_CLIENT_EMAIL || '').trim(),
    privateKey: String(env.FACEBOOK_SHEET_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim(),
    intervalMinutes: Math.max(1, Number.parseInt(env.FACEBOOK_SHEET_SYNC_INTERVAL_MINUTES || '5', 10) || 5)
  };
}

function configurationIssues(config) {
  const issues = [];
  if (!/^[A-Za-z0-9_-]+$/.test(config.spreadsheetId)) issues.push('FACEBOOK_SHEET_SPREADSHEET_ID is invalid');
  if (!Number.isSafeInteger(config.sheetId) || config.sheetId < 0) issues.push('FACEBOOK_SHEET_GID is invalid');
  if (config.webhookUrl || config.readSecret) {
    let url;
    try { url = new URL(config.webhookUrl); } catch { /* Report a safe reason below. */ }
    if (!url || url.protocol !== 'https:' || url.hostname !== 'script.google.com'
      || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) {
      issues.push('FACEBOOK_SHEET_WEBHOOK_URL must be an HTTPS Apps Script /exec URL');
    }
    if (config.readSecret.length < 32) issues.push('FACEBOOK_SHEET_READ_SECRET must have at least 32 characters');
  } else if (config.clientEmail || config.privateKey) {
    if (!/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(config.clientEmail)) issues.push('FACEBOOK_SHEET_CLIENT_EMAIL is missing or invalid');
    try { crypto.createPrivateKey(config.privateKey); }
    catch { issues.push('FACEBOOK_SHEET_PRIVATE_KEY is missing or invalid'); }
  } else {
    issues.push('Set FACEBOOK_SHEET_WEBHOOK_URL and FACEBOOK_SHEET_READ_SECRET on the CRM server');
  }
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

async function bridgeRequest(config, action, details = {}, fetchImpl = fetch) {
  const response = await fetchImpl(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, secret: config.readSecret, ...details }),
    redirect: 'follow',
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success !== true) {
    throw new Error(`Facebook sheet Apps Script ${action} failed: ${data.error || `HTTP ${response.status}`}.`);
  }
  return data;
}

async function listFacebookTabs(config, fetchImpl = fetch) {
  if (config.webhookUrl) {
    const data = await bridgeRequest(config, 'listTabs', {}, fetchImpl);
    if (!Array.isArray(data.tabs) || data.tabs.length > 200 || data.tabs.some(tab =>
      !Number.isSafeInteger(tab.gid) || tab.gid < 0 || typeof tab.title !== 'string'
      || !tab.title || !Number.isSafeInteger(tab.index))) {
      throw new Error('Facebook sheet Apps Script returned invalid tab metadata.');
    }
    return data.tabs.map(tab => ({ gid: tab.gid, title: tab.title, index: tab.index,
      rowCount: tab.rowCount ?? 0, columnCount: tab.columnCount ?? 0 })).sort((a, b) => a.index - b.index);
  }
  const token = await accessToken(config, fetchImpl);
  const headers = { Authorization: `Bearer ${token}` };
  const base = `${SHEETS_URL}/${encodeURIComponent(config.spreadsheetId)}`;
  const metadataResponse = await fetchImpl(`${base}?fields=sheets(properties(sheetId,title,index,gridProperties,hidden))`, {
    headers, signal: AbortSignal.timeout(20000)
  });
  const metadata = await jsonResponse(metadataResponse, 'Facebook sheet metadata read');
  return (metadata.sheets || []).map(sheet => sheet.properties).filter(tab => tab?.title && !tab.hidden).map(tab => ({
    gid: tab.sheetId, title: tab.title, index: tab.index ?? 0,
    rowCount: tab.gridProperties?.rowCount ?? 0, columnCount: tab.gridProperties?.columnCount ?? 26
  })).sort((a, b) => a.index - b.index);
}

function columnLetter(index) {
  let number = index + 1;
  let result = '';
  while (number > 0) { number -= 1; result = String.fromCharCode(65 + number % 26) + result; number = Math.floor(number / 26); }
  return result;
}

async function readFacebookTab(config, gid, fetchImpl = fetch) {
  const tabs = await listFacebookTabs(config, fetchImpl);
  const tab = tabs.find(item => item.gid === gid);
  if (!tab) { const error = new Error('Spreadsheet tab not found.'); error.status = 404; throw error; }
  if (config.webhookUrl) {
    const values = [];
    let startRow = 1;
    for (let page = 0; page < 1000; page += 1) {
      const data = await bridgeRequest(config, 'readTab', { gid, startRow, limit: 250 }, fetchImpl);
      if (!Array.isArray(data.values) || data.values.length > 250 || data.values.some(row =>
        !Array.isArray(row) || row.length > 52 || row.some(value => typeof value !== 'string'))
        || typeof data.hasMore !== 'boolean'
        || !Number.isSafeInteger(data.nextRow) || data.nextRow !== startRow + data.values.length
        || (data.hasMore && !data.values.length)) {
        throw new Error('Facebook sheet Apps Script returned invalid tab rows.');
      }
      values.push(...data.values);
      if (!data.hasMore) return { ...tab, values };
      startRow = data.nextRow;
    }
    throw new Error('Facebook sheet Apps Script exceeded the page limit.');
  }
  const token = await accessToken(config, fetchImpl);
  const base = `${SHEETS_URL}/${encodeURIComponent(config.spreadsheetId)}`;
  const lastColumn = columnLetter(Math.min(Math.max(tab.columnCount, 1), 52) - 1);
  const range = `'${tab.title.replace(/'/g, "''")}'!A1:${lastColumn}`;
  const valuesResponse = await fetchImpl(`${base}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000)
  });
  const data = await jsonResponse(valuesResponse, 'Facebook sheet values read');
  return { ...tab, values: Array.isArray(data.values) ? data.values : [] };
}

async function readFacebookRows(config, fetchImpl = fetch) {
  const data = await readFacebookTab(config, config.sheetId, fetchImpl);
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

function isMetaHeader(row) {
  return String(row?.[0] || '').trim().toLowerCase() === 'id'
    && String(row?.[1] || '').trim().toLowerCase() === 'created_time'
    && row.includes('platform') && row.includes('full_name') && row.includes('phone_number');
}

function analyzeFacebookTab(tab) {
  const values = tab.values || [];
  const synthetic = HEADERLESS_LAYOUTS.get(tab.gid);
  const headerRowIndex = synthetic ? -1 : values.slice(0, 10).findIndex(isMetaHeader);
  const importable = !NON_SALES_TABS.has(tab.gid) && (Boolean(synthetic) || headerRowIndex >= 0);
  const maxColumns = Math.min(52, Math.max(0, ...values.map(row => row.length)));
  const realHeader = headerRowIndex >= 0 ? values[headerRowIndex] : values[0] || [];
  const hasOtherHeader = !importable && ['id', 'ID', 'phone_number'].includes(String(realHeader[0] || ''));
  const sourceHeaders = synthetic || (importable || hasOtherHeader ? realHeader : []);
  const headers = Array.from({ length: maxColumns }, (_, index) => sourceHeaders[index] || `Column ${columnLetter(index)}`);
  const rows = values.map((row, index) => ({ rowNumber: index + 1, values: row })).filter(({ rowNumber, values: row }) =>
    row.some(value => String(value ?? '').trim())
    && (headerRowIndex < 0 || rowNumber !== headerRowIndex + 1)
    && !isMetaHeader(row)
    && !(hasOtherHeader && rowNumber === 1));
  return {
    gid: tab.gid, title: tab.title, headers, rows, importable,
    kind: !rows.length ? 'empty' : importable ? 'meta' : 'other',
    reason: importable ? null : NON_SALES_TABS.has(tab.gid) ? 'This tab is not a sales-lead source.' : 'A stable Meta lead ID, name, phone and platform could not be identified.'
  };
}

function rowToLead(headers, row, tab = {}) {
  const raw = Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, String(row[index] ?? '').trim()]));
  const id = raw.id;
  const platform = String(raw.platform || '').toLowerCase();
  if (!/^(?:l:)?\d+$/.test(id) || !['fb', 'ig'].includes(platform)) return null;
  const name = String(raw.full_name || '').slice(0, 255);
  const phone = String(raw.phone_number || '').replace(/^p:/i, '').replace(/[\s()-]/g, '').slice(0, 255);
  const date = new Date(raw.created_time);
  if (!name || !/^\+?\d{7,15}$/.test(phone) || Number.isNaN(date.getTime())) throw new Error(`Facebook sheet lead ${id} has invalid required fields.`);
  const rawService = SERVICE_FIELDS.map(field => raw[field]).find(Boolean);
  const service = /\b(gps|fuel|tracking)\b/i.test(tab.title || '') ? 'GPS Tracking'
    : /\bcctv\b/i.test(tab.title || '') ? 'CCTV' : displayService(rawService);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email || '') ? raw.email.slice(0, 255) : null;
  const extraNotes = headers.slice(18).filter(header => !MACHINE_FIELDS.has(String(header).trim().toLowerCase()))
    .map(header => raw[header] && `${header}: ${raw[header]}`).filter(Boolean);
  return {
    name, phone, email, source: 'Facebook', service,
    justdialProduct: classifyJustdialCategory(service), status: 'New',
    notes: [raw.city && `City: ${raw.city}`, `Platform: ${platform === 'ig' ? 'Instagram' : 'Facebook'}`,
      raw.campaign_name && `Campaign: ${raw.campaign_name}`, raw.form_name && `Form: ${raw.form_name}`,
      ...extraNotes].filter(Boolean).join('\n'),
    facebookLeadId: id, facebookSubmittedAt: date, facebookPlatform: platform,
    facebookPayload: { ...raw, sheetGid: tab.gid ?? null, sheetTitle: tab.title ?? null }
  };
}

async function processFacebookSheetLeads(prisma, { env = process.env, fetchImpl = fetch, gid } = {}) {
  const config = sheetConfig(env);
  if (configurationIssues(config).length) return { enabled: false, imported: 0 };
  const tab = analyzeFacebookTab(await readFacebookTab(config, gid ?? config.sheetId, fetchImpl));
  if (!tab.importable) {
    const error = new Error(`Facebook sheet header layout cannot be imported: ${tab.reason}`);
    error.status = 422;
    throw error;
  }
  const candidates = tab.rows.filter(({ values }) => String(values[0] || '').trim());
  const normalized = new Map();
  let skipped = 0;
  for (const { values: row } of candidates.reverse()) {
    try {
      const data = rowToLead(tab.headers, row, tab);
      if (!data) { skipped += 1; continue; }
      normalized.set(data.facebookLeadId, prepareData('leads', data, { create: true }));
    } catch (error) {
      skipped += 1;
      console.error(`Facebook sheet lead ${String(row[0]).trim()} could not be imported:`, error.message);
    }
  }
  const ids = [...normalized.keys()];
  const known = new Map();
  for (let start = 0; start < ids.length; start += 250) {
    const found = await prisma.leads.findMany({
      where: { facebookLeadId: { in: ids.slice(start, start + 250) } },
      select: { id: true, facebookLeadId: true }
    });
    for (const lead of found) known.set(lead.facebookLeadId, lead.id);
  }
  let imported = 0;
  const missing = [...normalized.entries()].filter(([id]) => !known.has(id));
  for (let start = 0; start < missing.length; start += 100) {
    const batch = missing.slice(start, start + 100);
    try {
      imported += (await prisma.leads.createMany({ data: batch.map(([, data]) => data), skipDuplicates: true })).count;
    } catch (error) {
      // Keep later rows moving if one row in a bulk insert has invalid data.
      for (const [id, data] of batch) {
        try { await prisma.leads.create({ data }); imported += 1; }
        catch (rowError) {
          if (rowError.code !== 'P2002') { skipped += 1; console.error(`Facebook sheet lead ${id} could not be imported:`, rowError.message); }
        }
      }
    }
  }
  const mappings = [];
  for (let start = 0; start < ids.length; start += 250) {
    const found = await prisma.leads.findMany({
      where: { facebookLeadId: { in: ids.slice(start, start + 250) } },
      select: { id: true, facebookLeadId: true }
    });
    mappings.push(...found.map(lead => ({
      leadId: lead.id, spreadsheetId: config.spreadsheetId, sheetGid: tab.gid, externalLeadId: lead.facebookLeadId
    })));
  }
  let mapped = 0;
  for (let start = 0; start < mappings.length; start += 250) {
    mapped += (await prisma.facebookLeadTabs.createMany({ data: mappings.slice(start, start + 250), skipDuplicates: true })).count;
    }
  return { enabled: true, imported, mapped, skipped, examined: candidates.length, gid: tab.gid, title: tab.title };
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

module.exports = {
  sheetConfig, configurationIssues, listFacebookTabs, readFacebookTab, readFacebookRows,
  analyzeFacebookTab, rowToLead, processFacebookSheetLeads, startFacebookSheetSync
};
