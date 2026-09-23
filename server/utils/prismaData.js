const DATE_ONLY_FIELDS = new Set([
  'date',
  'followUp',
  'renewalDate',
  'goLive',
  'lastDate',
  'nextDue',
  'due',
  'startDate',
  'endDate'
]);

const TIME_FIELDS = new Set(['checkIn', 'checkOut']);

const ENUM_TO_PRISMA = new Map([
  ['Support Team', 'Support_Team'],
  ['In Progress', 'In_Progress'],
  ['Demo Given', 'Demo_Given'],
  ['Quotation Sent', 'Quotation_Sent'],
  ['Partially Paid', 'Partially_Paid'],
  ['Pending Approval', 'Pending_Approval'],
  ['Not Completed', 'Not_Completed']
]);

const ENUM_FROM_PRISMA = new Map([...ENUM_TO_PRISMA.entries()].map(([external, internal]) => [internal, external]));

const MODELS_WITH_UPDATED_AT = new Set([
  'attendances',
  'chatGroups',
  'chatMessages',
  'customerDocuments',
  'employeeDocuments',
  'customers',
  'employees',
  'fieldVisits',
  'installations',
  'inventories',
  'inventoryTransactions',
  'invoices',
  'leads',
  'leaveRequests',
  'notifications',
  'payments',
  'payrolls',
  'quotations',
  'renewals',
  'tasks',
  'tickets',
  'users'
]);

function currentDateOnly(date = new Date(), timeZone = process.env.APP_TIME_ZONE || 'Asia/Kolkata') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function toDateOnly(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  return new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
}

function toTime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  const normalized = String(value).length === 5 ? `${value}:00` : String(value);
  return new Date(`1970-01-01T${normalized}Z`);
}

function prepareData(model, data, { create = false } = {}) {
  const prepared = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined) continue;
    if (DATE_ONLY_FIELDS.has(key)) {
      prepared[key] = toDateOnly(value);
    } else if (TIME_FIELDS.has(key)) {
      prepared[key] = toTime(value);
    } else if (typeof value === 'string' && ENUM_TO_PRISMA.has(value)) {
      prepared[key] = ENUM_TO_PRISMA.get(value);
    } else {
      prepared[key] = value;
    }
  }

  if (String(model).toLowerCase() === 'installations') {
    if (prepared.type !== undefined && prepared.type !== null) {
      const typeMap = {
        gps: 'GPS',
        cctv: 'CCTV',
        web: 'Website',
        website: 'Website',
        GPS: 'GPS',
        CCTV: 'CCTV',
        Website: 'Website'
      };
      const trimmed = String(prepared.type).trim();
      const normalizedType = typeMap[trimmed] || typeMap[trimmed.toLowerCase()];
      if (normalizedType) prepared.type = normalizedType;
    }
    if (prepared.cameras !== undefined) {
      prepared.cameras = prepared.cameras === '' || prepared.cameras === null ? 0 : Number.parseInt(prepared.cameras, 10) || 0;
    }
  }

  const now = new Date();
  if (create) {
    prepared.createdAt ??= now;
    if (MODELS_WITH_UPDATED_AT.has(model)) prepared.updatedAt ??= now;
  } else if (MODELS_WITH_UPDATED_AT.has(model)) {
    prepared.updatedAt = now;
  }
  return prepared;
}

function jsonReplacer(key, value) {
  if (typeof value === 'string' && ENUM_FROM_PRISMA.has(value)) {
    return ENUM_FROM_PRISMA.get(value);
  }
  if (DATE_ONLY_FIELDS.has(key) && typeof value === 'string') {
    return value.slice(0, 10);
  }
  if (TIME_FIELDS.has(key) && typeof value === 'string') {
    return value.slice(11, 19);
  }
  return value;
}

function prismaId(model, value) {
  return ['invoices', 'payments', 'quotations'].includes(model) ? String(value) : Number(value);
}

module.exports = {
  DATE_ONLY_FIELDS,
  currentDateOnly,
  prepareData,
  jsonReplacer,
  prismaId,
  toDateOnly,
  toTime
};
