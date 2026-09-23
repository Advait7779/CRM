const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { prisma, Prisma } = require('../config/prisma');
const { currentDateOnly, prepareData, prismaId, toDateOnly } = require('../utils/prismaData');
const { authMiddleware, checkRole } = require('../middleware/auth');
const { sendMultiChannelNotification } = require('../services/notificationService');
const { isGroupMember, groupAccessWhere } = require('../utils/accessPolicy');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const queueMultiChannelNotification = (payload) => setImmediate(() => {
  sendMultiChannelNotification(payload).catch((error) => console.error('Background notification failed:', error.message));
});

const ADMIN = ['super_admin', 'director'];
const SALES = [...ADMIN, 'sales_manager', 'sales_executive'];
const OPERATIONS = [...ADMIN, 'installation_manager', 'gps_installer', 'cctv_technician', 'website_developer'];
const SUPPORT = [...ADMIN, 'support_executive'];
const FINANCE = [...ADMIN, 'accounts'];
const MANAGEMENT = [...ADMIN, 'sales_manager', 'installation_manager'];
const REPORTING = [...ADMIN, 'accounts', 'sales_manager', 'installation_manager'];
const ALL_STAFF = [
  ...ADMIN, 'accounts', 'sales_manager', 'sales_executive', 'installation_manager',
  'gps_installer', 'cctv_technician', 'website_developer', 'digital_marketing',
  'support_executive'
];
const ASSIGNABLE_USER_ROLES = ALL_STAFF.filter((role) => role !== 'super_admin');
const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  tokenVersion: true,
  createdAt: true,
  updatedAt: true
};

const NOTIFICATION_SELECT = {
  id: true,
  userId: true,
  type: true,
  title: true,
  message: true,
  link: true,
  read: true,
  createdAt: true,
  updatedAt: true
};
const databaseColumnPromises = new Map();

function prismaModel(model) {
  return Prisma.dmmf.datamodel.models.find((item) => item.name.toLowerCase() === String(model).toLowerCase());
}

async function databaseColumns(model) {
  const modelMeta = prismaModel(model);
  if (!modelMeta) return new Map();
  const tableName = modelMeta.dbName || modelMeta.name;
  if (!databaseColumnPromises.has(tableName)) {
    databaseColumnPromises.set(tableName, prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tableName}
    `.then((rows) => new Map(rows.map((row) => [row.column_name, row.data_type]))));
  }
  return databaseColumnPromises.get(tableName);
}

async function hasTaskAssignedUserIdColumn() {
  return (await databaseColumns('tasks')).has('assignedUserId');
}

async function compatibilitySelect(model) {
  const modelMeta = prismaModel(model);
  if (!modelMeta) return {};
  const columns = await databaseColumns(model);
  const select = Object.fromEntries(modelMeta.fields
    .filter((field) => {
      const dataType = columns.get(field.dbName || field.name);
      return field.kind !== 'object' && dataType && !(field.type === 'Decimal' && ['character varying', 'text'].includes(dataType));
    })
    .map((field) => [field.name, true]));
  return { select };
}

async function restoreLegacyDecimalFields(model, records) {
  if (!records.length) return records;
  const modelMeta = prismaModel(model);
  if (!modelMeta) return records;
  const columns = await databaseColumns(model);
  const legacyFields = modelMeta.fields.filter((field) => field.type === 'Decimal' && ['character varying', 'text'].includes(columns.get(field.dbName || field.name)));
  const idField = modelMeta.fields.find((field) => field.isId);
  if (!legacyFields.length || !idField) return records;
  const ids = records.map((record) => record[idField.name]);
  const selectedFields = [idField, ...legacyFields].map((field) => Prisma.raw(`"${field.dbName || field.name}"`));
  const tableName = Prisma.raw(`"${modelMeta.dbName || modelMeta.name}"`);
  const idColumn = Prisma.raw(`"${idField.dbName || idField.name}"`);
  const legacyRows = await prisma.$queryRaw(Prisma.sql`SELECT ${Prisma.join(selectedFields)} FROM ${tableName} WHERE ${idColumn} IN (${Prisma.join(ids)})`);
  const valuesById = new Map(legacyRows.map((row) => [String(row[idField.name]), row]));
  return records.map((record) => {
    const legacy = valuesById.get(String(record[idField.name]));
    return legacy ? { ...record, ...Object.fromEntries(legacyFields.map((field) => [field.name, parseAmount(legacy[field.dbName || field.name])])) } : record;
  });
}

async function removeUndeployedFields(model, payload) {
  const columns = await databaseColumns(model);
  for (const field of Object.keys(payload)) if (!columns.has(field)) delete payload[field];
}
const RESOURCE_CONFIG = {
  leads: {
    model: 'leads',
    fields: ['name', 'phone', 'email', 'company', 'source', 'service', 'status', 'exec', 'followUp', 'notes'],
    required: ['name', 'phone', 'service'],
    roles: SALES,
    readRoles: SALES
  },
  customers: {
    model: 'customers',
    fields: ['name', 'contact', 'phone', 'email', 'gst', 'address', 'services', 'vehicles', 'cctv', 'domain', 'hosting', 'renewalDate', 'status', 'latitude', 'longitude'],
    required: ['name', 'phone'],
    roles: SALES,
    readRoles: ALL_STAFF
  },
  tasks: {
    model: 'tasks',
    fields: ['title', 'desc', 'dept', 'assignedTo', 'assignedUserId', 'priority', 'status', 'due'],
    required: ['title', 'dept'],
    roles: MANAGEMENT,
    readRoles: ALL_STAFF
  },
  tickets: {
    model: 'tickets',
    fields: ['customer', 'subject', 'description', 'service', 'priority', 'status', 'resolution'],
    required: ['customer', 'subject', 'service'],
    roles: [...SUPPORT, 'installation_manager', 'gps_installer', 'cctv_technician'],
    readRoles: [...SUPPORT, ...OPERATIONS]
  },
  employees: {
    model: 'employees',
    fields: ['name', 'dept', 'role', 'phone', 'email', 'status', 'basicSalary', 'incentive', 'deduction', 'payrollStatus'],
    required: ['name', 'dept', 'phone'],
    roles: ADMIN,
    readRoles: ADMIN
  },
  installations: {
    model: 'installations',
    fields: ['type', 'customerId', 'customer', 'vehicle', 'imei', 'sim', 'installer', 'site', 'cameras', 'dvr', 'tech', 'domain', 'hosting', 'design', 'dev', 'goLive', 'date', 'status', 'reportPhoto', 'reportSignature', 'reportNotes'],
    required: ['type', 'customerId'],
    roles: OPERATIONS,
    readRoles: [...OPERATIONS, ...SALES, ...SUPPORT]
  },
  renewals: {
    model: 'renewals',
    fields: ['customer', 'type', 'lastDate', 'nextDue', 'amount', 'daysLeft', 'status'],
    required: ['type', 'nextDue', 'amount'],
    roles: [...SALES, ...FINANCE],
    readRoles: [...SALES, ...FINANCE]
  },
  inventory: {
    model: 'inventories',
    fields: ['name', 'category', 'barcode', 'stock', 'min', 'price', 'status'],
    required: ['name', 'category', 'barcode'],
    roles: [...OPERATIONS, ...MANAGEMENT],
    readRoles: [...OPERATIONS, ...MANAGEMENT]
  },
  invoices: {
    model: 'invoices',
    fields: ['id', 'customer', 'date', 'amount', 'gst', 'total', 'status'],
    required: ['id', 'date', 'amount', 'gst'],
    roles: FINANCE,
    readRoles: [...FINANCE, 'sales_manager']
  },
  quotations: {
    model: 'quotations',
    fields: ['id', 'customer', 'date', 'items', 'amount', 'status'],
    required: ['id', 'date', 'items'],
    roles: SALES,
    readRoles: [...SALES, ...FINANCE]
  }
};

function cleanBody(body, allowedFields) {
  return allowedFields.reduce((result, field) => {
    if (body[field] !== undefined) {
      result[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
    }
    return result;
  }, {});
}

function requireFields(payload, required) {
  const missing = required.filter((field) => payload[field] === undefined || payload[field] === null || payload[field] === '');
  if (missing.length) {
    const error = new Error(`Missing required fields: ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }
}

async function audit(req, action, entity, entityId, metadata) {
  try {
    await prisma.activityLogs.create({
      data: prepareData('activityLogs', {
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action,
        entity,
        entityId: entityId == null ? null : String(entityId),
        metadata: metadata || Prisma.JsonNull,
        ip: req.ip
      }, { create: true })
    });
  } catch (error) {
    console.error('Audit log failed:', error.message);
  }
}

async function createNotification(req, data) {
  const notification = await prisma.notifications.create({
    data: prepareData('notifications', {
      ...data,
      userId: data.userId === undefined ? req.user?.id || null : data.userId
    }, { create: true }),
    select: NOTIFICATION_SELECT
  });
  return notification;
}

async function broadcastNotification(req, data) {
  const admins = await prisma.users.findMany({
    where: { role: { in: ['super_admin', 'director'] } },
    select: { id: true }
  });
  const actorId = req.user?.id;
  for (const admin of admins) {
    if (admin.id === actorId) continue;
    await createNotification(req, { ...data, userId: admin.id });
  }
}

function parseAmount(value) {
  if (typeof value === 'number') return value;
  return Number(String(value || '').replace(/[^\d.-]/g, '')) || 0;
}

function validMoney(value, field, { allowZero = false, max = 999999999999.99 } = {}) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < (allowZero ? 0 : 0.01) || amount > max) {
    const error = new Error(`${field} must be a valid ${allowZero ? 'non-negative' : 'positive'} amount.`);
    error.status = 400;
    throw error;
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

async function applyStableReferences(payload, model, db = prisma) {
  if (model === 'tasks' && payload.assignedUserId === undefined && payload.assignedTo !== undefined) {
    const matches = await db.users.findMany({ where: { name: payload.assignedTo }, select: { id: true }, take: 2 });
    if (matches.length !== 1) {
      const error = new Error('Select a unique task assignee from the staff list.');
      error.status = 400;
      throw error;
    }
    payload.assignedUserId = matches[0].id;
  }
  if (model === 'tasks' && payload.assignedUserId !== undefined) {
    const assignedUserId = Number(payload.assignedUserId);
    const assignedUser = Number.isInteger(assignedUserId) && assignedUserId > 0
      ? await db.users.findUnique({ where: { id: assignedUserId }, select: { id: true, name: true } })
      : null;
    if (!assignedUser) {
      const error = new Error('Task assignee not found.');
      error.status = 404;
      throw error;
    }
    payload.assignedUserId = assignedUser.id;
    payload.assignedTo = assignedUser.name;
    if (!(await hasTaskAssignedUserIdColumn())) {
      const error = new Error('Database migration is required before assigning tasks.');
      error.status = 503;
      throw error;
    }
  }
  // Models that have a customerId FK column in the DB
  const CUSTOMER_FK_MODELS = ['installations', 'inventoryTransactions', 'invoices', 'quotations', 'renewals', 'tickets'];
  if (payload.customerId !== undefined && CUSTOMER_FK_MODELS.includes(model)) {
    const customerId = Number(payload.customerId);
    const customer = Number.isInteger(customerId) && customerId > 0
      ? await db.customers.findUnique({ where: { id: customerId }, select: { id: true, name: true } })
      : null;
    if (!customer) {
      const error = new Error('Customer not found.');
      error.status = 404;
      throw error;
    }
    payload.customerId = customer.id;
    payload.customer = customer.name;
  } else if (payload.customerId !== undefined && !CUSTOMER_FK_MODELS.includes(model)) {
    // For models without FK, just resolve the customer name
    const customerId = Number(payload.customerId);
    if (Number.isInteger(customerId) && customerId > 0) {
      const customer = await db.customers.findUnique({ where: { id: customerId }, select: { id: true, name: true } });
      if (customer) {
        payload.customer = customer.name;
      }
    }
    delete payload.customerId;
  }
  return payload;
}

function pagination(query, defaultPageSize = 100) {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const pageSize = Math.min(200, Math.max(1, Number.parseInt(query.pageSize || String(defaultPageSize), 10) || defaultPageSize));
  return { skip: (page - 1) * pageSize, take: pageSize };
}

function csvEscape(value) {
  const stringValue = value == null ? '' : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function dateString(value) {
  if (!value) return '';
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function renewalWithComputedStatus(record) {
  const json = record;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dateString(json.nextDue)}T00:00:00`);
  const daysLeft = Math.ceil((due - today) / (24 * 60 * 60 * 1000));
  return {
    ...json,
    daysLeft,
    status: daysLeft < 0 ? 'Overdue' : daysLeft <= 7 ? 'Due Soon' : json.status
  };
}

async function serializableTransaction(work, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    } catch (error) {
      if (error.code !== 'P2034' || attempt === retries) throw error;
    }
  }
  throw new Error('Transaction retry limit exceeded.');
}

router.post('/auth/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
  if (!process.env.JWT_SECRET) return res.status(500).json({ message: 'Server authentication is not configured.' });

  const user = await prisma.users.findUnique({ where: { email } });
  const isMatch = user ? await bcrypt.compare(password, user.password) : false;
  if (!user || !isMatch) return res.status(401).json({ message: 'Invalid email or password.' });

  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role, email: user.email, tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  await audit({ ...req, user }, 'login', 'user', user.id);
  res.cookie('sm_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email, phone: user.phone } });
}));

router.post('/auth/seed', asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ message: 'Not found.' });
  if (!process.env.SEED_SECRET || req.headers['x-seed-key'] !== process.env.SEED_SECRET) {
    return res.status(403).json({ message: 'Invalid seed key.' });
  }
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) {
    return res.status(400).json({ message: 'Set DEMO_PASSWORD to at least 12 characters.' });
  }
  if (await prisma.users.count()) return res.status(409).json({ message: 'Database already has users.' });
  const password = await bcrypt.hash(demoPassword, 12);
  await prisma.users.createMany({
    data: [
      { name: 'Super Admin', email: 'admin@company.com', password, role: 'super_admin' },
      { name: 'Sales Executive', email: 'sales@company.com', password, role: 'sales_executive' },
      { name: 'Accounts User', email: 'accounts@company.com', password, role: 'accounts' }
    ].map((user) => prepareData('users', user, { create: true }))
  });
  res.status(201).json({ message: 'Development users created.' });
}));

router.get('/auth/profile', authMiddleware, asyncHandler(async (req, res) => {
  const user = await prisma.users.findUnique({ where: { id: req.user.id }, select: PUBLIC_USER_SELECT });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json(user);
}));

router.post('/auth/logout', authMiddleware, asyncHandler(async (req, res) => {
  await prisma.users.update({
    where: { id: req.user.id },
    data: prepareData('users', { tokenVersion: { increment: 1 } })
  });
  await audit(req, 'logout', 'user', req.user.id);
  res.clearCookie('sm_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
  res.json({ message: 'Signed out.' });
}));

router.put('/auth/profile', authMiddleware, asyncHandler(async (req, res) => {
  const user = await prisma.users.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const payload = cleanBody(req.body, ['name', 'phone']);
  requireFields(payload, ['name']);
  const updatedUser = await prisma.users.update({
    where: { id: user.id },
    data: prepareData('users', payload)
  });
  await audit(req, 'update', 'profile', user.id);
  res.json({ id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, phone: updatedUser.phone, role: updatedUser.role });
}));

router.put('/auth/password', authMiddleware, asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < 12) return res.status(400).json({ message: 'New password must be at least 12 characters.' });
  const user = await prisma.users.findUnique({ where: { id: req.user.id } });
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(400).json({ message: 'Current password is incorrect.' });
  }
  const updatedUser = await prisma.users.update({
    where: { id: user.id },
    data: prepareData('users', {
      password: await bcrypt.hash(newPassword, 12),
      tokenVersion: Number(user.tokenVersion || 0) + 1
    })
  });
  await audit(req, 'password_change', 'user', user.id);
  const token = jwt.sign(
    { id: updatedUser.id, name: updatedUser.name, role: updatedUser.role, email: updatedUser.email, tokenVersion: updatedUser.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  res.json({ message: 'Password updated successfully.', token });
}));

router.get('/users', authMiddleware, checkRole(ADMIN), asyncHandler(async (req, res) => {
  res.json(await prisma.users.findMany({ select: PUBLIC_USER_SELECT, orderBy: { name: 'asc' } }));
}));

router.get('/task-assignees', authMiddleware, checkRole(MANAGEMENT), asyncHandler(async (req, res) => {
  res.json(await prisma.users.findMany({
    where: { role: { in: ASSIGNABLE_USER_ROLES } },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' }
  }));
}));
router.get('/installation-staff', authMiddleware, checkRole(OPERATIONS), asyncHandler(async (req, res) => {
  res.json(await prisma.employees.findMany({
    select: { id: true, name: true, dept: true, role: true },
    orderBy: { name: 'asc' }
  }));
}));

router.post('/users', authMiddleware, checkRole(ADMIN), asyncHandler(async (req, res) => {
  const payload = cleanBody(req.body, ['name', 'email', 'phone', 'role', 'password']);
  requireFields(payload, ['name', 'email', 'role', 'password']);
  if (payload.password.length < 12) return res.status(400).json({ message: 'Password must be at least 12 characters.' });
  if (!ASSIGNABLE_USER_ROLES.includes(payload.role)) return res.status(400).json({ message: 'Invalid or protected user role.' });
  payload.email = payload.email.toLowerCase();
  payload.password = await bcrypt.hash(payload.password, 12);
  const user = await prisma.users.create({ data: prepareData('users', payload, { create: true }) });
  await audit(req, 'create', 'user', user.id, { role: user.role });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role });
}));

router.put('/users/:id', authMiddleware, checkRole(ADMIN), asyncHandler(async (req, res) => {
  const user = await prisma.users.findUnique({ where: { id: Number(req.params.id) } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.role === 'super_admin') {
    if (req.body.role && req.body.role !== 'super_admin') {
      return res.status(403).json({ message: 'Forbidden: Cannot demote Super Admin root account.' });
    }
  }
  const payload = cleanBody(req.body, ['name', 'email', 'phone', 'role']);
  if (payload.email) {
    payload.email = payload.email.toLowerCase().trim();
    const existing = await prisma.users.findUnique({ where: { email: payload.email } });
    if (existing && existing.id !== user.id) {
      return res.status(409).json({ message: 'Email is already registered to another account.' });
    }
  }
  if (payload.role && payload.role !== 'super_admin' && !ASSIGNABLE_USER_ROLES.includes(payload.role)) {
    return res.status(400).json({ message: 'Invalid or protected user role.' });
  }
  if (payload.role === 'super_admin' && user.role !== 'super_admin') {
    return res.status(403).json({ message: 'The protected Super Admin role cannot be assigned.' });
  }
  const updatedUser = await prisma.users.update({
    where: { id: user.id },
    data: prepareData('users', payload)
  });
  await audit(req, 'update', 'user', user.id, { role: updatedUser.role });
  res.json({ id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, phone: updatedUser.phone, role: updatedUser.role });
}));

router.delete('/users/:id', authMiddleware, checkRole(ADMIN), asyncHandler(async (req, res) => {
  const user = await prisma.users.findUnique({ where: { id: Number(req.params.id) } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.role === 'super_admin') {
    return res.status(403).json({ message: 'Forbidden: Super Admin account cannot be deleted.' });
  }
  await prisma.users.delete({ where: { id: user.id } });
  await audit(req, 'delete', 'user', user.id);
  res.json({ message: 'User deleted successfully.' });
}));

router.put('/users/:id/password', authMiddleware, checkRole(ADMIN), asyncHandler(async (req, res) => {
  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < 12) return res.status(400).json({ message: 'Password must be at least 12 characters.' });
  const user = await prisma.users.findUnique({ where: { id: Number(req.params.id) } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.role === 'super_admin') {
    return res.status(403).json({ message: 'Reset the Super Admin password from My Profile using the current password.' });
  }
  await prisma.users.update({
    where: { id: user.id },
    data: prepareData('users', {
      password: await bcrypt.hash(newPassword, 12),
      tokenVersion: Number(user.tokenVersion || 0) + 1
    })
  });
  await audit(req, 'password_reset', 'user', user.id);
  res.json({ message: 'User password reset.' });
}));

for (const [routeName, config] of Object.entries(RESOURCE_CONFIG)) {
  router.get(`/${routeName}`, authMiddleware, checkRole(config.readRoles), asyncHandler(async (req, res) => {
    const where = {};
    if (routeName === 'tasks' && !MANAGEMENT.includes(req.user.role)) where.assignedUserId = req.user.id;
    if (req.query.customer && config.fields.includes('customer')) where.customer = req.query.customer;
    if (req.query.status) where.status = prepareData(config.model, { status: req.query.status }).status;
    const orderField = routeName === 'employees' ? 'name' : 'createdAt';
    const orderDirection = routeName === 'employees' ? 'asc' : 'desc';
    const records = await prisma[config.model].findMany({
      where,
      orderBy: { [orderField]: orderDirection },
      ...pagination(req.query),
      ...(await compatibilitySelect(config.model))
    });
    const compatibleRecords = await restoreLegacyDecimalFields(config.model, records);
    res.json(routeName === 'renewals' ? compatibleRecords.map(renewalWithComputedStatus) : compatibleRecords);
  }));

  router.get(`/${routeName}/:id`, authMiddleware, checkRole(config.readRoles), asyncHandler(async (req, res) => {
    const record = await prisma[config.model].findUnique({
      where: { id: prismaId(config.model, req.params.id) },
      ...(await compatibilitySelect(config.model))
    });
    if (!record) return res.status(404).json({ message: `${routeName.slice(0, -1)} not found.` });
    if (routeName === 'tasks' && !MANAGEMENT.includes(req.user.role) && record.assignedUserId !== req.user.id) {
      return res.status(404).json({ message: 'Task not found.' });
    }
    const compatibleRecord = (await restoreLegacyDecimalFields(config.model, [record]))[0];
    res.json(routeName === 'renewals' ? renewalWithComputedStatus(compatibleRecord) : compatibleRecord);
  }));

  router.post(`/${routeName}`, authMiddleware, checkRole(config.roles), asyncHandler(async (req, res) => {
    const payload = cleanBody(req.body, config.fields);
    if (!payload.id && (routeName === 'quotations' || routeName === 'invoices')) {
      const prefix = routeName === 'quotations' ? 'QT' : 'INV';
      payload.id = `${prefix}-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    }
    requireFields(payload, config.required);
    await applyStableReferences(payload, config.model);
    if (routeName === 'tasks' && !payload.assignedTo) return res.status(400).json({ message: 'Task assignee is required.' });
    if (routeName === 'invoices') {
      payload.amount = validMoney(payload.amount, 'Invoice amount');
      payload.gst = validMoney(payload.gst, 'GST rate', { allowZero: true, max: 100 });
      payload.total = Math.round(payload.amount * (1 + payload.gst / 100) * 100) / 100;
    }
    if (routeName === 'renewals') payload.amount = validMoney(payload.amount, 'Renewal amount');
    if (routeName === 'inventory') payload.price = validMoney(payload.price ?? 0, 'Inventory price', { allowZero: true });
    if (routeName === 'inventory') {
      payload.stock = Number(payload.stock ?? 0);
      payload.min = Number(payload.min ?? 10);
      if (!Number.isInteger(payload.stock) || payload.stock < 0 || !Number.isInteger(payload.min) || payload.min < 0) return res.status(400).json({ message: 'Stock and minimum level must be non-negative whole numbers.' });
      payload.status = payload.stock === 0 ? 'Out of Stock' : payload.stock <= payload.min ? 'Low Stock' : 'OK';
    }
    if (routeName === 'employees') {
      for (const field of ['basicSalary', 'incentive', 'deduction']) payload[field] = validMoney(payload[field] ?? 0, field, { allowZero: true });
    }
    if (routeName === 'quotations') {
      let items;
      try { items = JSON.parse(payload.items); } catch { items = null; }
      if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Quotation requires at least one valid item.' });
      let subtotal = 0;
      let taxAmount = 0;
      payload.taxable = payload.taxable !== false;
      for (const item of items) {
        const quantity = validMoney(item.qty, 'Item quantity', { max: 1000000 });
        const rate = validMoney(item.rate, 'Item rate', { allowZero: true });
        const gst = payload.taxable ? validMoney(item.gst ?? 0, 'Item GST', { allowZero: true, max: 100 }) : 0;
        const line = quantity * rate;
        subtotal += line;
        taxAmount += line * gst / 100;
      }
      payload.subtotal = Math.round(subtotal * 100) / 100;
      payload.taxAmount = Math.round(taxAmount * 100) / 100;
      payload.amount = Math.round((subtotal + taxAmount) * 100) / 100;
    }
    if (routeName === 'installations') {
      if (payload.type) {
        const typeMap = {
          gps: 'GPS',
          cctv: 'CCTV',
          web: 'Website',
          website: 'Website',
          GPS: 'GPS',
          CCTV: 'CCTV',
          Website: 'Website'
        };
        const trimmed = String(payload.type).trim();
        const normalized = typeMap[trimmed] || typeMap[trimmed.toLowerCase()];
        if (!normalized) return res.status(400).json({ message: 'Installation type must be GPS, CCTV, or Website.' });
        payload.type = normalized;
      }
      if (payload.cameras !== undefined) {
        payload.cameras = payload.cameras === '' || payload.cameras === null ? 0 : Number.parseInt(payload.cameras, 10) || 0;
      }
    }
    await removeUndeployedFields(config.model, payload);
    const record = await prisma[config.model].create({
      data: prepareData(config.model, payload, { create: true }),
      ...(await compatibilitySelect(config.model))
    });
    await audit(req, 'create', routeName, record.id);
    if (routeName === 'customers' && record.phone) {
      // Send SMS & WhatsApp welcome messages via saved webhook URLs
      setImmediate(async () => {
        try {
          const rows = await prisma.appSettings.findMany({ where: { key: { in: ['sms_webhook_url', 'whatsapp_webhook_url'] } } });
          const settingsMap = Object.fromEntries(rows.map((r) => [r.key, r.value || '']));
          const customerPhone = record.phone.replace(/[^0-9]/g, '');
          for (const [channel, urlTemplate] of Object.entries(settingsMap)) {
            if (!urlTemplate) continue;
            try {
              // Replace the demo number (9876543210) with the actual customer number
              const finalUrl = urlTemplate.replace(/number=\d{10,}/, `number=${customerPhone}`);
              const response = await fetch(finalUrl, { method: 'GET', signal: AbortSignal.timeout(15000) });
              console.log(`[Webhook] ${channel} sent to ${customerPhone}: HTTP ${response.status}`);
            } catch (channelError) {
              console.error(`[Webhook] ${channel} failed for ${customerPhone}:`, channelError.message);
            }
          }
        } catch (settingsError) {
          console.error('[Webhook] Failed to load settings:', settingsError.message);
        }
      });
    }
    if (routeName === 'customers') {
      await broadcastNotification(req, {
        type: 'customer',
        title: `${req.user.name} added a new customer`,
        message: record.name || 'New customer',
        link: '/customers'
      });
    }
    if (routeName === 'tasks') {
      const targetUserId = record.assignedUserId || req.user.id;
      await createNotification(req, {
        userId: targetUserId,
        type: 'task',
        title: `${req.user.name} assigned you a task`,
        message: record.title,
        link: '/tasks'
      });
    }
    if (routeName === 'tickets') {
      await broadcastNotification(req, {
        type: 'ticket',
        title: `${req.user.name} opened a ticket`,
        message: `${record.customer}: ${record.subject}`,
        link: '/tickets'
      });
      const customer = await prisma.customers.findFirst({ where: { name: record.customer } });
      queueMultiChannelNotification({
        toEmail: customer?.email,
        toPhone: customer?.phone,
        subject: `Support ticket #${record.id}`,
        textContent: `Your support request "${record.subject}" has been recorded.`
      });
    }
    if (routeName === 'leads') {
      await broadcastNotification(req, {
        type: 'lead',
        title: `${req.user.name} added a new lead`,
        message: `${record.name}: ${record.service}`,
        link: '/leads'
      });
      queueMultiChannelNotification({
        toEmail: record.email,
        toPhone: record.phone,
        subject: 'We received your enquiry',
        textContent: `Hello ${record.name}, thank you for contacting us about ${record.service}.`
      });
    }
    if (routeName === 'installations') {
      await broadcastNotification(req, {
        type: 'installation',
        title: `${req.user.name} scheduled an installation`,
        message: `${record.customer}: ${record.device || 'Device'} (${record.date || 'Pending'})`,
        link: '/installations'
      });
    }
    if (routeName === 'employees') {
      await broadcastNotification(req, {
        type: 'employee',
        title: `${req.user.name} added a new employee`,
        message: `${record.name} (${record.designation || 'Staff'})`,
        link: '/employees'
      });
    }
    if (routeName === 'inventory') {
      await broadcastNotification(req, {
        type: 'inventory',
        title: `${req.user.name} added inventory item`,
        message: `${record.name} - Initial stock: ${record.stock}`,
        link: '/inventory'
      });
    }
    res.status(201).json((await restoreLegacyDecimalFields(config.model, [record]))[0]);
  }));

  router.put(`/${routeName}/:id`, authMiddleware, checkRole(config.roles), asyncHandler(async (req, res) => {
    const delegate = prisma[config.model];
    const id = prismaId(config.model, req.params.id);
    const record = await delegate.findUnique({ where: { id }, ...(await compatibilitySelect(config.model)) });
    if (!record) return res.status(404).json({ message: `${routeName.slice(0, -1)} not found.` });
    const payload = cleanBody(req.body, config.fields.filter((field) => field !== 'id'));
    await applyStableReferences(payload, config.model);
    if (routeName === 'invoices' && ['amount', 'gst', 'total'].some((field) => payload[field] !== undefined)) {
      const amount = validMoney(payload.amount ?? record.amount, 'Invoice amount');
      const gst = validMoney(payload.gst ?? record.gst, 'GST rate', { allowZero: true, max: 100 });
      payload.amount = amount;
      payload.gst = gst;
      payload.total = Math.round(amount * (1 + gst / 100) * 100) / 100;
    }
    if (routeName === 'renewals' && payload.amount !== undefined) payload.amount = validMoney(payload.amount, 'Renewal amount');
    if (routeName === 'inventory' && payload.price !== undefined) payload.price = validMoney(payload.price, 'Inventory price', { allowZero: true });
    if (routeName === 'inventory') {
      delete payload.stock;
      if (payload.min !== undefined) {
        payload.min = Number(payload.min);
        if (!Number.isInteger(payload.min) || payload.min < 0) return res.status(400).json({ message: 'Minimum level must be a non-negative whole number.' });
        payload.status = Number(record.stock) === 0 ? 'Out of Stock' : Number(record.stock) <= payload.min ? 'Low Stock' : 'OK';
      } else { delete payload.status; }
    }
    if (routeName === 'employees') {
      for (const field of ['basicSalary', 'incentive', 'deduction']) if (payload[field] !== undefined) payload[field] = validMoney(payload[field], field, { allowZero: true });
    }
    if (routeName === 'quotations' && (payload.items !== undefined || payload.taxable !== undefined)) {
      let items;
      try { items = JSON.parse(payload.items ?? record.items); } catch { items = null; }
      if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Quotation requires at least one valid item.' });
      let subtotal = 0;
      let taxAmount = 0;
      payload.taxable = payload.taxable ?? record.taxable;
      for (const item of items) {
        if (!String(item.desc || '').trim()) return res.status(400).json({ message: 'Every quotation item requires a description.' });
        if (!Number.isInteger(Number(item.qty))) return res.status(400).json({ message: 'Item quantity must be a whole number.' });
        const quantity = validMoney(item.qty, 'Item quantity', { max: 1000000 });
        const rate = validMoney(item.rate, 'Item rate', { allowZero: true });
        const gst = payload.taxable ? validMoney(item.gst ?? 0, 'Item GST', { allowZero: true, max: 100 }) : 0;
        const line = quantity * rate;
        subtotal += line;
        taxAmount += line * gst / 100;
      }
      payload.subtotal = Math.round(subtotal * 100) / 100;
      payload.taxAmount = Math.round(taxAmount * 100) / 100;
      payload.amount = Math.round((subtotal + taxAmount) * 100) / 100;
    }
    if (routeName === 'installations') {
      if (payload.type !== undefined) {
        const typeMap = {
          gps: 'GPS',
          cctv: 'CCTV',
          web: 'Website',
          website: 'Website',
          GPS: 'GPS',
          CCTV: 'CCTV',
          Website: 'Website'
        };
        const trimmed = String(payload.type).trim();
        const normalized = typeMap[trimmed] || typeMap[trimmed.toLowerCase()];
        if (!normalized) return res.status(400).json({ message: 'Installation type must be GPS, CCTV, or Website.' });
        payload.type = normalized;
      }
      if (payload.cameras !== undefined) {
        payload.cameras = payload.cameras === '' || payload.cameras === null ? 0 : Number.parseInt(payload.cameras, 10) || 0;
      }
    }
    await removeUndeployedFields(config.model, payload);
    let updatedRecord;
    if (routeName === 'customers' && payload.name && payload.name !== record.name) {
      const updates = [
        delegate.update({ where: { id }, data: prepareData(config.model, payload), ...(await compatibilitySelect(config.model)) }),
        prisma.invoices.updateMany({ where: { customer: record.name }, data: { customer: payload.name } }),
        prisma.tickets.updateMany({ where: { customer: record.name }, data: { customer: payload.name } }),
        prisma.renewals.updateMany({ where: { customer: record.name }, data: { customer: payload.name } }),
        prisma.installations.updateMany({ where: { customer: record.name }, data: { customer: payload.name } }),
        prisma.inventoryTransactions.updateMany({ where: { customer: record.name }, data: { customer: payload.name } }),
        prisma.quotations.updateMany({ where: { customer: record.name }, data: { customer: payload.name } })
      ];
      [updatedRecord] = await prisma.$transaction(updates);
    } else {
      updatedRecord = await delegate.update({ where: { id }, data: prepareData(config.model, payload), ...(await compatibilitySelect(config.model)) });
    }
    await audit(req, 'update', routeName, record.id, { fields: Object.keys(payload) });
    if (routeName === 'tasks') {
      if (payload.assignedTo && payload.assignedTo !== record.assignedTo) {
        const assignedUser = await prisma.users.findFirst({ where: { name: payload.assignedTo }, select: { id: true } });
        if (assignedUser && assignedUser.id !== req.user?.id) {
          await createNotification(req, {
            userId: assignedUser.id,
            type: 'task',
            title: `${req.user.name} assigned you a task`,
            message: record.title,
            link: '/tasks'
          });
        }
      }
      if (payload.status && payload.status !== record.status) {
        await broadcastNotification(req, {
          type: 'task',
          title: `${req.user.name} updated task status`,
          message: `"${record.title}" is now ${payload.status}`,
          link: '/tasks'
        });
      }
    }
    if (routeName === 'installations' && payload.status && payload.status !== record.status) {
      await broadcastNotification(req, {
        type: 'installation',
        title: `${req.user.name} updated installation`,
        message: `${record.customer}: status changed to ${payload.status}`,
        link: '/installations'
      });
    }
    if (routeName === 'quotations' && payload.status && payload.status !== record.status) {
      await broadcastNotification(req, {
        type: 'invoice',
        title: `${req.user.name} updated quotation`,
        message: `Quotation ${record.id} is now ${payload.status}`,
        link: '/quotations'
      });
    }
    if (routeName === 'tickets' && payload.status && payload.status !== record.status) {
      await broadcastNotification(req, {
        type: 'ticket',
        title: `${req.user.name} updated ticket #${record.id}`,
        message: `Status changed to ${payload.status} (${record.customer})`,
        link: '/tickets'
      });
    }
    if (routeName === 'invoices' && payload.status && payload.status !== record.status) {
      await broadcastNotification(req, {
        type: 'invoice',
        title: `${req.user.name} updated invoice ${record.id}`,
        message: `Status changed to ${payload.status} (${record.customer})`,
        link: '/accounts'
      });
    }
    res.json((await restoreLegacyDecimalFields(config.model, [updatedRecord]))[0]);
  }));

  router.delete(`/${routeName}/:id`, authMiddleware, checkRole(config.roles), asyncHandler(async (req, res) => {
    const delegate = prisma[config.model];
    const id = prismaId(config.model, req.params.id);
    const record = await delegate.findUnique({ where: { id }, ...(await compatibilitySelect(config.model)) });
    if (!record) return res.status(404).json({ message: `${routeName.slice(0, -1)} not found.` });
    if (routeName === 'customers') {
      const relatedCount = await Promise.all([
        prisma.invoices.count({ where: { customer: record.name } }),
        prisma.tickets.count({ where: { customer: record.name } }),
        prisma.renewals.count({ where: { customer: record.name } }),
        prisma.installations.count({ where: { customer: record.name } }),
        prisma.quotations.count({ where: { customer: record.name } })
      ]);
      if (relatedCount.some(Boolean)) {
        return res.status(409).json({ message: 'Customer has related business records. Mark the customer inactive instead of deleting it.' });
      }
    }
    if (routeName === 'invoices') {
      const paymentCount = await prisma.payments.count({ where: { invoiceId: record.id } });
      if (paymentCount) return res.status(409).json({ message: 'Paid or partially paid invoices cannot be deleted.' });
    }
    await delegate.delete({ where: { id }, ...(await compatibilitySelect(config.model)) });
    await audit(req, 'delete', routeName, req.params.id);
    res.json({ message: 'Deleted successfully.' });
  }));
}

router.post('/leads/:id/convert', authMiddleware, checkRole(SALES), asyncHandler(async (req, res) => {
  const result = await serializableTransaction(async (tx) => {
    const lead = await tx.leads.findUnique({ where: { id: Number(req.params.id) } });
    if (!lead) {
      const error = new Error('Lead not found.');
      error.status = 404;
      throw error;
    }

    // Check if a customer with this name already exists
    let customer = await tx.customers.findFirst({ where: { name: lead.name } });
    if (!customer) {
      customer = await tx.customers.create({
        data: prepareData('customers', {
          name: lead.name,
          phone: lead.phone || '',
          email: lead.email || '',
          services: lead.service ? JSON.stringify([lead.service]) : JSON.stringify(['GPS Tracking']),
          status: 'Active'
        }, { create: true })
      });
    }

    const updatedLead = await tx.leads.update({
      where: { id: lead.id },
      data: prepareData('leads', { status: 'Converted' })
    });
    return { lead: updatedLead, customer };
  });
  const { lead, customer } = result;
  await audit(req, 'convert', 'lead', lead.id, { customerId: customer.id });
  await broadcastNotification(req, {
    type: 'lead',
    title: `${req.user.name} converted a lead`,
    message: `${lead.name} converted into active customer account`,
    link: `/customers/${customer.id}`
  });

  res.json({ lead, customer });
}));

router.post('/renewals/:id/generate-invoice', authMiddleware, checkRole([...SALES, ...FINANCE]), asyncHandler(async (req, res) => {
  const renewal = await prisma.renewals.findUnique({ where: { id: Number(req.params.id) } });
  if (!renewal) return res.status(404).json({ message: 'Renewal not found.' });

  const amount = validMoney(renewal.amount, 'Renewal amount');
  if (amount <= 0) return res.status(400).json({ message: 'Renewal amount must be greater than zero.' });
  const gst = 18;
  const total = Math.round(amount * 1.18 * 100) / 100;
  const invoiceId = `INV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const invoice = await prisma.invoices.create({
    data: prepareData('invoices', {
      id: invoiceId,
      customer: renewal.customer,
      amount,
      gst,
      total,
      date: currentDateOnly(),
      status: 'Unpaid'
    }, { create: true })
  });

  await audit(req, 'create_invoice', 'renewal', renewal.id, { invoiceId: invoice.id });
  await broadcastNotification(req, {
    type: 'invoice',
    title: `${req.user.name} generated an invoice`,
    message: `Invoice ${invoice.id} for ${renewal.customer} (${renewal.type})`,
    link: '/accounts'
  });

  res.status(201).json(invoice);
}));

router.get('/customers/:id/overview', authMiddleware, checkRole(ALL_STAFF), asyncHandler(async (req, res) => {
  const customerRecord = await prisma.customers.findUnique({
    where: { id: Number(req.params.id) },
    include: { CustomerDocuments: { orderBy: { createdAt: 'desc' } } }
  });
  if (!customerRecord) return res.status(404).json({ message: 'Customer not found.' });
  const { CustomerDocuments: documents, ...customer } = customerRecord;
  const canFinance = FINANCE.includes(req.user.role);
  const canSales = SALES.includes(req.user.role);
  const canTickets = [...SUPPORT, ...OPERATIONS].includes(req.user.role);
  const [invoices, tickets, renewals, installations, quotations] = await Promise.all([
    canFinance ? prisma.invoices.findMany({ where: { customer: customer.name }, orderBy: { date: 'desc' }, take: 200 }) : [],
    canTickets ? prisma.tickets.findMany({ where: { customer: customer.name }, orderBy: { createdAt: 'desc' }, take: 200 }) : [],
    (canSales || canFinance) ? prisma.renewals.findMany({ where: { customer: customer.name }, orderBy: { nextDue: 'asc' }, take: 200 }) : [],
    [...OPERATIONS, ...SALES, ...SUPPORT].includes(req.user.role) ? prisma.installations.findMany({ where: { customer: customer.name }, orderBy: { createdAt: 'desc' }, take: 200 }) : [],
    (canSales || canFinance) ? prisma.quotations.findMany({ where: { customer: customer.name }, orderBy: { date: 'desc' }, take: 200 }) : []
  ]);
  res.json({ customer: { ...customer, documents }, invoices, tickets, renewals, installations, quotations });
}));

router.put('/tasks/:id/status', authMiddleware, checkRole(ALL_STAFF), asyncHandler(async (req, res) => {
  const status = String(req.body.status || '');
  if (!['Pending', 'Ongoing', 'Completed', 'Not Completed'].includes(status)) {
    return res.status(400).json({ message: 'Invalid task status.' });
  }
  const task = await prisma.tasks.findUnique({ where: { id: Number(req.params.id) }, ...(await compatibilitySelect('tasks')) });
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  const isManager = MANAGEMENT.includes(req.user.role);
  if (!isManager && task.assignedUserId !== req.user.id) {
    return res.status(403).json({ message: 'Only the assignee or a manager can update this task.' });
  }
  const updatedTask = await prisma.tasks.update({
    where: { id: task.id },
    data: prepareData('tasks', { status }),
    ...(await compatibilitySelect('tasks'))
  });
  await audit(req, 'status_update', 'tasks', task.id, { status });
  res.json(updatedTask);
}));

function periodDetails(period) {
  if (!/^\d{4}-\d{2}$/.test(String(period || ''))) {
    const error = new Error('Period must use YYYY-MM format.');
    error.status = 400;
    throw error;
  }
  const [year, month] = period.split('-').map(Number);
  if (month < 1 || month > 12) {
    const error = new Error('Invalid payroll month.');
    error.status = 400;
    throw error;
  }
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function isWorkingDay(value) {
  const day = new Date(value).getUTCDay();
  return day !== 0 && day !== 6;
}

function workingDateKeys(start, end) {
  const keys = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (isWorkingDay(cursor)) keys.push(dateKey(cursor));
  }
  return keys;
}

async function findEmployeeForUser(user) {
  return prisma.employees.findFirst({
    where: { email: { equals: user.email, mode: 'insensitive' } }
  });
}

async function employeeForUser(user) {
  const employee = await findEmployeeForUser(user);
  if (!employee) {
    const error = new Error('Your login is not linked to an employee record. Ask an administrator to use the same email for both accounts.');
    error.status = 404;
    throw error;
  }
  return employee;
}
async function calculatePayroll(employee, period) {
  const { start, end } = periodDetails(period);
  const today = toDateOnly(currentDateOnly());
  const accountableEnd = end < today ? end : today < start ? new Date(start.getTime() - 86400000) : today;
  const [attendance, approvedLeaves, existing] = await Promise.all([
    prisma.attendances.findMany({ where: { employeeId: employee.id, date: { gte: start, lte: end } } }),
    prisma.leaveRequests.findMany({
      where: {
        employeeId: employee.id,
        status: 'Approved',
        type: { in: ['Paid', 'Sick'] },
        startDate: { lte: end },
        endDate: { gte: start }
      }
    }),
    prisma.payrolls.findUnique({ where: { employeeId_period: { employeeId: employee.id, period } } })
  ]);
  if (existing?.status === 'Paid') return existing;

  const scheduledKeys = workingDateKeys(start, end);
  const accountableKeys = new Set(accountableEnd >= start ? workingDateKeys(start, accountableEnd) : []);
  const attendedKeys = new Set();
  let lateDays = 0;
  for (const row of attendance) {
    const key = dateKey(row.date);
    if (!accountableKeys.has(key)) continue;
    if (row.status === 'Present' || row.status === 'Late') attendedKeys.add(key);
    if (row.status === 'Late') lateDays += 1;
  }

  const leaveKeys = new Set();
  for (const leave of approvedLeaves) {
    const leaveStart = leave.startDate > start ? leave.startDate : start;
    const leaveEnd = leave.endDate < accountableEnd ? leave.endDate : accountableEnd;
    if (leaveEnd < leaveStart) continue;
    for (const key of workingDateKeys(leaveStart, leaveEnd)) {
      if (!attendedKeys.has(key)) leaveKeys.add(key);
    }
  }

  const workingDays = scheduledKeys.length;
  const presentDays = attendedKeys.size;
  const leaveDays = leaveKeys.size;
  const absentDays = Math.max(0, accountableKeys.size - presentDays - leaveDays);
  const basic = Number(employee.basicSalary || 0);
  const incentive = Number(employee.incentive || 0);
  const deduction = Number(employee.deduction || 0);
  const attendanceDeduction = workingDays ? Math.round((basic * absentDays / workingDays) * 100) / 100 : 0;
  const gross = Math.round((basic + incentive) * 100) / 100;
  const net = Math.max(0, Math.round((gross - deduction - attendanceDeduction) * 100) / 100);
  const data = prepareData('payrolls', {
    basic,
    incentive,
    deduction,
    workingDays,
    presentDays,
    leaveDays,
    absentDays,
    lateDays,
    attendanceDeduction,
    gross,
    net,
    status: 'Pending'
  });
  return prisma.payrolls.upsert({
    where: { employeeId_period: { employeeId: employee.id, period } },
    create: prepareData('payrolls', { employeeId: employee.id, period, ...data }, { create: true }),
    update: data
  });
}

router.get('/my/hr', authMiddleware, checkRole(ALL_STAFF), asyncHandler(async (req, res) => {
  const employee = await findEmployeeForUser(req.user);
  if (!employee) return res.json({ linked: false, employee: null, attendance: [], leaves: [], documents: [], payroll: null });
  const period = String(req.query.period || currentDateOnly().slice(0, 7));
  const { start, end } = periodDetails(period);
  const [attendance, leaves, documents, payroll] = await Promise.all([
    prisma.attendances.findMany({ where: { employeeId: employee.id, date: { gte: start, lte: end } }, orderBy: { date: 'desc' } }),
    prisma.leaveRequests.findMany({ where: { employeeId: employee.id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.employeeDocuments.findMany({ where: { employeeId: employee.id }, orderBy: { createdAt: 'desc' } }),
    calculatePayroll(employee, period)
  ]);
  res.json({ linked: true, employee, attendance, leaves, documents, payroll });
}));

router.get('/leaves', authMiddleware, checkRole(ALL_STAFF), asyncHandler(async (req, res) => {
  const isAdmin = ADMIN.includes(req.user.role);
  const employee = isAdmin ? null : await employeeForUser(req.user);
  const rows = await prisma.leaveRequests.findMany({
    where: isAdmin ? (req.query.status ? { status: req.query.status } : {}) : { employeeId: employee.id },
    include: { Employees: { select: { id: true, name: true, email: true, dept: true } } },
    orderBy: { createdAt: 'desc' },
    ...pagination(req.query)
  });
  res.json(rows.map(({ Employees, ...leave }) => ({ ...leave, employee: Employees })));
}));

router.post('/leaves', authMiddleware, checkRole(ALL_STAFF), asyncHandler(async (req, res) => {
  const employee = await employeeForUser(req.user);
  const payload = cleanBody(req.body, ['type', 'startDate', 'endDate', 'reason']);
  requireFields(payload, ['type', 'startDate', 'endDate', 'reason']);
  if (!['Paid', 'Sick', 'Unpaid', 'Other'].includes(payload.type)) return res.status(400).json({ message: 'Invalid leave type.' });
  const startDate = toDateOnly(payload.startDate);
  const endDate = toDateOnly(payload.endDate);
  if (endDate < startDate) return res.status(400).json({ message: 'Leave end date cannot be before the start date.' });
  if (String(payload.reason).trim().length < 3) return res.status(400).json({ message: 'Please provide a leave reason.' });
  const days = workingDateKeys(startDate, endDate).length;
  if (!days) return res.status(400).json({ message: 'The selected leave period contains no working days.' });
  const overlap = await prisma.leaveRequests.findFirst({
    where: {
      employeeId: employee.id,
      status: { in: ['Pending', 'Approved'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    }
  });
  if (overlap) return res.status(409).json({ message: 'A pending or approved leave request already overlaps these dates.' });
  const leave = await prisma.leaveRequests.create({
    data: prepareData('leaveRequests', { employeeId: employee.id, ...payload, days }, { create: true })
  });
  await audit(req, 'request', 'leave', leave.id, { startDate: payload.startDate, endDate: payload.endDate });
  await broadcastNotification(req, {
    type: 'leave',
    title: `${req.user.name} requested leave`,
    message: `${dateKey(payload.startDate)} to ${dateKey(payload.endDate)} (${days} day${days > 1 ? 's' : ''})`,
    link: '/hrms'
  });
  res.status(201).json(leave);
}));

router.put('/leaves/:id/status', authMiddleware, checkRole(ADMIN), asyncHandler(async (req, res) => {
  const status = String(req.body.status || '');
  if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ message: 'Status must be Approved or Rejected.' });
  const leave = await prisma.leaveRequests.findUnique({ where: { id: Number(req.params.id) }, include: { Employees: true } });
  if (!leave) return res.status(404).json({ message: 'Leave request not found.' });
  if (leave.status !== 'Pending') return res.status(409).json({ message: 'Only pending leave requests can be reviewed.' });
  const updated = await prisma.leaveRequests.update({
    where: { id: leave.id },
    data: prepareData('leaveRequests', { status, reviewedBy: req.user.name, reviewedAt: new Date(), reviewNotes: String(req.body.reviewNotes || '').trim() || null })
  });
  const targetUser = leave.Employees.email ? await prisma.users.findFirst({ where: { email: { equals: leave.Employees.email, mode: 'insensitive' } }, select: { id: true } }) : null;
  if (targetUser) {
    await createNotification(req, {
      userId: targetUser.id,
      type: 'leave',
      title: `${req.user.name} ${status.toLowerCase()} your leave`,
      message: `${dateKey(leave.startDate)} to ${dateKey(leave.endDate)}`,
      link: '/my-work'
    });
  }
  await audit(req, 'review', 'leave', leave.id, { status });
  res.json(updated);
}));

router.delete('/leaves/:id', authMiddleware, checkRole(ALL_STAFF), asyncHandler(async (req, res) => {
  const employee = await employeeForUser(req.user);
  const leave = await prisma.leaveRequests.findUnique({ where: { id: Number(req.params.id) } });
  if (!leave || leave.employeeId !== employee.id) return res.status(404).json({ message: 'Leave request not found.' });
  if (leave.status !== 'Pending') return res.status(409).json({ message: 'Only pending leave requests can be cancelled.' });
  const updated = await prisma.leaveRequests.update({ where: { id: leave.id }, data: prepareData('leaveRequests', { status: 'Cancelled' }) });
  await audit(req, 'cancel', 'leave', leave.id);
  res.json(updated);
}));

router.get('/attendance', authMiddleware, checkRole(ALL_STAFF), asyncHandler(async (req, res) => {
  const date = String(req.query.date || currentDateOnly());
  const where = { date: toDateOnly(date) };
  if (!ADMIN.includes(req.user.role)) where.employeeId = (await employeeForUser(req.user)).id;
  res.json(await prisma.attendances.findMany({ where, orderBy: { employeeId: 'asc' } }));
}));

router.put('/attendance/:employeeId', authMiddleware, checkRole(ALL_STAFF), asyncHandler(async (req, res) => {
  const employee = await prisma.employees.findUnique({ where: { id: Number(req.params.employeeId) } });
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  if (!MANAGEMENT.includes(req.user.role) && employee.email?.toLowerCase() !== req.user.email.toLowerCase()) {
    return res.status(403).json({ message: 'Only the employee or a manager can update attendance.' });
  }
  const date = String(req.body.date || currentDateOnly());
  if (!MANAGEMENT.includes(req.user.role) && date !== currentDateOnly()) return res.status(403).json({ message: 'Employees can only update today’s attendance.' });
  const status = String(req.body.status || '');
  if (!['Present', 'Late', 'Absent', 'Leave'].includes(status)) return res.status(400).json({ message: 'Invalid attendance status.' });
  const defaults = {
    status,
    checkIn: req.body.checkIn || null,
    checkOut: req.body.checkOut || null,
    hoursWorked: req.body.hoursWorked ?? null,
    recordedBy: req.user.name
  };
  const [attendance] = await prisma.$transaction([
    prisma.attendances.upsert({
      where: { employeeId_date: { employeeId: employee.id, date: toDateOnly(date) } },
      create: prepareData('attendances', { employeeId: employee.id, date, ...defaults }, { create: true }),
      update: prepareData('attendances', defaults)
    }),
    prisma.employees.update({ where: { id: employee.id }, data: prepareData('employees', { status }) })
  ]);
  await audit(req, 'attendance', 'employee', employee.id, { date, status });
  res.json(attendance);
}));

router.get('/payroll', authMiddleware, checkRole(ADMIN), asyncHandler(async (req, res) => {
  const period = String(req.query.period || currentDateOnly().slice(0, 7));
  periodDetails(period);
  const employees = await prisma.employees.findMany({ orderBy: { name: 'asc' } });
  res.json(await Promise.all(employees.map((employee) => calculatePayroll(employee, period))));
}));

router.get('/my/payslips', authMiddleware, checkRole(ALL_STAFF), asyncHandler(async (req, res) => {
  const employee = await findEmployeeForUser(req.user);
  if (!employee) return res.json([]);
  const period = req.query.period ? String(req.query.period) : null;
  if (period) await calculatePayroll(employee, period);
  res.json(await prisma.payrolls.findMany({ where: { employeeId: employee.id }, orderBy: { period: 'desc' }, take: 36 }));
}));

router.put('/payroll/:id/pay', authMiddleware, checkRole(ADMIN), asyncHandler(async (req, res) => {
  const payroll = await prisma.payrolls.findUnique({ where: { id: Number(req.params.id) } });
  if (!payroll) return res.status(404).json({ message: 'Payroll record not found.' });
  const [updatedPayroll] = await prisma.$transaction([
    prisma.payrolls.update({ where: { id: payroll.id }, data: prepareData('payrolls', { status: 'Paid', paidAt: new Date(), paidBy: req.user.name }) }),
    prisma.employees.update({ where: { id: payroll.employeeId }, data: prepareData('employees', { payrollStatus: 'Paid' }) })
  ]);
  await audit(req, 'pay', 'payroll', payroll.id, { period: payroll.period, employeeId: payroll.employeeId });
  res.json(updatedPayroll);
}));
router.post('/inventory/:id/adjust', authMiddleware, checkRole([...OPERATIONS, ...MANAGEMENT]), asyncHandler(async (req, res) => {
  const direction = String(req.body.direction || '').toUpperCase();
  const quantity = Number(req.body.quantity);
  if (!['IN', 'OUT'].includes(direction) || !Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({ message: 'Direction and a positive whole-number quantity are required.' });
  }
  const result = await serializableTransaction(async (tx) => {
    const item = await tx.inventories.findUnique({ where: { id: Number(req.params.id) } });
    if (!item) {
      const error = new Error('Inventory item not found.');
      error.status = 404;
      throw error;
    }
    const nextStock = Number(item.stock) + (direction === 'IN' ? quantity : -quantity);
    if (nextStock < 0) {
      const error = new Error('Insufficient stock.');
      error.status = 409;
      throw error;
    }
    const status = nextStock === 0 ? 'Out of Stock' : nextStock <= Number(item.min) ? 'Low Stock' : 'OK';
    const updatedItem = await tx.inventories.update({
      where: { id: item.id },
      data: prepareData('inventories', { stock: nextStock, status })
    });
    const transactionPayload = {
      inventoryId: item.id,
      direction,
      quantity,
      balanceAfter: nextStock,
      purpose: req.body.purpose || null,
      customerId: req.body.customerId || undefined,
      reference: req.body.reference || null,
      recordedBy: req.user.name
    };
    await applyStableReferences(transactionPayload, 'inventoryTransactions', tx);
    const stockTransaction = await tx.inventoryTransactions.create({
      data: prepareData('inventoryTransactions', transactionPayload, { create: true })
    });
    return { item: updatedItem, transaction: stockTransaction };
  });
  await audit(req, 'adjust_stock', 'inventory', result.item.id, { direction, quantity });
  const sign = direction === 'IN' ? '+' : '-';
  const isAlert = result.item.status === 'Low Stock' || result.item.status === 'Out of Stock';
  await broadcastNotification(req, {
    type: 'inventory',
    title: isAlert ? `Low Stock Alert: ${result.item.name}` : `${req.user.name} adjusted stock`,
    message: `${result.item.name}: ${sign}${quantity} (Balance: ${result.item.stock})`,
    link: '/inventory'
  });
  res.json(result);
}));

router.get('/inventory/:id/transactions', authMiddleware, checkRole([...OPERATIONS, ...MANAGEMENT]), asyncHandler(async (req, res) => {
  res.json(await prisma.inventoryTransactions.findMany({
    where: { inventoryId: Number(req.params.id) },
    orderBy: { createdAt: 'desc' },
    ...pagination(req.query)
  }));
}));

const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
fs.mkdirSync(uploadDir, { recursive: true });
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many uploads. Please try again later.' }
});
const uploadExtensions = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'application/x-rar-compressed': '.rar',
  'application/x-7z-compressed': '.7z',
  'application/octet-stream': '.bin'
};

const allowedExtensions = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg',
  '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv',
  '.zip', '.rar', '.7z', '.txt'
]);

function validateUploadedFile(file) {
  if (!file) return;
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!allowedExtensions.has(extension)) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    const error = new Error('This file type is not allowed.');
    error.status = 400;
    throw error;
  }
  const quota = Number(process.env.UPLOAD_MAX_TOTAL_BYTES || 5 * 1024 * 1024 * 1024);
  const used = fs.readdirSync(uploadDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .reduce((sum, entry) => sum + fs.statSync(path.join(uploadDir, entry.name)).size, 0);

  if (!Number.isFinite(quota) || used > quota) {
    fs.unlinkSync(file.path);
    const error = new Error('Upload storage quota exceeded.');
    error.status = 507;
    throw error;
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase() || uploadExtensions[file.mimetype] || '';
      callback(null, `${crypto.randomUUID()}${ext}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, callback) => {
    callback(null, true);
  }
});

router.post('/customers/:id/documents', authMiddleware, checkRole(SALES), uploadLimiter, upload.single('document'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Document is required.' });
  validateUploadedFile(req.file);
  const customer = await prisma.customers.findUnique({ where: { id: Number(req.params.id) } });
  if (!customer) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ message: 'Customer not found.' });
  }
  let document;
  try {
    document = await prisma.customerDocuments.create({
      data: prepareData('customerDocuments', {
        customerId: customer.id,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user.name
      }, { create: true })
    });
  } catch (error) {
    fs.unlink(req.file.path, () => {});
    throw error;
  }
  await audit(req, 'upload', 'customer_document', document.id, { customerId: customer.id });
  res.status(201).json(document);
}));

router.get('/documents/:id/download', authMiddleware, checkRole(SALES), asyncHandler(async (req, res) => {
  const document = await prisma.customerDocuments.findUnique({ where: { id: Number(req.params.id) } });
  if (!document) return res.status(404).json({ message: 'Document not found.' });
  const filePath = path.join(uploadDir, path.basename(document.storedName));
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Stored file is missing.' });
  res.download(filePath, document.originalName);
}));

router.delete('/documents/:id', authMiddleware, checkRole(SALES), asyncHandler(async (req, res) => {
  const document = await prisma.customerDocuments.findUnique({ where: { id: Number(req.params.id) } });
  if (!document) return res.status(404).json({ message: 'Document not found.' });
  const filePath = path.join(uploadDir, path.basename(document.storedName));
  await prisma.customerDocuments.delete({ where: { id: document.id } });
  fs.unlink(filePath, () => {});
  await audit(req, 'delete', 'customer_document', req.params.id);
  res.json({ message: 'Document deleted.' });
}));

router.post(
  '/installations/:id/proof',
  authMiddleware,
  checkRole(OPERATIONS),
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'signature', maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    const uploadedFiles = Object.values(req.files || {}).flat();
    try { for (const file of uploadedFiles) validateUploadedFile(file); } catch (error) {
      for (const file of uploadedFiles) if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw error;
    }
    const installation = await prisma.installations.findUnique({ where: { id: Number(req.params.id) } });
    if (!installation) {
      for (const files of Object.values(req.files || {})) {
        for (const file of files) fs.unlink(file.path, () => {});
      }
      return res.status(404).json({ message: 'Installation not found.' });
    }
    const payload = cleanBody(req.body, ['imei', 'sim', 'cameras', 'dvr', 'reportNotes']);
    if (payload.cameras !== undefined) {
      payload.cameras = payload.cameras === '' || payload.cameras === null ? 0 : Number.parseInt(payload.cameras, 10) || 0;
    }
    payload.status = 'Completed';
    if (req.files?.photo?.[0]) payload.reportPhoto = req.files.photo[0].filename;
    if (req.files?.signature?.[0]) payload.reportSignature = req.files.signature[0].filename;
    let updatedInstallation;
    try {
      updatedInstallation = await prisma.installations.update({
        where: { id: installation.id },
        data: prepareData('installations', payload)
      });
    } catch (error) {
      for (const file of uploadedFiles) fs.unlink(file.path, () => {});
      throw error;
    }
    const replacedFiles = [
      payload.reportPhoto && installation.reportPhoto,
      payload.reportSignature && installation.reportSignature
    ].filter(Boolean);
    for (const storedName of replacedFiles) fs.unlink(path.join(uploadDir, path.basename(storedName)), () => {});
    await audit(req, 'complete', 'installations', installation.id, {
      photo: Boolean(payload.reportPhoto),
      signature: Boolean(payload.reportSignature)
    });
    res.json(updatedInstallation);
  })
);

router.get('/installations/:id/proof/:kind', authMiddleware, checkRole([...OPERATIONS, ...SUPPORT]), asyncHandler(async (req, res) => {
  const installation = await prisma.installations.findUnique({ where: { id: Number(req.params.id) } });
  if (!installation) return res.status(404).json({ message: 'Installation not found.' });
  const storedName = req.params.kind === 'signature' ? installation.reportSignature : installation.reportPhoto;
  if (!storedName) return res.status(404).json({ message: 'Proof file not found.' });
  const filePath = path.join(uploadDir, path.basename(storedName));
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Stored file is missing.' });
  res.download(filePath);
}));

async function canAccessEmployeeRecord(user, employeeId) {
  if (ADMIN.includes(user.role)) return true;
  const employee = await employeeForUser(user);
  return employee.id === employeeId;
}

router.get('/employees/:id/documents', authMiddleware, checkRole(ADMIN), asyncHandler(async (req, res) => {
  const employeeId = Number(req.params.id);
  const employee = await prisma.employees.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  res.json(await prisma.employeeDocuments.findMany({ where: { employeeId }, orderBy: { createdAt: 'desc' } }));
}));

router.post('/employees/:id/documents', authMiddleware, checkRole(ADMIN), uploadLimiter, upload.single('document'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Document is required.' });
  validateUploadedFile(req.file);
  const employee = await prisma.employees.findUnique({ where: { id: Number(req.params.id) }, select: { id: true } });
  if (!employee) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ message: 'Employee not found.' });
  }
  try {
    const document = await prisma.employeeDocuments.create({
      data: prepareData('employeeDocuments', {
        employeeId: employee.id,
        type: String(req.body.type || 'Other').slice(0, 100),
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user.name
      }, { create: true })
    });
    await audit(req, 'upload', 'employee_document', document.id, { employeeId: employee.id });
    res.status(201).json(document);
  } catch (error) {
    fs.unlink(req.file.path, () => {});
    throw error;
  }
}));

router.post('/my/documents', authMiddleware, checkRole(ALL_STAFF), uploadLimiter, upload.single('document'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Document is required.' });
  validateUploadedFile(req.file);
  const employee = await employeeForUser(req.user);
  try {
    const document = await prisma.employeeDocuments.create({
      data: prepareData('employeeDocuments', {
        employeeId: employee.id,
        type: String(req.body.type || 'Other').slice(0, 100),
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user.name
      }, { create: true })
    });
    await audit(req, 'upload', 'employee_document', document.id, { employeeId: employee.id });
    res.status(201).json(document);
  } catch (error) {
    fs.unlink(req.file.path, () => {});
    throw error;
  }
}));

router.get('/employee-documents/:id/download', authMiddleware, checkRole(ALL_STAFF), asyncHandler(async (req, res) => {
  const document = await prisma.employeeDocuments.findUnique({ where: { id: Number(req.params.id) } });
  if (!document || !await canAccessEmployeeRecord(req.user, document.employeeId)) return res.status(404).json({ message: 'Document not found.' });
  const filePath = path.join(uploadDir, path.basename(document.storedName));
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Stored file is missing.' });
  res.download(filePath, document.originalName);
}));

router.delete('/employee-documents/:id', authMiddleware, checkRole(ALL_STAFF), asyncHandler(async (req, res) => {
  const document = await prisma.employeeDocuments.findUnique({ where: { id: Number(req.params.id) } });
  if (!document || !await canAccessEmployeeRecord(req.user, document.employeeId)) return res.status(404).json({ message: 'Document not found.' });
  const filePath = path.join(uploadDir, path.basename(document.storedName));
  await prisma.employeeDocuments.delete({ where: { id: document.id } });
  fs.unlink(filePath, () => {});
  await audit(req, 'delete', 'employee_document', document.id, { employeeId: document.employeeId });
  res.json({ message: 'Document deleted.' });
}));

router.get('/payments', authMiddleware, checkRole(FINANCE), asyncHandler(async (req, res) => {
  res.json(await prisma.payments.findMany({ orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], ...pagination(req.query) }));
}));

router.post('/payments', authMiddleware, checkRole(FINANCE), asyncHandler(async (req, res) => {
  const payload = cleanBody(req.body, ['invoiceId', 'amount', 'method', 'date', 'reference']);
  requireFields(payload, ['invoiceId', 'amount', 'date']);
  payload.amount = validMoney(payload.amount, 'Payment amount');

  const payment = await serializableTransaction(async (tx) => {
    const invoice = await tx.invoices.findUnique({ where: { id: payload.invoiceId } });
    if (!invoice) {
      const error = new Error('Invoice not found.');
      error.status = 404;
      throw error;
    }
    const paymentTotal = await tx.payments.aggregate({
      where: { invoiceId: invoice.id },
      _sum: { amount: true }
    });
    const paid = parseAmount(paymentTotal._sum.amount);
    const outstanding = Number(invoice.total) - paid;
    if (payload.amount > outstanding + 0.01) {
      const error = new Error(`Payment exceeds outstanding amount of ${outstanding.toFixed(2)}.`);
      error.status = 400;
      throw error;
    }
    const created = await tx.payments.create({
      data: prepareData('payments', {
        id: `PAY-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        invoiceId: invoice.id,
        customer: invoice.customer,
        amount: payload.amount,
        method: payload.method || 'NEFT',
        date: payload.date,
        reference: payload.reference || null,
        recordedBy: req.user.name
      }, { create: true })
    });
    const remaining = outstanding - payload.amount;
    await tx.invoices.update({
      where: { id: invoice.id },
      data: prepareData('invoices', { status: remaining <= 0.01 ? 'Paid' : 'Partially Paid' })
    });
    return created;
  });
  await audit(req, 'create', 'payment', payment.id, { invoiceId: payment.invoiceId, amount: payment.amount });
  await broadcastNotification(req, {
    type: 'payment',
    title: `${req.user.name} recorded a payment`,
    message: `${payment.customer}: ₹${Number(payment.amount).toLocaleString('en-IN')}`,
    link: '/accounts'
  });
  const paymentInvoice = await prisma.invoices.findUnique({ where: { id: payment.invoiceId }, include: { Customers: true } });
  queueMultiChannelNotification({
    toEmail: paymentInvoice?.Customers?.email,
    toPhone: paymentInvoice?.Customers?.phone,
    subject: `Payment receipt ${payment.id}`,
    textContent: `We recorded your payment of ₹${Number(payment.amount).toLocaleString('en-IN')} against invoice ${payment.invoiceId}.`
  });
  res.status(201).json(payment);
}));

router.post('/renewals/:id/renew', authMiddleware, checkRole([...SALES, ...FINANCE]), asyncHandler(async (req, res) => {
  const result = await serializableTransaction(async (tx) => {
    const renewal = await tx.renewals.findUnique({ where: { id: Number(req.params.id) } });
    if (!renewal) {
      const error = new Error('Renewal not found.');
      error.status = 404;
      throw error;
    }
    const renewedOn = toDateOnly(req.body.date || currentDateOnly());
    const nextDue = new Date(renewedOn);
    nextDue.setFullYear(nextDue.getFullYear() + 1);
    const dateValue = renewedOn.toISOString().slice(0, 10);
    const nextDueValue = nextDue.toISOString().slice(0, 10);
    const updatedRenewal = await tx.renewals.update({
      where: { id: renewal.id },
      data: prepareData('renewals', {
        lastDate: dateValue,
        nextDue: nextDueValue,
        daysLeft: 365,
        status: 'Active'
      })
    });

    const subtotal = parseAmount(renewal.amount);
    const gst = Number(req.body.gst ?? 18);
    const total = subtotal + subtotal * gst / 100;
    const invoice = await tx.invoices.create({
      data: prepareData('invoices', {
        id: `INV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        customerId: undefined,
        customer: renewal.customer,
        date: dateValue,
        amount: subtotal,
        gst,
        total,
        status: 'Unpaid'
      }, { create: true })
    });
    return { renewal: updatedRenewal, invoice };
  });
  await audit(req, 'renew', 'renewal', result.renewal.id, { invoiceId: result.invoice.id });
  await broadcastNotification(req, {
    type: 'renewal',
    title: `${req.user.name} processed a renewal`,
    message: `${result.renewal.customer}: ${result.renewal.type}`,
    link: '/renewals'
  });
  const renewalCustomer = await prisma.customers.findFirst({ where: { name: result.renewal.customer } });
  queueMultiChannelNotification({
    toEmail: renewalCustomer?.email,
    toPhone: renewalCustomer?.phone,
    subject: `${result.renewal.type} renewed`,
    textContent: `Your renewal was processed. Invoice ${result.invoice.id} has been created.`
  });
  res.json(result);
}));

router.post('/renewals/:id/remind', authMiddleware, checkRole([...SALES, ...FINANCE]), asyncHandler(async (req, res) => {
  const renewal = await prisma.renewals.findUnique({ where: { id: Number(req.params.id) } });
  if (!renewal) return res.status(404).json({ message: 'Renewal not found.' });
  const customer = await prisma.customers.findFirst({ where: { name: renewal.customer } });
  const results = await sendMultiChannelNotification({
    toEmail: customer?.email,
    toPhone: customer?.phone,
    subject: `${renewal.type} renewal reminder`,
    textContent: `Your ${renewal.type} service is due for renewal on ${dateString(renewal.nextDue)}.`
  });
  await audit(req, 'remind', 'renewal', renewal.id, results);
  res.json({ message: 'Reminder processed.', channels: results });
}));

router.post('/quotations/:id/send', authMiddleware, checkRole(SALES), asyncHandler(async (req, res) => {
  const quotation = await prisma.quotations.findUnique({ where: { id: req.params.id } });
  if (!quotation) return res.status(404).json({ message: 'Quotation not found.' });
  const customer = await prisma.customers.findFirst({ where: { name: quotation.customer } });
  const results = await sendMultiChannelNotification({
    toEmail: customer?.email,
    toPhone: customer?.phone,
    subject: `Quotation ${quotation.id}`,
    textContent: `Your quotation ${quotation.id} for ${quotation.amount} is ready.`
  });
  await audit(req, 'send', 'quotation', quotation.id, results);
  res.json({ message: 'Quotation delivery processed.', channels: results });
}));

router.get('/notifications', authMiddleware, asyncHandler(async (req, res) => {
  res.json(await prisma.notifications.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: NOTIFICATION_SELECT
  }));
}));

router.put('/notifications/read-all', authMiddleware, asyncHandler(async (req, res) => {
  await prisma.notifications.updateMany({
    where: { userId: req.user.id },
    data: prepareData('notifications', { read: true })
  });
  res.json({ message: 'Notifications marked as read.' });
}));

router.put('/notifications/:id/read', authMiddleware, asyncHandler(async (req, res) => {
  const notification = await prisma.notifications.findFirst({
    where: { id: Number(req.params.id), userId: req.user.id },
    select: { id: true }
  });
  if (!notification) return res.status(404).json({ message: 'Notification not found.' });
  const updatedNotification = await prisma.notifications.update({
    where: { id: notification.id },
    data: prepareData('notifications', { read: true }),
    select: NOTIFICATION_SELECT
  });
  res.json(updatedNotification);
}));

router.get('/activity', authMiddleware, checkRole(ADMIN), asyncHandler(async (req, res) => {
  res.json(await prisma.activityLogs.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }));
}));

router.get('/search', authMiddleware, asyncHandler(async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2) return res.json([]);
  const canSales = SALES.includes(req.user.role);
  const canFinance = FINANCE.includes(req.user.role);
  const canTickets = [...SUPPORT, ...OPERATIONS].includes(req.user.role);
  const [leads, customers, invoices, tickets] = await Promise.all([
    canSales ? prisma.leads.findMany({ where: { OR: [{ name: { contains: query, mode: 'insensitive' } }, { company: { contains: query, mode: 'insensitive' } }, { phone: { contains: query, mode: 'insensitive' } }] }, take: 5 }) : [],
    prisma.customers.findMany({ where: { OR: [{ name: { contains: query, mode: 'insensitive' } }, { contact: { contains: query, mode: 'insensitive' } }, { phone: { contains: query, mode: 'insensitive' } }] }, take: 5 }),
    canFinance ? prisma.invoices.findMany({ where: { OR: [{ id: { contains: query, mode: 'insensitive' } }, { customer: { contains: query, mode: 'insensitive' } }] }, take: 5 }) : [],
    canTickets ? prisma.tickets.findMany({ where: { OR: [{ subject: { contains: query, mode: 'insensitive' } }, { customer: { contains: query, mode: 'insensitive' } }] }, take: 5 }) : []
  ]);
  res.json([
    ...(canSales ? leads.map((item) => ({ type: 'Lead', id: item.id, title: item.name, subtitle: item.company || item.phone, path: '/leads' })) : []),
    ...customers.map((item) => ({ type: 'Customer', id: item.id, title: item.name, subtitle: item.contact || item.phone, path: `/customers/${item.id}` })),
    ...(canFinance ? invoices.map((item) => ({ type: 'Invoice', id: item.id, title: item.id, subtitle: item.customer, path: '/accounts' })) : []),
    ...(canTickets ? tickets.map((item) => ({ type: 'Ticket', id: item.id, title: item.subject, subtitle: item.customer, path: '/tickets' })) : [])
  ]);
}));

router.get('/calendar/events', authMiddleware, asyncHandler(async (req, res) => {
  const from = req.query.from ? toDateOnly(req.query.from) : new Date(new Date().getFullYear() - 1, 0, 1);
  const to = req.query.to ? toDateOnly(req.query.to) : new Date(new Date().getFullYear() + 1, 11, 31);
  const isManager = MANAGEMENT.includes(req.user.role);
  const [tasks, renewals, installations] = await Promise.all([
    prisma.tasks.findMany({ where: { due: { gte: from, lte: to }, ...(isManager ? {} : { assignedUserId: req.user.id }) }, take: 1000, ...(await compatibilitySelect('tasks')) }),
    SALES.includes(req.user.role) || FINANCE.includes(req.user.role)
      ? prisma.renewals.findMany({ where: { nextDue: { gte: from, lte: to } }, take: 1000, select: { id: true, customer: true, type: true, nextDue: true } }) : [],
    OPERATIONS.includes(req.user.role) || SALES.includes(req.user.role) || SUPPORT.includes(req.user.role)
      ? prisma.installations.findMany({ where: { date: { gte: from, lte: to } }, take: 1000, select: { id: true, type: true, customer: true, date: true } }) : []
  ]);
  res.json([
    ...tasks.map((item) => ({ id: `task-${item.id}`, title: `Task: ${item.title}`, start: dateString(item.due), end: dateString(item.due), type: 'task', path: '/tasks' })),
    ...renewals.map((item) => ({ id: `renewal-${item.id}`, title: `Renewal: ${item.customer} - ${item.type}`, start: dateString(item.nextDue), end: dateString(item.nextDue), type: 'renewal', path: '/renewals' })),
    ...installations.map((item) => ({ id: `installation-${item.id}`, title: `${item.type}: ${item.customer}`, start: dateString(item.date), end: dateString(item.date), type: 'install', path: '/installations' }))
  ]);
}));

async function reportData() {
  const [invoices, payments, leads, employees, inventory, renewals] = await Promise.all([
    prisma.invoices.findMany({ orderBy: { date: 'asc' } }),
    prisma.payments.findMany({ orderBy: { date: 'asc' } }),
    prisma.leads.findMany(),
    prisma.employees.findMany({ orderBy: { name: 'asc' } }),
    prisma.inventories.findMany({ orderBy: { name: 'asc' } }),
    prisma.renewals.findMany({ orderBy: { nextDue: 'asc' } })
  ]);
  const monthlySales = new Map();
  const paidByInvoice = new Map();
  for (const payment of payments) {
    const month = dateString(payment.date).slice(0, 7);
    monthlySales.set(month, (monthlySales.get(month) || 0) + Number(payment.amount || 0));
    paidByInvoice.set(payment.invoiceId, (paidByInvoice.get(payment.invoiceId) || 0) + Number(payment.amount || 0));
  }
  return {
    invoices,
    payments,
    leads,
    employees,
    inventory,
    renewals,
    paidByInvoice,
    salesTrend: [...monthlySales.entries()].map(([month, sales]) => ({ month, sales })),
    totals: {
      invoiced: invoices.reduce((sum, item) => sum + Number(item.total || 0), 0),
      received: payments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      outstanding: invoices.reduce((sum, item) => sum + Math.max(0, Number(item.total || 0) - (paidByInvoice.get(item.id) || 0)), 0),
      leads: leads.length,
      converted: leads.filter((item) => ['Won', 'Converted'].includes(item.status)).length
    }
  };
}

router.get('/reports/summary', authMiddleware, checkRole(REPORTING), asyncHandler(async (req, res) => {
  const [employees, salesRows, invoiceAggregate, paymentAggregate, outstandingRows, leadCount, convertedCount] = await Promise.all([
    prisma.employees.findMany({
      select: { name: true, dept: true, status: true, payrollStatus: true },
      orderBy: { name: 'asc' }
    }),
    prisma.$queryRaw`
      SELECT TO_CHAR("date", 'YYYY-MM') AS month, SUM("amount")::text AS sales
      FROM "Payments" GROUP BY TO_CHAR("date", 'YYYY-MM') ORDER BY month
    `,
    prisma.invoices.aggregate({ _sum: { total: true } }),
    prisma.payments.aggregate({ _sum: { amount: true } }),
    prisma.$queryRaw`
      SELECT COALESCE(SUM(GREATEST(i."total" - COALESCE(p.paid, 0), 0)), 0)::text AS value
      FROM "Invoices" i
      LEFT JOIN (SELECT "invoiceId", SUM("amount") AS paid FROM "Payments" GROUP BY "invoiceId") p ON p."invoiceId" = i."id"
    `,
    prisma.leads.count(),
    prisma.leads.count({ where: { status: { in: ['Won', 'Converted'] } } })
  ]);
  res.json({
    salesTrend: salesRows.map((item) => ({ month: item.month, sales: Number(item.sales || 0) })),
    employees: employees.map((item) => ({ name: item.name, department: item.dept, status: item.status, payrollStatus: item.payrollStatus })),
    totals: {
      invoiced: Number(invoiceAggregate._sum.total || 0),
      received: Number(paymentAggregate._sum.amount || 0),
      outstanding: Number(outstandingRows[0]?.value || 0),
      leads: leadCount,
      converted: convertedCount
    }
  });
}));
router.get('/reports/:type.csv', authMiddleware, checkRole(REPORTING), asyncHandler(async (req, res) => {
  const data = await reportData();
  const reports = {
    sales: {
      headers: ['Payment ID', 'Invoice ID', 'Customer', 'Date', 'Amount', 'Method'],
      rows: data.payments.map((item) => [item.id, item.invoiceId, item.customer, item.date, item.amount, item.method])
    },
    outstanding: {
      headers: ['Invoice ID', 'Customer', 'Date', 'Total', 'Paid', 'Outstanding', 'Status'],
      rows: data.invoices.filter((item) => item.status !== 'Paid').map((item) => {
        const paid = data.paidByInvoice.get(item.id) || 0;
        return [item.id, item.customer, item.date, item.total, paid, Math.max(0, Number(item.total) - paid), item.status];
      })
    },
    inventory: {
      headers: ['Item', 'Category', 'Barcode', 'Stock', 'Minimum', 'Status'],
      rows: data.inventory.map((item) => [item.name, item.category, item.barcode, item.stock, item.min, item.status])
    },
    renewals: {
      headers: ['Customer', 'Type', 'Next Due', 'Amount', 'Status'],
      rows: data.renewals.map((item) => [item.customer, item.type, item.nextDue, item.amount, item.status])
    },
    employees: {
      headers: ['Name', 'Department', 'Role', 'Attendance', 'Payroll'],
      rows: data.employees.map((item) => [item.name, item.dept, item.role, item.status, item.payrollStatus])
    }
  };
  const report = reports[req.params.type];
  if (!report) return res.status(404).json({ message: 'Report type not found.' });
  const csv = [report.headers, ...report.rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}-report.csv"`);
  res.send(`\uFEFF${csv}`);
}));

// ==========================================
// CHAT & MESSAGING SUITE API
// ==========================================
router.get('/chat/users', authMiddleware, asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;
  const today = currentDateOnly();

  const [allUsers, attendances, allEmployees, allGroups] = await Promise.all([
    prisma.users.findMany({
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true }
    }),
    prisma.attendances.findMany({
      where: { date: toDateOnly(today) },
      select: { employeeId: true, status: true, checkIn: true, checkOut: true }
    }),
    prisma.employees.findMany({
      select: { id: true, name: true, dept: true, role: true, status: true, email: true, phone: true }
    }),
    prisma.chatGroups.findMany({
      where: groupAccessWhere(currentUserId),
      orderBy: { createdAt: 'desc' }
    })
  ]);

  // Unread counts for 1-on-1 messages
  const unreadCounts = await prisma.chatMessages.groupBy({
    by: ['senderId'],
    where: { receiverId: currentUserId, groupId: null, read: false },
    _count: { id: true }
  });
  const unreadMap = new Map(unreadCounts.map((u) => [u.senderId, u._count.id]));

  // Recent 1-on-1 messages
  const recentMessages = await prisma.chatMessages.findMany({
    where: {
      groupId: null,
      OR: [
        { senderId: currentUserId },
        { receiverId: currentUserId }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });

  const lastMessageMap = new Map();
  for (const msg of recentMessages) {
    const otherId = msg.senderId === currentUserId ? msg.receiverId : msg.senderId;
    if (otherId && !lastMessageMap.has(otherId)) {
      lastMessageMap.set(otherId, msg);
    }
  }

  // Map 1-on-1 contacts
  const contacts = allUsers
    .filter((u) => u.id !== currentUserId)
    .map((u) => {
      const matchingEmp = allEmployees.find((e) =>
        (e.email && u.email && e.email.toLowerCase() === u.email.toLowerCase()) ||
        (e.name && u.name && e.name.toLowerCase() === u.name.toLowerCase())
      );
      const att = matchingEmp ? attendances.find((a) => a.employeeId === matchingEmp.id) : null;
      const isPresent = att ? (att.status === 'Present' || att.status === 'Late') : (matchingEmp ? matchingEmp.status === 'Present' : true);
      const statusLabel = isPresent ? 'Present' : (att ? att.status : 'Active');
      const lastMsg = lastMessageMap.get(u.id);

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || (matchingEmp ? matchingEmp.phone : null),
        role: u.role,
        dept: matchingEmp?.dept || u.role.replace(/_/g, ' '),
        isPresent,
        statusLabel,
        isGroup: false,
        unreadCount: unreadMap.get(u.id) || 0,
        lastMessage: lastMsg ? {
          id: lastMsg.id,
          message: lastMsg.message,
          senderId: lastMsg.senderId,
          read: lastMsg.read,
          createdAt: lastMsg.createdAt
        } : null,
        lastActive: lastMsg ? lastMsg.createdAt : u.createdAt
      };
    });

  // Map Groups
  const groupContacts = await Promise.all(
    allGroups.map(async (g) => {
      const lastGroupMsg = await prisma.chatMessages.findFirst({
        where: { groupId: g.id },
        orderBy: { createdAt: 'desc' }
      });

      const memberIds = Array.isArray(g.members) ? g.members : [];
      const memberNames = allUsers.filter(u => memberIds.includes(u.id)).map(u => u.name);

      return {
        id: `group_${g.id}`,
        groupId: g.id,
        name: g.name,
        description: g.description,
        avatarColor: g.avatarColor || '#10b981',
        isGroup: true,
        memberIds,
        memberNames,
        role: `${memberIds.length} members`,
        dept: 'Team Group',
        isPresent: true,
        statusLabel: 'Active Group',
        unreadCount: 0,
        lastMessage: lastGroupMsg ? {
          id: lastGroupMsg.id,
          message: lastGroupMsg.message,
          senderId: lastGroupMsg.senderId,
          createdAt: lastGroupMsg.createdAt
        } : null,
        lastActive: lastGroupMsg ? lastGroupMsg.createdAt : g.createdAt
      };
    })
  );

  const combined = [...groupContacts, ...contacts];

  combined.sort((a, b) => {
    if (a.isGroup && !b.isGroup && (!b.lastMessage || b.unreadCount === 0)) return -1;
    if (a.lastMessage && b.lastMessage) {
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    }
    if (a.lastMessage && !b.lastMessage) return -1;
    if (!a.lastMessage && b.lastMessage) return 1;
    return a.name.localeCompare(b.name);
  });

  res.json(combined);
}));

router.get('/chat/messages/:id', authMiddleware, asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;
  const isGroup = req.query.type === 'group' || String(req.params.id).startsWith('group_');
  const targetId = Number(String(req.params.id).replace('group_', ''));

  if (!targetId || Number.isNaN(targetId)) {
    return res.status(400).json({ message: 'Invalid target ID.' });
  }

  const before = req.query.before === undefined ? null : Number(req.query.before);
  if (before !== null && (!Number.isSafeInteger(before) || before < 1)) {
    return res.status(400).json({ message: 'Invalid history cursor.' });
  }
  const historyWhere = before ? { id: { lt: before } } : {};

  if (isGroup) {
    const group = await prisma.chatGroups.findUnique({ where: { id: targetId } });
    if (!isGroupMember(group, currentUserId)) return res.status(404).json({ message: 'Group not found.' });
    const messages = await prisma.chatMessages.findMany({
      where: { groupId: targetId, ...historyWhere },
      orderBy: { id: 'desc' },
      take: 100
    });
    messages.reverse();

    // Populate sender information for group messages
    const senderIds = [...new Set(messages.map(m => m.senderId))];
    const senders = await prisma.users.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, name: true, role: true }
    });
    const senderMap = new Map(senders.map(s => [s.id, s]));

    const enriched = messages.map(m => ({
      ...m,
      senderName: senderMap.get(m.senderId)?.name || 'User',
      senderRole: senderMap.get(m.senderId)?.role || 'member'
    }));

    return res.json(enriched);
  }

  // 1-on-1 messages
  await prisma.chatMessages.updateMany({
    where: {
      senderId: targetId,
      receiverId: currentUserId,
      groupId: null,
      read: false
    },
    data: { read: true, updatedAt: new Date() }
  });

  const messages = await prisma.chatMessages.findMany({
    where: {
      groupId: null,
      ...historyWhere,
      OR: [
        { senderId: currentUserId, receiverId: targetId },
        { senderId: targetId, receiverId: currentUserId }
      ]
    },
    orderBy: { id: 'desc' },
    take: 100
  });

  res.json(messages.reverse());
}));

router.post('/chat/messages', authMiddleware, asyncHandler(async (req, res) => {
  const senderId = req.user.id;
  const isGroup = Boolean(req.body.groupId || req.body.isGroup);
  const groupId = req.body.groupId ? Number(req.body.groupId) : null;
  const receiverId = req.body.receiverId ? Number(req.body.receiverId) : null;
  const message = String(req.body.message || '').trim();
  const attachment = req.body.attachment ? String(req.body.attachment).trim() : null;
  const attachmentName = req.body.attachmentName ? String(req.body.attachmentName).trim() : null;

  if (!groupId && (!receiverId || Number.isNaN(receiverId))) {
    return res.status(400).json({ message: 'Receiver ID or Group ID is required.' });
  }

  if (!message && !attachment) {
    return res.status(400).json({ message: 'Message content or attachment is required.' });
  }

  if (attachment) {
    const ownedUpload = await prisma.chatUploads.findUnique({ where: { storedName: attachment } });
    if (!ownedUpload || ownedUpload.userId !== senderId || attachment !== path.basename(attachment)) {
      return res.status(403).json({ message: 'Upload this attachment using your own account first.' });
    }
  }

  if (isGroup && groupId) {
    const group = await prisma.chatGroups.findUnique({ where: { id: groupId } });
    if (!isGroupMember(group, senderId)) return res.status(404).json({ message: 'Group not found.' });

    const newGroupMessage = await prisma.chatMessages.create({
      data: prepareData('chatMessages', {
        senderId,
        receiverId: null,
        groupId,
        message: message || (attachmentName ? `Sent attachment: ${attachmentName}` : 'Attachment'),
        attachment,
        attachmentName,
        read: false
      }, { create: true })
    });

    return res.status(201).json({
      ...newGroupMessage,
      senderName: req.user.name,
      senderRole: req.user.role
    });
  }

  const receiver = await prisma.users.findUnique({ where: { id: receiverId } });
  if (!receiver) {
    return res.status(404).json({ message: 'Receiver user not found.' });
  }

  const newMessage = await prisma.chatMessages.create({
    data: prepareData('chatMessages', {
      senderId,
      receiverId,
      groupId: null,
      message: message || (attachmentName ? `Sent attachment: ${attachmentName}` : 'Attachment'),
      attachment,
      attachmentName,
      read: false
    }, { create: true })
  });

  await createNotification(req, {
    userId: receiverId,
    type: 'chat',
    title: `New message from ${req.user.name}`,
    message: message ? (message.length > 50 ? `${message.slice(0, 47)}...` : message) : 'Sent an attachment',
    link: '/chat'
  }).catch(() => {});

  res.status(201).json(newMessage);
}));

router.post('/chat/groups', authMiddleware, asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const avatarColor = req.body.avatarColor || '#10b981';
  let memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds.map(Number).filter(Boolean) : [];

  if (!name) {
    return res.status(400).json({ message: 'Group name is required.' });
  }

  if (!memberIds.includes(req.user.id)) {
    memberIds.push(req.user.id);
  }
  memberIds = [...new Set(memberIds)];
  const memberCount = await prisma.users.count({ where: { id: { in: memberIds } } });
  if (memberCount !== memberIds.length) return res.status(400).json({ message: 'Select valid group members.' });

  const group = await prisma.chatGroups.create({
    data: prepareData('chatGroups', {
      name,
      description,
      avatarColor,
      createdBy: req.user.id,
      members: memberIds
    }, { create: true })
  });

  // Create welcome message in group
  await prisma.chatMessages.create({
    data: prepareData('chatMessages', {
      senderId: req.user.id,
      groupId: group.id,
      message: `🎉 Group "${group.name}" was created. Welcome all members!`,
      read: false
    }, { create: true })
  });

  res.status(201).json(group);
}));

router.get('/chat/unread-count', authMiddleware, asyncHandler(async (req, res) => {
  const count = await prisma.chatMessages.count({
    where: { receiverId: req.user.id, groupId: null, read: false }
  });
  res.json({ unreadCount: count });
}));

router.delete('/chat/messages/:id', authMiddleware, asyncHandler(async (req, res) => {
  const messageId = Number(req.params.id);
  const msg = await prisma.chatMessages.findUnique({ where: { id: messageId } });
  if (!msg) return res.status(404).json({ message: 'Message not found.' });

  // Only the sender or super admin can delete
  if (msg.senderId !== req.user.id && req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'You can only delete your own sent messages.' });
  }

  // 10-Minute Deletion Window Rule (both for regular users and superadmin)
  const messageAgeMs = Date.now() - new Date(msg.createdAt).getTime();
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  if (messageAgeMs > TEN_MINUTES_MS) {
    return res.status(403).json({ message: 'Messages can only be deleted within 10 minutes of sending.' });
  }

  // Clean up stored file from server storage to free disk space
  if (msg.attachment && await prisma.chatMessages.count({ where: { attachment: msg.attachment, id: { not: msg.id } } }) === 0) {
    const filePath = path.join(uploadDir, path.basename(msg.attachment));
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  }

  await prisma.chatMessages.delete({ where: { id: messageId } });
  res.json({ message: 'Message deleted successfully.' });
}));

router.post('/chat/upload', authMiddleware, uploadLimiter, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File is required.' });
  try {
    validateUploadedFile(req.file);
    await prisma.chatUploads.create({ data: { storedName: req.file.filename, userId: req.user.id } });
  } catch (error) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    throw error;
  }
  res.status(201).json({
    storedName: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype
  });
}));

async function authorizeChatFile(req, res, next) {
  const filename = req.params.filename;
  if (filename !== path.basename(filename)) return res.status(404).json({ message: 'Attachment not found.' });
  const groups = await prisma.chatGroups.findMany({ where: groupAccessWhere(req.user.id), select: { id: true } });
  const message = await prisma.chatMessages.findFirst({
    where: { attachment: filename, OR: [
      { groupId: null, OR: [{ senderId: req.user.id }, { receiverId: req.user.id }] },
      { groupId: { in: groups.map(group => group.id) } }
    ] }, select: { id: true }
  });
  if (!message) return res.status(404).json({ message: 'Attachment not found.' });
  res.setHeader('Cache-Control', 'private, no-store');
  return next();
}

router.get('/chat/download/:filename', authMiddleware, asyncHandler(authorizeChatFile), asyncHandler(async (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadDir, filename);
  const downloadName = req.query.name ? decodeURIComponent(req.query.name) : filename;

  if (fs.existsSync(filePath)) {
    return res.download(filePath, downloadName);
  }

  res.status(404).json({ message: 'Attachment not found.' });
}));

router.get('/chat/media/:filename', authMiddleware, asyncHandler(authorizeChatFile), (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    return res.sendFile(filePath);
  }
  res.status(404).send('Media not found');
});

router.get('/dashboard/stats', authMiddleware, checkRole(ALL_STAFF), asyncHandler(async (req, res) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const canSales = SALES.includes(req.user.role);
  const canFinance = FINANCE.includes(req.user.role);
  const canTickets = [...SUPPORT, ...OPERATIONS].includes(req.user.role);
  const canRenewals = canSales || canFinance;

  const [
    totalLeads,
    totalCustomers,
    openTickets,
    pendingInvoices,
    renewalsDueSoon,
    recentLeads,
    leadsBySource,
    recentCustomers,
    outstandingRows,
    revenueRows,
    activeInstallations,
    pendingTasks,
    allCustomersList,
    inventoryItems,
    allInstallations,
    allTasks
  ] = await Promise.all([
    canSales ? prisma.leads.count() : 0,
    prisma.customers.count(),
    canTickets ? prisma.tickets.count({ where: { status: { in: ['Open', 'In_Progress'] } } }) : 0,
    canFinance ? prisma.invoices.count({ where: { status: { in: ['Unpaid', 'Overdue', 'Partially_Paid'] } } }) : 0,
    prisma.renewals.count({ where: { nextDue: { gte: now, lte: sevenDaysFromNow } } }),
    canSales ? prisma.leads.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, name: true, company: true, phone: true, source: true, service: true, status: true } }) : [],
    canSales ? prisma.leads.groupBy({ by: ['source'], _count: { id: true } }) : [],
    prisma.customers.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, name: true, contact: true, phone: true, services: true, status: true, createdAt: true } }),
    canFinance ? prisma.$queryRaw`
      SELECT COALESCE(SUM(GREATEST(i."total" - COALESCE(p.paid, 0), 0)), 0)::text AS value
      FROM "Invoices" i
      LEFT JOIN (SELECT "invoiceId", SUM("amount") AS paid FROM "Payments" GROUP BY "invoiceId") p ON p."invoiceId" = i."id"
    ` : [],
    canFinance ? prisma.$queryRaw`
      SELECT TO_CHAR("date", 'YYYY-MM') AS month, SUM("amount")::text AS revenue
      FROM "Payments"
      GROUP BY TO_CHAR("date", 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 6
    ` : [],
    prisma.installations.count({ where: { status: { in: ['Pending', 'In_Progress'] } } }),
    prisma.tasks.count({ where: { status: { in: ['Pending', 'Ongoing'] } } }),
    prisma.customers.findMany({ select: { id: true, services: true, createdAt: true } }),
    prisma.inventories.findMany({ select: { stock: true, min: true, status: true } }),
    prisma.installations.findMany({ select: { id: true, createdAt: true, date: true } }),
    prisma.tasks.findMany({ select: { id: true, createdAt: true } })
  ]);

  const pendingRevenue = Number(outstandingRows[0]?.value || 0);
  const revenueHistory = revenueRows.reverse().map((item) => ({ month: item.month, revenue: Number(item.revenue || 0) }));

  // Low stock inventory calculation
  const lowStockCount = inventoryItems.filter(item => (item.stock || 0) <= (item.min || 0) || ['LOW', 'OUT', 'Low Stock', 'Out of Stock'].includes(item.status)).length;

  // Subscribed services distribution
  const serviceCounts = {};
  for (const c of allCustomersList) {
    let sList = [];
    if (Array.isArray(c.services)) sList = c.services;
    else if (typeof c.services === 'string') {
      try {
        const parsed = JSON.parse(c.services);
        if (Array.isArray(parsed)) sList = parsed;
      } catch {
        sList = c.services.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    for (const raw of sList) {
      const s = String(raw).trim();
      let normalized = s;
      const lower = s.toLowerCase();
      if (lower.includes('gps')) normalized = 'GPS';
      else if (lower.includes('cctv') || lower.includes('camera')) normalized = 'CCTV';
      else if (lower.includes('web')) normalized = 'Website';
      else if (lower.includes('waba') || lower.includes('whatsapp')) normalized = 'Waba';
      else if (lower.includes('sms')) normalized = 'SMS';
      else if (lower.includes('rcs')) normalized = 'RCS';
      else if (lower.includes('voice')) normalized = 'Voice';

      serviceCounts[normalized] = (serviceCounts[normalized] || 0) + 1;
    }
  }

  const SERVICE_COLORS = {
    GPS: '#3b82f6',
    CCTV: '#10b981',
    Website: '#6366f1',
    SMS: '#f59e0b',
    RCS: '#ec4899',
    Voice: '#8b5cf6',
    Waba: '#22c55e'
  };

  const servicesDistribution = Object.entries(serviceCounts).map(([service, count]) => ({
    service,
    count,
    color: SERVICE_COLORS[service] || '#94a3b8'
  }));

  // Build 6 months operations history
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const operationsHistory = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
    operationsHistory.push({ key, month: label, installations: 0, tasks: 0, customers: 0 });
  }

  for (const inst of allInstallations) {
    const d = inst.date || inst.createdAt;
    if (d) {
      const dt = new Date(d);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const m = operationsHistory.find(item => item.key === key);
      if (m) m.installations++;
    }
  }

  for (const t of allTasks) {
    if (t.createdAt) {
      const dt = new Date(t.createdAt);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const m = operationsHistory.find(item => item.key === key);
      if (m) m.tasks++;
    }
  }

  for (const c of allCustomersList) {
    if (c.createdAt) {
      const dt = new Date(c.createdAt);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const m = operationsHistory.find(item => item.key === key);
      if (m) m.customers++;
    }
  }

  res.json({
    totalLeads,
    totalCustomers,
    openTickets,
    pendingInvoices,
    renewalsDueSoon,
    pendingRevenue,
    recentLeads,
    recentCustomers,
    leadsBySource: leadsBySource.map((item) => ({ source: item.source, count: item._count.id })),
    revenueHistory,
    activeInstallations,
    pendingTasks,
    lowStockCount,
    servicesDistribution,
    operationsHistory
  });
}));

// ─── Settings (Admin-only) ───────────────────────────────────────────────────
const SETTINGS_KEYS = ['sms_webhook_url', 'whatsapp_webhook_url'];

router.get('/settings', authMiddleware, checkRole(ADMIN), asyncHandler(async (req, res) => {
  const rows = await prisma.appSettings.findMany({ where: { key: { in: SETTINGS_KEYS } } });
  const settings = Object.fromEntries(SETTINGS_KEYS.map((key) => [key, '']));
  for (const row of rows) settings[row.key] = row.value || '';
  res.json(settings);
}));

router.put('/settings', authMiddleware, checkRole(ADMIN), asyncHandler(async (req, res) => {
  const now = new Date();
  const updates = [];
  for (const key of SETTINGS_KEYS) {
    if (req.body[key] !== undefined) {
      updates.push(
        prisma.appSettings.upsert({
          where: { key },
          create: { key, value: String(req.body[key]).trim(), updatedAt: now },
          update: { value: String(req.body[key]).trim(), updatedAt: now }
        })
      );
    }
  }
  if (updates.length) await Promise.all(updates);
  await audit(req, 'update', 'settings', null, { keys: SETTINGS_KEYS.filter((key) => req.body[key] !== undefined) });
  const rows = await prisma.appSettings.findMany({ where: { key: { in: SETTINGS_KEYS } } });
  const settings = Object.fromEntries(SETTINGS_KEYS.map((key) => [key, '']));
  for (const row of rows) settings[row.key] = row.value || '';
  res.json(settings);
}));

router.use((req, res) => res.status(404).json({ message: 'API endpoint not found.' }));

module.exports = router;
