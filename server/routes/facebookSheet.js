const express = require('express');
const ExcelJS = require('exceljs');
const { authMiddleware, checkRole } = require('../middleware/auth');
const { canAccessLead, leadAccessWhere } = require('../services/justdialProducts');
const { jsonReplacer, prepareData } = require('../utils/prismaData');
const {
  sheetConfig, configurationIssues, listFacebookTabs, readFacebookTab,
  analyzeFacebookTab, rowToLead, processFacebookSheetLeads
} = require('../services/facebookSheetSync');

const SALES = ['super_admin', 'director', 'sales_manager', 'sales_executive'];
const ADMIN = ['super_admin', 'director'];
const asyncHandler = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const isAdmin = user => ADMIN.includes(user.role);
const ACTION_STATUSES = new Set(['New', 'Connected', 'Future Prospect', 'Fake Enquiry',
  'Interested', 'Not Interested', 'Follow-Up Required', "Didn't Answered"]);
const rowKeyFor = (tab, row) => {
  const id = String(row.values[0] || '').trim();
  return tab.importable && /^(?:l:)?\d+$/.test(id) ? `id:${id}` : `row:${row.rowNumber}`;
};

function gidFrom(value) {
  const gid = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(gid) || gid < 0) {
    const error = new Error('Invalid spreadsheet tab ID.');
    error.status = 400;
    throw error;
  }
  return gid;
}

function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize || '25', 10) || 25));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

async function visibleTabRows(prisma, user, tab, spreadsheetId) {
  if (!isAdmin(user) && !tab.importable) {
    const error = new Error('This tab is not a mapped sales-lead source.');
    error.status = 403;
    throw error;
  }
  const ids = tab.importable ? [...new Set(tab.rows.map(({ values }) => String(values[0] || '').trim()).filter(Boolean))] : [];
  const existing = new Map();
  for (let start = 0; start < ids.length; start += 250) {
    const found = await prisma.leads.findMany({
      where: { facebookLeadId: { in: ids.slice(start, start + 250) } },
      select: { id: true, facebookLeadId: true, status: true, exec: true, justdialProduct: true, convertedCustomerId: true }
    });
    for (const lead of found) existing.set(lead.facebookLeadId, lead);
  }
  const annotations = await prisma.facebookSheetRowStatuses.findMany({
    where: { spreadsheetId, sheetGid: tab.gid },
    select: { rowKey: true, status: true }
  });
  const statuses = new Map(annotations.map(row => [row.rowKey, row.status]));
  return tab.rows.flatMap(({ rowNumber, values }) => {
    let lead = null;
    if (tab.importable) {
      try { lead = rowToLead(tab.headers, values, tab); }
      catch { /* Admins can still inspect malformed source rows. */ }
    }
    const crm = lead ? existing.get(lead.facebookLeadId) || null : null;
    if (!isAdmin(user) && (!lead || !canAccessLead(user, crm || lead))) return [];
    const rowKey = rowKeyFor(tab, { rowNumber, values });
    return [{ rowNumber, rowKey, values, status: crm ? jsonReplacer('status', crm.status) : statuses.get(rowKey) || 'New',
      crm: crm && { id: crm.id, status: jsonReplacer('status', crm.status), exec: crm.exec, convertedCustomerId: crm.convertedCustomerId },
      lead: lead && { id: lead.facebookLeadId, name: lead.name, phone: lead.phone, service: lead.service,
        platform: lead.facebookPlatform, submittedAt: lead.facebookSubmittedAt, product: lead.justdialProduct } }];
  });
}

function createFacebookSheetRouter(prisma, { env = process.env, fetchImpl = fetch, prewarm = true } = {}) {
  const router = express.Router();
  const tabCache = new Map();
  const cacheDurationMs = 5 * 60_000;
  const maxCachedTabs = 30;
  const warmQueue = [];
  const queued = new Set();
  let activeWarmReads = 0;
  async function readLiveTab(gid) {
    const cached = tabCache.get(gid);
    if (cached?.pending) return cached.pending;
    const pending = readFacebookTab(sheetConfig(env), gid, fetchImpl).then(analyzeFacebookTab)
      .then(tab => ({ ...tab, fetchedAt: new Date().toISOString() }));
    tabCache.set(gid, { ...cached, pending });
    try {
      const tab = await pending;
      if (tabCache.get(gid)?.pending === pending) {
        tabCache.delete(gid);
        tabCache.set(gid, { tab, expiresAt: Date.now() + cacheDurationMs });
        while (tabCache.size > maxCachedTabs) tabCache.delete(tabCache.keys().next().value);
      }
      return tab;
    } catch (error) {
      if (tabCache.get(gid)?.pending === pending) {
        if (cached?.tab) tabCache.set(gid, cached);
        else tabCache.delete(gid);
      }
      throw error;
    }
  }
  async function getTab(gid, refresh = false) {
    const cached = tabCache.get(gid);
    if (!refresh && cached?.tab) {
      if (cached.expiresAt <= Date.now() && !cached.pending) {
        readLiveTab(gid).catch(error => console.error('Facebook sheet background refresh failed:', error.message));
      }
      return cached.tab;
    }
    return readLiveTab(gid);
  }
  function drainWarmQueue() {
    while (activeWarmReads < 2 && warmQueue.length) {
      const gid = warmQueue.shift();
      queued.delete(gid);
      if (tabCache.get(gid)?.tab || tabCache.get(gid)?.pending) continue;
      activeWarmReads += 1;
      getTab(gid).catch(error => console.error('Facebook sheet prefetch failed:', error.message))
        .finally(() => { activeWarmReads -= 1; drainWarmQueue(); });
    }
  }
  function prewarmTabs(tabs) {
    if (!prewarm) return;
    for (const { gid } of tabs) {
      if (tabCache.has(gid) || queued.has(gid)) continue;
      queued.add(gid);
      warmQueue.push(gid);
    }
    drainWarmQueue();
  }
  if (prewarm && !configurationIssues(sheetConfig(env)).length) {
    const startupWarm = setTimeout(() => {
      listFacebookTabs(sheetConfig(env), fetchImpl).then(prewarmTabs)
        .catch(error => console.error('Facebook sheet prefetch setup failed:', error.message));
    }, 1000);
    startupWarm.unref?.();
  }
  router.use(authMiddleware, checkRole(SALES));

  router.get('/tabs', asyncHandler(async (req, res) => {
    const config = sheetConfig(env);
    const issues = configurationIssues(config);
    if (issues.length) return res.json({ configured: false, tabs: [], issues });
    const tabs = await listFacebookTabs(config, fetchImpl, req.query.refresh === '1');
    res.json({ configured: true, tabs });
    setImmediate(() => prewarmTabs(tabs));
  }));

  router.get('/crm', asyncHandler(async (req, res) => {
    const { page, pageSize, skip } = pagination(req.query);
    const search = String(req.query.search || '').trim().slice(0, 200);
    const where = {
      source: 'Facebook', ...leadAccessWhere(req.user),
      ...(search ? { OR: ['name', 'phone', 'company', 'service', 'justdialProduct'].map(field => ({ [field]: { contains: search, mode: 'insensitive' } })) } : {})
    };
    const [rows, total] = await Promise.all([
      prisma.leads.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize,
        select: { id: true, name: true, phone: true, service: true, status: true, exec: true, source: true, convertedCustomerId: true,
          justdialProduct: true, facebookLeadId: true, facebookPlatform: true, facebookSubmittedAt: true, createdAt: true } }),
      prisma.leads.count({ where })
    ]);
    res.json({ rows, total, page, pageSize });
  }));

  router.get('/tabs/:gid/export.xlsx', asyncHandler(async (req, res) => {
    const gid = gidFrom(req.params.gid);
    const config = sheetConfig(env);
    if (configurationIssues(config).length) return res.status(503).json({ message: 'Facebook sheet connection is not configured on the server.' });
    const tab = await getTab(gid);
    const search = String(req.query.search || '').trim().toLowerCase().slice(0, 200);
    const available = await visibleTabRows(prisma, req.user, tab, config.spreadsheetId);
    const rows = search ? available.filter(row => [...row.values, row.status, row.crm?.exec]
      .some(value => String(value ?? '').toLowerCase().includes(search))) : available;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet rows', { views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }] });
    sheet.addRow(['Sheet row', 'Lead status', ...tab.headers]);
    rows.forEach(row => sheet.addRow([row.rowNumber, row.status, ...tab.headers.map((_, index) => String(row.values[index] ?? ''))]));
    sheet.getRow(1).font = { bold: true };
    sheet.getColumn(1).width = 12;
    sheet.getColumn(2).width = 20;
    for (let index = 3; index <= tab.headers.length + 2; index += 1) sheet.getColumn(index).width = 24;
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(2, sheet.rowCount), column: tab.headers.length + 2 } };
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="facebook-sheet-tab-${gid}.xlsx"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(buffer));
  }));

  router.get('/tabs/:gid', asyncHandler(async (req, res) => {
    const gid = gidFrom(req.params.gid);
    const config = sheetConfig(env);
    if (configurationIssues(config).length) return res.status(503).json({ message: 'Facebook sheet connection is not configured on the server.' });
    const tab = await getTab(gid, req.query.refresh === '1');
    const rows = await visibleTabRows(prisma, req.user, tab, config.spreadsheetId);
    const search = String(req.query.search || '').trim().toLowerCase().slice(0, 200);
    const visible = search ? rows.filter(row => [...row.values, row.status, row.crm?.exec]
      .some(value => String(value ?? '').toLowerCase().includes(search))) : rows;
    const { page, pageSize, skip } = pagination(req.query);
    const mappedCount = rows.filter(row => row.crm).length;
    res.json({ tab: { gid: tab.gid, title: tab.title, kind: tab.kind, importable: tab.importable, reason: tab.reason },
      headers: tab.headers, rows: visible.slice(skip, skip + pageSize), total: visible.length,
      mappedCount, page, pageSize, fetchedAt: tab.fetchedAt });
  }));

  router.post('/tabs/:gid/sync', checkRole(ADMIN), asyncHandler(async (req, res) => {
    const gid = gidFrom(req.params.gid);
    const result = await processFacebookSheetLeads(prisma, { env, fetchImpl, gid });
    if (!result.enabled) return res.status(503).json({ message: 'Facebook sheet connection is not configured on the server.' });
    res.json(result);
  }));

  router.put('/tabs/:gid/rows/:rowNumber/status', asyncHandler(async (req, res) => {
    const gid = gidFrom(req.params.gid);
    const rowNumber = Number(req.params.rowNumber);
    const status = String(req.body?.status || '');
    if (!Number.isSafeInteger(rowNumber) || rowNumber < 1 || !ACTION_STATUSES.has(status)) {
      return res.status(400).json({ message: 'Invalid sheet row or lead status.' });
    }
    const config = sheetConfig(env);
    if (configurationIssues(config).length) return res.status(503).json({ message: 'Facebook sheet connection is not configured on the server.' });
    const tab = await getTab(gid);
    const row = (await visibleTabRows(prisma, req.user, tab, config.spreadsheetId))
      .find(candidate => candidate.rowNumber === rowNumber);
    if (!row) return res.status(404).json({ message: 'Sheet row not found.' });
    if (row.crm) {
      if (row.crm.status === 'Converted' || row.crm.convertedCustomerId) {
        return res.status(409).json({ message: 'A converted lead cannot be given another status.' });
      }
      await prisma.leads.update({ where: { id: row.crm.id }, data: prepareData('leads', { status }) });
    } else {
      await prisma.facebookSheetRowStatuses.upsert({
        where: { spreadsheetId_sheetGid_rowKey: { spreadsheetId: config.spreadsheetId, sheetGid: gid, rowKey: row.rowKey } },
        create: { spreadsheetId: config.spreadsheetId, sheetGid: gid, rowKey: row.rowKey, status },
        update: { status, updatedAt: new Date() }
      });
    }
    res.json({ rowNumber, status });
  }));

  return router;
}

module.exports = { createFacebookSheetRouter, gidFrom, pagination };
