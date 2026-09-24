const crypto = require('node:crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { prepareData } = require('../utils/prismaData');

// Field names and limits come from Justdial's API integration document.
const FIELD_LIMITS = Object.freeze({
  leadid: 255, leadtype: 255, prefix: 10, name: 255, mobile: 50,
  phone: 50, email: 255, date: 20, category: 255, city: 255,
  area: 255, brancharea: 255, dncmobile: 1, dncphone: 1,
  company: 255, pincode: 50, time: 20, branchpin: 50, parentid: 255
});

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeJustdialPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('Invalid Justdial enquiry.');
  }
  const payload = {};
  for (const [field, maxLength] of Object.entries(FIELD_LIMITS)) {
    const value = input[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw badRequest(`Invalid ${field}.`);
    }
    const text = String(value).trim();
    if (text.length > maxLength) throw badRequest(`${field} is too long.`);
    payload[field] = text;
  }
  if (!payload.leadid) throw badRequest('leadid is required.');
  if (!payload.mobile && !payload.phone) throw badRequest('mobile or phone is required.');
  return payload;
}

function tokenMatches(provided, configured) {
  if (!configured || configured.length < 32 || !provided) return false;
  const expected = crypto.createHash('sha256').update(configured).digest();
  const actual = crypto.createHash('sha256').update(provided).digest();
  return crypto.timingSafeEqual(expected, actual);
}

function toLeadData(payload) {
  const location = [payload.area, payload.city, payload.pincode].filter(Boolean).join(', ');
  const leadDate = [payload.date, payload.time].filter(Boolean).join(' ');
  const notes = [
    `Justdial enquiry ID: ${payload.leadid}`,
    leadDate && `Enquiry date: ${leadDate}`,
    location && `Location: ${location}`,
    payload.brancharea && `Branch area: ${payload.brancharea}`,
    payload.parentid && `Contract ID: ${payload.parentid}`,
    payload.dncmobile === '1' && 'Mobile marked DND by Justdial',
    payload.dncphone === '1' && 'Landline marked DND by Justdial'
  ].filter(Boolean).join('\n');
  return prepareData('leads', {
    name: payload.name || payload.company || 'Justdial caller',
    phone: payload.mobile || payload.phone,
    email: payload.email || null,
    company: payload.company || null,
    source: 'Justdial',
    service: payload.category || payload.leadtype || 'Unspecified',
    status: 'New',
    notes,
    justdialLeadId: payload.leadid,
    justdialPayload: payload
  }, { create: true });
}

function createJustdialRouter(prisma, getToken = () => process.env.JUSTDIAL_WEBHOOK_TOKEN) {
  const router = express.Router();
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  });

  const receive = async (req, res, next) => {
    const configured = getToken();
    if (!configured || configured.length < 32) {
      return res.status(503).type('text/plain').send('Integration is not configured');
    }
    if (!tokenMatches(req.params.token, configured)) {
      return res.status(404).type('text/plain').send('Not found');
    }
    try {
      const payload = normalizeJustdialPayload(req.method === 'GET' ? req.query : req.body);
      const data = toLeadData(payload);
      let lead;
      try {
        lead = await prisma.leads.create({ data, select: { id: true, name: true, service: true } });
      } catch (error) {
        if (error.code !== 'P2002') throw error;
        const existing = await prisma.leads.findUnique({
          where: { justdialLeadId: payload.leadid }, select: { id: true }
        });
        if (!existing) throw error;
        return res.status(200).type('text/plain').send('RECEIVED');
      }
      // Acknowledgement must not depend on the optional staff notification.
      res.status(200).type('text/plain').send('RECEIVED');
      try {
        const users = await prisma.users.findMany({
          where: { role: { in: ['super_admin', 'director', 'sales_manager'] } },
          select: { id: true }
        });
        if (users.length) {
          await prisma.notifications.createMany({
            data: users.map((user) => prepareData('notifications', {
              userId: user.id,
              type: 'lead',
              title: 'New Justdial enquiry',
              message: `${lead.name}: ${lead.service}`,
              link: '/leads'
            }, { create: true }))
          });
        }
      } catch (error) {
        console.error('Justdial lead notification failed:', error.message);
      }
    } catch (error) {
      next(error);
    }
  };

  router.get('/:token', limiter, receive);
  router.post('/:token', limiter, receive);
  return router;
}

module.exports = { createJustdialRouter, normalizeJustdialPayload, toLeadData };
