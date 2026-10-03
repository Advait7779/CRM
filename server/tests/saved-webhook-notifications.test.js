const test = require('node:test');
const assert = require('node:assert/strict');
const {
  WEBHOOK_SETTING_KEYS, NEW_LEAD_SMS_SETTING_KEY, JUSTDIAL_WEBHOOK_SETTING_KEYS, ALL_WEBHOOK_SETTING_KEYS,
  webhookUrlForPhone, sendSavedWebhookNotifications, sendNewLeadSmsNotification, sendJustdialWebhookNotifications
} = require('../services/savedWebhookNotifications');

test('saved notification URLs replace number or phone and otherwise append phone', () => {
  assert.equal(
    webhookUrlForPhone('https://provider.example/send?key=abc&number=9876543210&template=welcome', '+91 90000 00000'),
    'https://provider.example/send?key=abc&number=919000000000&template=welcome'
  );
  assert.equal(
    webhookUrlForPhone('https://provider.example/voice?phone=0000000000', '90000-00000'),
    'https://provider.example/voice?phone=9000000000'
  );
  assert.equal(
    webhookUrlForPhone('https://provider.example/rcs?key=abc', '9000000000'),
    'https://provider.example/rcs?key=abc&phone=9000000000'
  );
  assert.equal(
    webhookUrlForPhone('https://provider.example/rcs?number={phone}', '9000000000'),
    'https://provider.example/rcs?number=9000000000'
  );
  assert.throws(() => webhookUrlForPhone('file:///tmp/test', '9000000000'), /HTTP or HTTPS/);
});

test('all four configured channels receive one request with the recipient number', async () => {
  const requested = [];
  const settings = Object.fromEntries(WEBHOOK_SETTING_KEYS.map((key) => [key, `https://provider.example/${key}?key=test&phone=0000000000`]));
  const prisma = {
    appSettings: {
      async findMany({ where }) {
        assert.deepEqual(where.key.in, WEBHOOK_SETTING_KEYS);
        return Object.entries(settings).map(([key, value]) => ({ key, value }));
      }
    }
  };
  const fetchImpl = async (url, options) => {
    requested.push({ url, options });
    return { ok: true, status: 200 };
  };
  const result = await sendSavedWebhookNotifications(prisma, '9876543210', fetchImpl);
  assert.equal(result.length, 4);
  assert.equal(requested.length, 4);
  assert.ok(requested.every(({ url, options }) => url.includes('phone=9876543210') && options.method === 'GET'));
});

test('new CRM leads use only the separate new lead SMS URL', async () => {
  const requested = [];
  const prisma = { appSettings: { async findMany({ where }) {
    assert.equal(where.key, NEW_LEAD_SMS_SETTING_KEY);
    return [{ key: NEW_LEAD_SMS_SETTING_KEY, value: 'https://provider.example/new-lead?number=0000000000' }];
  } } };
  const result = await sendNewLeadSmsNotification(prisma, '9876543210', async url => {
    requested.push(url);
    return { ok: true, status: 200 };
  });
  assert.equal(result.length, 1);
  assert.deepEqual(requested, ['https://provider.example/new-lead?number=9876543210']);
});

test('Justdial sends the four URLs for the matching product group only', async () => {
  assert.equal(ALL_WEBHOOK_SETTING_KEYS.length, 17);
  assert.equal(JUSTDIAL_WEBHOOK_SETTING_KEYS.length, 12);
  const requested = [];
  const prisma = { appSettings: { async findMany({ where }) {
    return where.key.in.map(key => ({ key, value: `https://provider.example/${key}?number=0000000000` }));
  } } };
  const fetchImpl = async url => { requested.push(url); return { ok: true, status: 200 }; };
  const cctv = await sendJustdialWebhookNotifications(prisma, { justdialProduct: 'CCTV' }, { mobile: '9876543210' }, fetchImpl);
  assert.equal(cctv.length, 4);
  assert.ok(cctv.every(item => item.key.startsWith('justdial_cctv_')));
  assert.ok(requested.every(url => url.includes('number=9876543210') && url.includes('justdial_cctv_')));
  requested.length = 0;
  const digital = await sendJustdialWebhookNotifications(prisma, { justdialProduct: 'Website Development' }, { mobile: '9000000000' }, fetchImpl);
  assert.equal(digital.length, 4);
  assert.ok(requested.every(url => url.includes('justdial_digital_')));
});

test('Justdial respects DNC flags and does not send messages to landlines', async () => {
  const requested = [];
  const prisma = { appSettings: { async findMany({ where }) {
    return where.key.in.map(key => ({ key, value: `https://provider.example/${key}?phone={phone}` }));
  } } };
  const fetchImpl = async url => { requested.push(url); return { ok: true, status: 200 }; };
  const lead = { justdialProduct: 'GPS & Fuel Sensor' };
  await sendJustdialWebhookNotifications(prisma, lead, { mobile: '9876543210', dncmobile: '1', phone: '02224100086', dncphone: '0' }, fetchImpl);
  assert.equal(requested.length, 1);
  assert.match(requested[0], /justdial_gps_fuel_voice_webhook_url/);
  assert.match(requested[0], /phone=02224100086/);
  requested.length = 0;
  await sendJustdialWebhookNotifications(prisma, lead, { mobile: '9876543210', dncmobile: '1', phone: '02224100086', dncphone: '1' }, fetchImpl);
  assert.equal(requested.length, 0);
  await sendJustdialWebhookNotifications(prisma, { justdialProduct: 'Unclassified' }, { mobile: '9876543210' }, fetchImpl);
  assert.equal(requested.length, 0);
});
