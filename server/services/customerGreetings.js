const { webhookUrlForPhone, webhookUrlForName } = require('./savedWebhookNotifications');

const OCCASIONS = ['birthday', 'anniversary'];
const CHANNELS = ['sms', 'voice'];

function greetingError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validDateOnly(value) {
  if (value == null || value === '') return true;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function maskedUrl(url) {
  const parsed = new URL(url);
  const safe = new URL(parsed.origin);
  const visiblePathParts = new Set(['api', 'v1', 'v2', 'sms', 'smsapi', 'voice', 'call', 'send', 'webhook']);
  safe.pathname = parsed.pathname.split('/').map(part => !part || visiblePathParts.has(part.toLowerCase()) ? part : 'REDACTED').join('/');
  const visible = new Set(['phone', 'number', 'route', 'sender', 'templateid', 'template_id', 'tid', 'sms', 'message', 'msg']);
  for (const [key, value] of parsed.searchParams) {
    safe.searchParams.append(key, visible.has(key.toLowerCase()) ? value : 'REDACTED');
  }
  return safe.toString();
}

function buildGreeting(customer, settings, occasion, channel) {
  if (!OCCASIONS.includes(occasion) || !CHANNELS.includes(channel)) throw greetingError('Choose a valid greeting and channel.');
  if (!customer) throw greetingError('Customer not found.', 404);
  if (!customer[occasion]) throw greetingError(`Add the customer's ${occasion} date before sending.`);
  const phone = String(customer.phone || '').replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 15) throw greetingError('The customer needs a valid phone number.');
  const key = `greeting_${occasion}_${channel}`;
  const template = String(settings[`${key}_webhook_url`] || '').trim();
  if (!template) throw greetingError(`The ${occasion} ${channel} URL is not configured in Settings.`);
  let url;
  try {
    url = webhookUrlForName(webhookUrlForPhone(template, phone), customer.contact || customer.name);
  } catch {
    throw greetingError('The greeting URL in Settings is invalid.');
  }
  const parsed = new URL(url);
  const providerMessage = parsed.searchParams.get('sms') || parsed.searchParams.get('message') || parsed.searchParams.get('msg') || '';
  const text = channel === 'sms' ? (providerMessage || settings[`${key}_preview_text`]) : settings[`${key}_preview_text`];
  if (!String(text || '').trim()) throw greetingError('Add a message or voice script preview in Settings before sending.');
  const name = customer.contact || customer.name;
  const previewText = String(text).replace(/\[alp\]|\{name\}/gi, name);
  const templateId = parsed.searchParams.get('templateid') || parsed.searchParams.get('template_id') || parsed.searchParams.get('tid') || '';
  const date = customer[occasion] instanceof Date ? customer[occasion].toISOString().slice(0, 10) : String(customer[occasion]).slice(0, 10);
  return {
    url,
    preview: {
      customerId: customer.id,
      customerName: customer.name,
      contactName: customer.contact || '',
      phone,
      occasion,
      channel,
      date,
      isToday: date.slice(5) === require('../utils/prismaData').currentDateOnly().slice(5),
      message: previewText,
      templateId,
      url: maskedUrl(url)
    }
  };
}

async function deliverGreeting(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { method: 'GET', signal: AbortSignal.timeout(15000) });
  if (!response.ok) return { ok: false, providerStatus: response.status, error: `Provider returned HTTP ${response.status}.` };
  const body = await response.text();
  try {
    const data = JSON.parse(body);
    if (data.success === false || String(data.status || '').toLowerCase() === 'error') {
      return { ok: false, providerStatus: response.status, error: 'Provider reported an error. Check its credentials and template.' };
    }
  } catch { /* Providers may return plain text. */ }
  return { ok: true, providerStatus: response.status };
}

module.exports = { OCCASIONS, CHANNELS, validDateOnly, buildGreeting, deliverGreeting };
