const { webhookUrlForPhone } = require('./savedWebhookNotifications');

function mobileFromContact(contact) {
  const value = String(contact || '');
  const matches = [...value.matchAll(/(?:^|\D)(?:(?:\+?91|0)[\s-]*)?([6-9]\d{9})(?!\d)/g)];
  const preferred = matches.find(match => /^\s*\(C\)/i.test(value.slice(match.index + match[0].length)));
  return (preferred || matches[0])?.[1] || '';
}

function eligibleForExpiredSms(record, today) {
  const expiry = record.nextDue instanceof Date ? record.nextDue.toISOString().slice(0, 10) : String(record.nextDue || '').slice(0, 10);
  return expiry < today && !record.confirmedAt && !record.renewalDate && Boolean(mobileFromContact(record.contactNo));
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

module.exports = { mobileFromContact, eligibleForExpiredSms, renewalSmsUrl, sendGpsRenewalSms };
