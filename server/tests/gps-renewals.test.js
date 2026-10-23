const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { HEADERS, dateOnly, normalizeGpsRenewal, parseGpsWorkbook } = require('../services/gpsRenewals');

async function workbookBuffer(rows, headers = HEADERS) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('GPS Renewals');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('GPS workbook preserves phone and IMEI text, reads Excel dates, and flags duplicate rows', async () => {
  const buffer = await workbookBuffer([
    ['A Customer', '09876543210', '001234567890123', 'MH 01 AB 1234', new Date('2027-01-31T00:00:00Z'), '01/02/2027'],
    ['B Customer', '9876543210', '001234567890123', 'MH 01 AB 1234', '31/01/2027', ''],
    ['C Customer', '9876543211', '123456789012345', 'MH 02 XY 2345', '2027-02-29', '']
  ]);
  const result = await parseGpsWorkbook(buffer);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].contactNo, '09876543210');
  assert.equal(result.rows[0].imeiNo, '001234567890123');
  assert.equal(result.rows[0].nextDue, '2027-01-31');
  assert.equal(result.rows[0].renewalDate, '2027-02-01');
  assert.deepEqual(result.errors.map(error => error.rowNumber), [3, 4]);
});

test('GPS workbook rejects changed headers and manual rows require five valid fields', async () => {
  await assert.rejects(parseGpsWorkbook(await workbookBuffer([], ['Name', ...HEADERS.slice(1)])), /first row/);
  assert.throws(() => normalizeGpsRenewal({ customer: 'A', contactNo: '1', imeiNo: '2', vehicleNumber: 'X', nextDue: '31/02/2027' }), /Expiry date/);
  assert.equal(dateOnly(45000), '2023-03-15');
});
