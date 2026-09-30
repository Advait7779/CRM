const test = require('node:test');
const assert = require('node:assert/strict');
const {
  JUSTDIAL_PRODUCTS, classifyJustdialCategory, validProductSelection,
  leadAccessWhere, canAccessLead
} = require('../services/justdialProducts');

test('Justdial categories map only when one product is clear', () => {
  assert.equal(classifyJustdialCategory('Cctv Repair & Services'), JUSTDIAL_PRODUCTS.CCTV);
  assert.equal(classifyJustdialCategory('GPS Tracking'), JUSTDIAL_PRODUCTS.GPS_FUEL);
  assert.equal(classifyJustdialCategory('Fuel Sensor Dealers'), JUSTDIAL_PRODUCTS.GPS_FUEL);
  assert.equal(classifyJustdialCategory('Computer Software Developers'), JUSTDIAL_PRODUCTS.SOFTWARE);
  assert.equal(classifyJustdialCategory('WhatsApp WABA API'), JUSTDIAL_PRODUCTS.WABA);
  assert.equal(classifyJustdialCategory('SMS and RCS'), JUSTDIAL_PRODUCTS.UNCLASSIFIED);
  assert.equal(classifyJustdialCategory('Generator Dealer'), JUSTDIAL_PRODUCTS.UNCLASSIFIED);
});

test('Justdial product assignments limit leads while other sources remain visible', () => {
  const cctv = { role: 'sales_executive', justdialProducts: ['CCTV'] };
  const gps = { role: 'sales_executive', justdialProducts: ['GPS & Fuel Sensor'] };
  assert.equal(canAccessLead(cctv, { source: 'Justdial', justdialProduct: 'CCTV' }), true);
  assert.equal(canAccessLead(cctv, { source: 'Justdial', justdialProduct: 'GPS & Fuel Sensor' }), false);
  assert.equal(canAccessLead(gps, { source: 'Justdial', justdialProduct: 'GPS & Fuel Sensor' }), true);
  assert.equal(canAccessLead(gps, { source: 'Justdial', justdialProduct: 'Unclassified' }), false);
  assert.equal(canAccessLead(gps, { source: 'WhatsApp', justdialProduct: null }), true);
  assert.equal(canAccessLead({ role: 'director' }, { source: 'Justdial', justdialProduct: 'Unclassified' }), true);
  assert.deepEqual(leadAccessWhere(cctv).OR[2], { source: 'Justdial', justdialProduct: { in: ['CCTV'] } });
  assert.deepEqual(leadAccessWhere({ role: 'super_admin' }), {});
  assert.equal(validProductSelection(['CCTV', 'GPS & Fuel Sensor']), true);
  assert.equal(validProductSelection(['CCTV', 'CCTV']), false);
  assert.equal(validProductSelection(['Unclassified']), false);
});
