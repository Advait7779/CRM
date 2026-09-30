const JUSTDIAL_PRODUCTS = Object.freeze({
  CCTV: 'CCTV',
  GPS_FUEL: 'GPS & Fuel Sensor',
  SMS: 'SMS',
  WABA: 'WhatsApp WABA',
  RCS: 'RCS',
  VOICE: 'Voice Call',
  WEBSITE: 'Website Development',
  SOFTWARE: 'Software Development',
  DIGITAL_MARKETING: 'Digital Marketing',
  UNCLASSIFIED: 'Unclassified'
});

const ASSIGNABLE_PRODUCTS = Object.values(JUSTDIAL_PRODUCTS).filter(value => value !== JUSTDIAL_PRODUCTS.UNCLASSIFIED);
const ADMIN_ROLES = new Set(['super_admin', 'director']);

const categoryRules = [
  [JUSTDIAL_PRODUCTS.CCTV, /\b(cctv|closed circuit|surveillance camera|security camera|ip camera)\b/i],
  [JUSTDIAL_PRODUCTS.GPS_FUEL, /\b(gps|vehicle track(?:ing|er)?|fleet track(?:ing|er)?|fuel sens(?:or|ing)|fuel monitor(?:ing)?|telematics)\b/i],
  [JUSTDIAL_PRODUCTS.SMS, /\b(sms|text messag(?:e|ing))\b/i],
  [JUSTDIAL_PRODUCTS.WABA, /\b(whatsapp|waba)\b/i],
  [JUSTDIAL_PRODUCTS.RCS, /\brcs\b/i],
  [JUSTDIAL_PRODUCTS.VOICE, /\b(voice call|voice sms|ivr|automated call)\b/i],
  [JUSTDIAL_PRODUCTS.WEBSITE, /\b(website|web design|web develop(?:ment|er|ers)?)\b/i],
  [JUSTDIAL_PRODUCTS.SOFTWARE, /\b(software|app develop(?:ment|er|ers)?|application develop(?:ment|er|ers)?)\b/i],
  [JUSTDIAL_PRODUCTS.DIGITAL_MARKETING, /\b(digital marketing|seo|search engine optimization)\b/i]
];

function classifyJustdialCategory(category) {
  const value = String(category || '').trim();
  if (!value) return JUSTDIAL_PRODUCTS.UNCLASSIFIED;
  const matches = categoryRules.filter(([, pattern]) => pattern.test(value));
  return matches.length === 1 ? matches[0][0] : JUSTDIAL_PRODUCTS.UNCLASSIFIED;
}

function notificationGroupForProduct(product) {
  if (product === JUSTDIAL_PRODUCTS.CCTV) return 'cctv';
  if (product === JUSTDIAL_PRODUCTS.GPS_FUEL) return 'gps_fuel';
  if (ASSIGNABLE_PRODUCTS.includes(product)) return 'digital';
  return null;
}

function validProductSelection(value) {
  return Array.isArray(value) && value.every(item => ASSIGNABLE_PRODUCTS.includes(item)) && new Set(value).size === value.length;
}

function userProducts(user) {
  return Array.isArray(user?.justdialProducts) ? user.justdialProducts.filter(value => ASSIGNABLE_PRODUCTS.includes(value)) : [];
}

function leadAccessWhere(user) {
  if (ADMIN_ROLES.has(user.role)) return {};
  return { OR: [
    { source: null },
    { source: { not: 'Justdial' } },
    { source: 'Justdial', justdialProduct: { in: userProducts(user) } }
  ] };
}

function canAccessLead(user, lead) {
  return ADMIN_ROLES.has(user.role) || lead.source !== 'Justdial' || userProducts(user).includes(lead.justdialProduct);
}

module.exports = {
  JUSTDIAL_PRODUCTS, ASSIGNABLE_PRODUCTS, ADMIN_ROLES, classifyJustdialCategory, notificationGroupForProduct,
  validProductSelection, userProducts, leadAccessWhere, canAccessLead
};
