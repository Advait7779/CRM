const test = require('node:test');
const assert = require('node:assert/strict');
const { mobileFromContact, eligibleForExpiredSms, renewalSmsUrl, sendGpsRenewalSms } = require('../services/gpsRenewalSms');

const record = {
  id: 1,
  customer: 'Om sai sales',
  contactNo: '9049456804(C), 8282982829(H)',
  imeiNo: '350644270286694',
  vehicleNumber: 'MH12PQ5657',
  nextDue: new Date('2026-08-13T00:00:00.000Z'),
  renewalDate: null,
  confirmedAt: null
};

test('GPS SMS uses the customer mobile and only expired unconfirmed records', () => {
  assert.equal(mobileFromContact(record.contactNo), '9049456804');
  assert.equal(mobileFromContact('Not provided'), '');
  assert.equal(mobileFromContact('+91 9876543210'), '9876543210');
  assert.equal(eligibleForExpiredSms(record, '2026-10-24'), true);
  assert.equal(eligibleForExpiredSms({ ...record, nextDue: new Date('2026-10-24T00:00:00Z') }, '2026-10-24'), false);
  assert.equal(eligibleForExpiredSms({ ...record, renewalDate: new Date() }, '2026-10-24'), false);
  assert.equal(eligibleForExpiredSms({ ...record, confirmedAt: new Date() }, '2026-10-24'), false);
});

test('GPS SMS substitutes the phone and message fields without changing the template ID', () => {
  const url = new URL(renewalSmsUrl('https://provider.example/send?number=0000000000&sms=Hello+%7Bname%7D%2C+%7Bvehicle%7D+expired+%7Bexpiry_date%7D&templateid=123', record));
  assert.equal(url.searchParams.get('number'), '9049456804');
  assert.equal(url.searchParams.get('sms'), 'Hello Om sai sales, MH12PQ5657 expired 2026-08-13');
  assert.equal(url.searchParams.get('templateid'), '123');
});

test('GPS SMS treats a provider rejection as failed', async () => {
  const template = 'https://provider.example/send?number={phone}&sms=Reminder';
  await assert.rejects(sendGpsRenewalSms(template, record, async () => ({ ok: true, status: 200, text: async () => 'Unauthorized' })), /rejected/);
  await assert.rejects(sendGpsRenewalSms(template, record, async () => ({ ok: false, status: 403 })), /HTTP 403/);
  await sendGpsRenewalSms(template, record, async () => ({ ok: true, status: 200, text: async () => '{"success":true}' }));
});
