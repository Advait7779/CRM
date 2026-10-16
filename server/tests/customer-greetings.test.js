const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGreeting, deliverGreeting, validDateOnly } = require('../services/customerGreetings');

const customer = {
  id: 7,
  name: 'Example Company',
  contact: 'Asha',
  phone: '9876543210',
  birthday: new Date('1990-10-16T00:00:00.000Z'),
  anniversary: new Date('2018-11-20T00:00:00.000Z')
};

test('greeting preview renders the recipient and message without exposing provider credentials', () => {
  const settings = {
    greeting_birthday_sms_webhook_url: 'https://provider.example/api/sms?key=private123&number={phone}&templateid=T9&sms=Happy%20Birthday%20%5Balp%5D'
  };
  const { url, preview } = buildGreeting(customer, settings, 'birthday', 'sms');
  assert.match(url, /key=private123/);
  assert.match(url, /number=9876543210/);
  assert.match(preview.message, /Happy Birthday Asha/);
  assert.equal(preview.templateId, 'T9');
  assert.doesNotMatch(preview.url, /private123/);
  assert.match(preview.url, /key=REDACTED/);
});

test('voice greeting requires a human-readable script description', () => {
  const settings = { greeting_anniversary_voice_webhook_url: 'https://provider.example/call?phone={phone}&templateid=V8' };
  assert.throws(() => buildGreeting(customer, settings, 'anniversary', 'voice'), /preview in Settings/);
  settings.greeting_anniversary_voice_preview_text = 'Congratulations, {name}!';
  const { preview } = buildGreeting(customer, settings, 'anniversary', 'voice');
  assert.equal(preview.message, 'Congratulations, Asha!');
  assert.equal(preview.templateId, 'V8');
});

test('invalid dates and missing occasion dates cannot be sent', () => {
  assert.equal(validDateOnly('2026-02-29'), false);
  assert.equal(validDateOnly('2024-02-29'), true);
  assert.throws(() => buildGreeting({ ...customer, birthday: null }, {}, 'birthday', 'sms'), /Add the customer's birthday/);
});

test('delivery reports provider rejection and never calls a real provider', async () => {
  const calls = [];
  const failed = await deliverGreeting('https://provider.example/send', async url => {
    calls.push(url);
    return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'error' }) };
  });
  assert.equal(calls.length, 1);
  assert.equal(failed.ok, false);
  const accepted = await deliverGreeting('https://provider.example/send', async () => ({ ok: true, status: 200, text: async () => 'queued' }));
  assert.equal(accepted.ok, true);
});
