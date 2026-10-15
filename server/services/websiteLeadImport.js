const { prepareData } = require('../utils/prismaData');
const { classifyJustdialCategory, canAccessLead } = require('./justdialProducts');

function normalizeWebsiteLead(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid website lead.');
  const text = (key, limit) => {
    const value = input[key];
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`Invalid ${key}.`);
    const result = String(value).trim();
    if (result.length > limit) throw new Error(`${key} is too long.`);
    return result || null;
  };
  const leadId = text('leadId', 255);
  const name = text('name', 255);
  const phone = text('phone', 255);
  const email = text('email', 255);
  const service = text('service', 255);
  const formSource = text('formSource', 150);
  const message = text('message', 2000);
  const submittedAt = text('submittedAt', 40);
  if (!leadId || !name || !phone || !service) throw new Error('leadId, name, phone, and service are required.');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Invalid email.');
  const date = submittedAt ? new Date(submittedAt) : null;
  if (submittedAt && (!/^\d{4}-\d{2}-\d{2}T/.test(submittedAt) || Number.isNaN(date.getTime()))) {
    throw new Error('Invalid submittedAt.');
  }
  return { leadId, name, phone, email, service, formSource, message, submittedAt: date };
}

function toLeadData(payload) {
  return prepareData('leads', {
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    source: 'Website',
    service: payload.service,
    justdialProduct: classifyJustdialCategory(payload.service),
    status: 'New',
    notes: [payload.formSource && `Website form: ${payload.formSource}`, payload.message].filter(Boolean).join('\n') || null,
    websiteLeadId: payload.leadId,
    websiteFormSource: payload.formSource,
    websiteSubmittedAt: payload.submittedAt
  }, { create: true });
}

async function importWebsiteLead(prisma, input) {
  const payload = normalizeWebsiteLead(input);
  let lead;
  try {
    lead = await prisma.leads.create({
      data: toLeadData(payload),
      select: { id: true, name: true, service: true, justdialProduct: true, exec: true }
    });
  } catch (error) {
    if (error.code !== 'P2002') throw error;
    const existing = await prisma.leads.findUnique({ where: { websiteLeadId: payload.leadId }, select: { id: true } });
    if (!existing) throw error;
    return { imported: false, duplicate: true };
  }

  try {
    const users = await prisma.users.findMany({
      where: { role: { in: ['super_admin', 'director', 'sales_manager', 'sales_executive'] } },
      select: { id: true, role: true, justdialProducts: true }
    });
    const recipients = users.filter(user => canAccessLead(user, lead));
    if (recipients.length) {
      await prisma.notifications.createMany({
        data: recipients.map(user => prepareData('notifications', {
          userId: user.id,
          type: 'lead',
          title: 'New website enquiry',
          message: `${lead.name}: ${lead.service}`,
          link: '/leads',
          dedupeKey: `website:${lead.id}:${user.id}`
        }, { create: true }))
      });
    }
  } catch (error) {
    console.error('Website lead notification failed:', error.message);
  }
  return { imported: true, duplicate: false };
}

module.exports = { importWebsiteLead, normalizeWebsiteLead, toLeadData };
