const { webhookUrlForPhone } = require('./savedWebhookNotifications');
const { dateOnly } = require('./gpsRenewals');

const EXCLUDED_NUMBERS = new Set(['8282982829']);

function mobileFromContact(contact) {
  const value = String(contact || '');
  const matches = [...value.matchAll(/(?:^|\D)(?:(?:\+?91|0)[\s-]*)?([6-9]\d{9})(?!\d)\s*(?:\(([A-Za-z])\))?/g)]
    .map(match => ({ phone: match[1], label: match[2]?.toUpperCase() || '' }))
    .filter(match => !EXCLUDED_NUMBERS.has(match.phone) && match.label !== 'H');
  return (matches.find(match => match.label === 'C') || matches[0])?.phone || '';
}

function eligibleForExpiredSms(record, today) {
  const expiry = record.nextDue instanceof Date ? record.nextDue.toISOString().slice(0, 10) : String(record.nextDue || '').slice(0, 10);
  return expiry < today && !record.confirmedAt && !record.renewalDate && Boolean(mobileFromContact(record.contactNo));
}

function renewalSmsKey(record) {
  const vehicle = String(record.vehicleNumber || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const imei = String(record.imeiNo || '').trim().toUpperCase();
  return `${vehicle || `IMEI:${imei}`}|${dateOnly(record.nextDue)}`;
}

function smsRecipientsForFilter(records, filter, now = new Date()) {
  const from = filter.mode === 'range' ? filter.from : null;
  const to = filter.mode === 'range' ? filter.to : null;
  const groups = new Map();
  for (const record of records) {
    const due = dateOnly(record.nextDue);
    if (!due || (from && due < from) || (to && due > to)) continue;
    const key = renewalSmsKey(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  const recipients = [];
  const summary = { matchedVehicles: groups.size, duplicates: 0, alreadySent: 0, pending: 0, confirmed: 0, missingMobile: 0 };
  for (const group of groups.values()) {
    summary.duplicates += group.length - 1;
    if (group.some(record => record.expiredSmsStatus === 'sent')) { summary.alreadySent += 1; continue; }
    if (group.some(record => record.expiredSmsStatus === 'pending'
      && (!record.expiredSmsClaimedAt || now - new Date(record.expiredSmsClaimedAt) < 60 * 60 * 1000))) {
      summary.pending += 1; continue;
    }
    const available = group.filter(record => !record.confirmedAt && !record.renewalDate);
    if (!available.length) { summary.confirmed += 1; continue; }
    const record = available.sort((a, b) => a.id - b.id).find(row => mobileFromContact(row.contactNo));
    if (!record) { summary.missingMobile += 1; continue; }
    recipients.push(record);
  }
  return { recipients, summary };
}

function renewalSmsUrl(template, record) {
  const phone = mobileFromContact(record.contactNo);
  if (!phone) throw new Error('A valid mobile number is required.');
  const url = new URL(webhookUrlForPhone(template, phone));
  const replacements = {
    name: String(record.customer || ''),
    imei: String(record.imeiNo || ''),
    vehicle: String(record.vehicleNumber || ''),
    expiry_date: record.nextDue instanceof Date ? record.nextDue.toISOString().slice(0, 10) : String(record.nextDue || '').slice(0, 10)
  };
  for (const key of ['sms', 'message', 'msg']) {
    if (!url.searchParams.has(key)) continue;
    const message = url.searchParams.get(key).replace(/\{(name|imei|vehicle|expiry_date)\}|\[alp\]/gi, (match, token) =>
      replacements[(token || 'name').toLowerCase()] ?? match
    );
    url.searchParams.set(key, message);
  }
  return url.toString();
}

async function sendGpsRenewalSms(template, record, fetchImpl = fetch) {
  const url = renewalSmsUrl(template, record);
  const response = await fetchImpl(url, { method: 'GET', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
  const body = await response.text();
  if (/^\s*unauthorized\s*$/i.test(body)) throw new Error('Provider rejected the SMS request.');
  try {
    const data = JSON.parse(body);
    if (data.success === false || /^(error|failed|unauthorized)$/i.test(String(data.status || ''))) {
      throw new Error('Provider rejected the SMS request.');
    }
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }
}

module.exports = { mobileFromContact, eligibleForExpiredSms, renewalSmsKey, smsRecipientsForFilter, renewalSmsUrl, sendGpsRenewalSms };
