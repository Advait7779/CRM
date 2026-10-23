const ExcelJS = require('exceljs');

const HEADERS = ['Customer name', 'Contact No', 'IMEI No', 'Vehicle Number', 'Expiry date', 'Renewal date'];
const KEYS = ['customer', 'contactNo', 'imeiNo', 'vehicleNumber', 'nextDue', 'renewalDate'];
const MAX_ROWS = 2000;

function dateOnly(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    if (value < 1 || value > 2958465) return '';
    return new Date(Math.round((value - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const indian = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  const parts = iso ? [iso[1], iso[2], iso[3]] : indian ? [indian[3], indian[2], indian[1]] : null;
  if (!parts) return '';
  const [year, month, day] = parts.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
}

function cellValue(cell) {
  const value = cell?.value;
  if (value == null) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if (value.result != null) return value.result;
    if (value.text != null) return value.text;
    if (value.richText) return value.richText.map(part => part.text).join('');
  }
  return value;
}

function normalizeGpsRenewal(input) {
  const fields = {};
  const limits = { customer: 255, contactNo: 40, imeiNo: 80, vehicleNumber: 80 };
  for (const [key, max] of Object.entries(limits)) {
    const value = input[key];
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error(`${HEADERS[KEYS.indexOf(key)]} is too large as a number. Format that Excel column as Text.`);
    fields[key] = String(value ?? '').trim();
    if (!fields[key]) throw new Error(`${HEADERS[KEYS.indexOf(key)]} is required.`);
    if (fields[key].length > max) throw new Error(`${HEADERS[KEYS.indexOf(key)]} is too long.`);
  }
  fields.nextDue = dateOnly(input.nextDue);
  fields.renewalDate = input.renewalDate == null || input.renewalDate === '' ? '' : dateOnly(input.renewalDate);
  if (!fields.nextDue) throw new Error('Expiry date must be a valid date.');
  if (input.renewalDate != null && input.renewalDate !== '' && !fields.renewalDate) throw new Error('Renewal date must be a valid date.');
  return fields;
}

function renewalKey(row) {
  return `${String(row.imeiNo).trim().toLowerCase()}|${dateOnly(row.nextDue)}`;
}

async function parseGpsWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer); } catch { throw new Error('Please select a valid .xlsx Excel workbook.'); }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('The Excel workbook has no worksheet.');
  const headers = HEADERS.map((_, index) => String(cellValue(sheet.getRow(1).getCell(index + 1)) || '').trim().toLowerCase());
  if (headers.some((header, index) => header !== HEADERS[index].toLowerCase())) {
    throw new Error(`The first row must contain these six columns in order: ${HEADERS.join(', ')}.`);
  }
  const rows = [];
  const errors = [];
  const seen = new Set();
  if (sheet.rowCount - 1 > MAX_ROWS) throw new Error(`Import at most ${MAX_ROWS} rows at a time.`);
  for (let index = 2; index <= sheet.rowCount; index += 1) {
    const excelRow = sheet.getRow(index);
    const values = KEYS.map((_, column) => cellValue(excelRow.getCell(column + 1)));
    if (values.every(value => value == null || String(value).trim() === '')) continue;
    try {
      const row = normalizeGpsRenewal(Object.fromEntries(KEYS.map((key, column) => [key, values[column]])));
      const key = renewalKey(row);
      if (seen.has(key)) throw new Error('Duplicate IMEI and expiry date in this file.');
      seen.add(key);
      rows.push({ rowNumber: index, ...row });
    } catch (error) { errors.push({ rowNumber: index, message: error.message }); }
  }
  if (!rows.length && !errors.length) throw new Error('The worksheet has no renewal rows.');
  return { rows, errors };
}

module.exports = { HEADERS, dateOnly, normalizeGpsRenewal, renewalKey, parseGpsWorkbook };
