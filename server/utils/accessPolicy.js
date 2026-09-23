function isGroupMember(group, userId) {
  return Boolean(group && (group.createdBy === userId || (Array.isArray(group.members) && group.members.includes(userId))));
}

function groupAccessWhere(userId) {
  return { OR: [{ createdBy: userId }, { members: { array_contains: [userId] } }] };
}

function isAllowedOrigin(origin, allowedOrigins, production) {
  if (!origin || allowedOrigins.includes(origin)) return true;
  if (production) return false;
  try {
    const url = new URL(origin);
    const octets = url.hostname.split('.');
    const ipv4 = octets.length === 4 && octets.every(value => /^\d{1,3}$/.test(value) && Number(value) <= 255);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || (ipv4 && (octets[0] === '10' || (octets[0] === '192' && octets[1] === '168')));
    return local && ['http:', 'https:', 'exp:'].includes(url.protocol);
  } catch { return false; }
}

module.exports = { isGroupMember, groupAccessWhere, isAllowedOrigin };
