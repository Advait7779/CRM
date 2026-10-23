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
  await assert.rejects(parseGpsWorkbook(await workbookBuffer([], ['Name', ...HEADERS.slice(1)])), /Could not find/);
  assert.throws(() => normalizeGpsRenewal({ customer: 'A', contactNo: '1', imeiNo: '2', vehicleNumber: 'X', nextDue: '31/02/2027' }), /Expiry date/);
  assert.equal(normalizeGpsRenewal({ customer: 'A', contactNo: '--', imeiNo: '2', vehicleNumber: 'X', nextDue: '2027-02-28' }).contactNo, '');
  assert.equal(dateOnly(45000), '2023-03-15');
});

test('Object Expiry Log reads only Company, Object, IMEI and expiry fields from a wide two-row header', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Object Expiry Log');
  sheet.getRow(5).getCell(6).value = 'Company';
  sheet.getRow(5).getCell(7).value = 'Company';
  for (const [column, heading] of [[1, 'Name'], [2, 'Contact No.'], [6, 'Name'], [7, 'Contact No.'], [11, 'Object'], [12, 'IMEI'], [17, 'Company Expiry Date'], [18, 'Created Date']]) sheet.getRow(6).getCell(column).value = heading;
  for (const [column, value] of [[1, 'Reseller name'], [2, '9999999999'], [6, 'Customer name'], [7, '--'], [11, 'MH 01 AB 1234'], [12, 1234567890123456700], [17, '23-09-2026'], [18, '23-09-2025']]) sheet.getRow(7).getCell(column).value = value;
  const parsed = await parseGpsWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(parsed.sourceFormat, 'Object Expiry Log');
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.warnings.length, 1);
  assert.equal(parsed.rows[0].customer, 'Customer name');
  assert.equal(parsed.rows[0].contactNo, '');
  assert.equal(parsed.rows[0].vehicleNumber, 'MH 01 AB 1234');
  assert.equal(parsed.rows[0].nextDue, '2026-09-23');
  assert.equal(parsed.rows[0].renewalDate, '');
});
