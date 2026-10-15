const { importWebsiteLead } = require('./websiteLeadImport');

const EXPECTED_HEADERS = ['ID', 'Name', 'Phone', 'Email', 'Service', 'Source Form', 'Status', 'Message', 'Date'];

function sheetConfig(env = process.env) {
  const start = String(env.WEBSITE_SHEET_START_AFTER_ID || '').trim();
  const startAfterId = /^\d+$/.test(start) ? Number(start) : NaN;
  return {
    webhookUrl: String(env.WEBSITE_SHEET_WEBHOOK_URL || '').trim(),
    readSecret: String(env.WEBSITE_SHEET_READ_SECRET || '').trim(),
    startAfterId,
    intervalMinutes: Math.max(1, Number.parseInt(env.WEBSITE_SHEET_SYNC_INTERVAL_MINUTES || '5', 10) || 5)
  };
}

function isConfigured(config) {
  let url;
  try { url = new URL(config.webhookUrl); } catch { return false; }
  return Boolean(url.protocol === 'https:' && url.hostname === 'script.google.com'
    && /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)
    && config.readSecret.length >= 32
    && Number.isSafeInteger(config.startAfterId) && config.startAfterId >= 0);
}

async function readWebsiteRows(config, fetchImpl = fetch) {
  const rows = [];
  let afterId = config.startAfterId;
  for (let page = 0; page < 1000; page += 1) {
    const response = await fetchImpl(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'readLeads', secret: config.readSecret, afterId }),
      redirect: 'follow',
      signal: AbortSignal.timeout(20000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success !== true) {
      throw new Error(`Website sheet webhook read failed (${response.status}): ${data.error || response.statusText || 'unknown error'}`);
    }
    if (!Array.isArray(data.headers) || !EXPECTED_HEADERS.every((header, index) => data.headers[index] === header)
      || !Array.isArray(data.rows) || data.rows.length > 250 || typeof data.hasMore !== 'boolean') {
      throw new Error('Website Cms webhook returned an unexpected lead layout.');
    }
    if (!data.rows.length) {
      if (data.hasMore) throw new Error('Website Cms webhook returned an empty page with more rows pending.');
      return rows;
    }
    let lastId = afterId;
    for (const row of data.rows) {
      const id = Number(row?.[0]);
      if (!Array.isArray(row) || !Number.isSafeInteger(id) || id <= lastId) {
        throw new Error('Website Cms webhook returned an invalid page cursor.');
      }
      lastId = id;
    }
    rows.push(...data.rows);
    if (!data.hasMore) return rows;
    afterId = lastId;
  }
  throw new Error('Website Cms webhook exceeded the page limit.');
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
    console.log('Website sheet sync disabled: configure the Apps Script read webhook and WEBSITE_SHEET_START_AFTER_ID.');
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
