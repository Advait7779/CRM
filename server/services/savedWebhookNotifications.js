const { notificationGroupForProduct } = require('./justdialProducts');

const WEBHOOK_SETTING_KEYS = [
  'sms_webhook_url',
  'whatsapp_webhook_url',
  'rcs_webhook_url',
  'voice_call_webhook_url'
];
const JUSTDIAL_GROUPS = ['cctv', 'gps_fuel', 'digital'];
const JUSTDIAL_CHANNELS = ['sms', 'rcs', 'voice', 'whatsapp'];
const JUSTDIAL_WEBHOOK_SETTING_KEYS = JUSTDIAL_GROUPS.flatMap(group =>
  JUSTDIAL_CHANNELS.map(channel => `justdial_${group}_${channel}_webhook_url`)
);
const ALL_WEBHOOK_SETTING_KEYS = [...WEBHOOK_SETTING_KEYS, ...JUSTDIAL_WEBHOOK_SETTING_KEYS];

function webhookUrlForPhone(template, phone) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) throw new Error('A recipient phone number is required.');
  const original = String(template || '').trim();
  const parsed = new URL(original);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Webhook URL must use HTTP or HTTPS.');

  if (original.includes('{phone}')) {
    return original.replaceAll('{phone}', encodeURIComponent(digits));
  }
  if (/[?&](?:number|phone)=/i.test(original)) {
    return original.replace(/([?&](?:number|phone)=)[^&#]*/gi, (_, prefix) => `${prefix}${encodeURIComponent(digits)}`);
  }
  const hashIndex = original.indexOf('#');
  const base = hashIndex < 0 ? original : original.slice(0, hashIndex);
  const hash = hashIndex < 0 ? '' : original.slice(hashIndex);
  return `${base}${base.includes('?') ? '&' : '?'}phone=${encodeURIComponent(digits)}${hash}`;
}

async function sendConfiguredUrls(rows, recipientForKey, fetchImpl) {
  return Promise.all(rows.filter(row => row.value?.trim()).map(async row => {
    const phone = recipientForKey(row.key);
    if (!phone) return { key: row.key, skipped: true };
    try {
      const url = webhookUrlForPhone(row.value, phone);
      const response = await fetchImpl(url, { method: 'GET', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      console.log(`[Webhook] ${row.key}: HTTP ${response.status}`);
      return { key: row.key, status: response.status, ok: true };
    } catch (error) {
      console.error(`[Webhook] ${row.key} failed:`, error.message);
      return { key: row.key, ok: false, error: error.message };
    }
  }));
}

async function sendSavedWebhookNotifications(prisma, phone, fetchImpl = fetch) {
  if (!String(phone || '').replace(/[^0-9]/g, '')) return [];
  const rows = await prisma.appSettings.findMany({ where: { key: { in: WEBHOOK_SETTING_KEYS } } });
  return sendConfiguredUrls(rows, () => phone, fetchImpl);
}

async function sendJustdialWebhookNotifications(prisma, lead, payload, fetchImpl = fetch) {
  const group = notificationGroupForProduct(lead.justdialProduct);
  if (!group) return [];
  const mobile = payload.mobile && payload.dncmobile !== '1' ? payload.mobile : null;
  const landline = payload.phone && payload.dncphone !== '1' ? payload.phone : null;
  if (!mobile && !landline) return [];
  const keys = JUSTDIAL_CHANNELS.map(channel => `justdial_${group}_${channel}_webhook_url`);
  const rows = await prisma.appSettings.findMany({ where: { key: { in: keys } } });
  return sendConfiguredUrls(rows, key => key.includes('_voice_') ? (mobile || landline) : mobile, fetchImpl);
}

module.exports = {
  WEBHOOK_SETTING_KEYS, JUSTDIAL_WEBHOOK_SETTING_KEYS, ALL_WEBHOOK_SETTING_KEYS,
  webhookUrlForPhone, sendSavedWebhookNotifications, sendJustdialWebhookNotifications
};
