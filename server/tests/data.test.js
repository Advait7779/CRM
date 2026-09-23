const test = require('node:test');
const assert = require('node:assert/strict');
const { currentDateOnly, prepareData, jsonReplacer, prismaId, toDateOnly, toTime } = require('../utils/prismaData');

test('date-only and time inputs use stable UTC database values', () => {
  assert.equal(toDateOnly('2026-08-13').toISOString(), '2026-08-13T00:00:00.000Z');
  assert.equal(toTime('09:45').toISOString(), '1970-01-01T09:45:00.000Z');
  assert.equal(currentDateOnly(new Date('2026-08-12T20:00:00.000Z'), 'Asia/Kolkata'), '2026-08-13');
});

test('API display enums are converted in both directions', () => {
  const prepared = prepareData('tickets', { status: 'In Progress', date: '2026-08-13' });
  assert.equal(prepared.status, 'In_Progress');
  assert.equal(prepared.date.toISOString(), '2026-08-13T00:00:00.000Z');
  assert.equal(jsonReplacer('status', 'Partially_Paid'), 'Partially Paid');
});

test('Prisma identifiers preserve string financial document IDs', () => {
  assert.equal(prismaId('invoices', 123), '123');
  assert.equal(prismaId('customers', '123'), 123);
});

test('prepareData normalizes installations type enum and cameras integer', () => {
  const cctv = prepareData('installations', { type: 'cctv', cameras: '4', customer: 'Acme Corp' });
  assert.equal(cctv.type, 'CCTV');
  assert.equal(cctv.cameras, 4);
  assert.equal(typeof cctv.cameras, 'number');

  const web = prepareData('installations', { type: 'web', cameras: '', domain: 'example.com' });
  assert.equal(web.type, 'Website');
  assert.equal(web.cameras, 0);

  const website = prepareData('installations', { type: 'Website', cameras: null });
  assert.equal(website.type, 'Website');
  assert.equal(website.cameras, 0);

  const gps = prepareData('installations', { type: 'gps' });
  assert.equal(gps.type, 'GPS');
});