const jwt = require('jsonwebtoken');
const { prisma } = require('../config/prisma');
require('../config/env');

const authMiddleware = async (req, res, next) => {
  const bearerToken = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  const cookieToken = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('sm_session='))?.slice('sm_session='.length);
  const token = bearerToken || cookieToken || null;
  if (!token) return res.status(401).json({ message: 'Authorization denied. No token provided.' });
  if (!process.env.JWT_SECRET) return res.status(500).json({ message: 'Server authentication is not configured.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: Number(decoded.id) },
      select: { id: true, name: true, email: true, role: true, tokenVersion: true }
    });
    if (!user || Number(decoded.tokenVersion || 0) !== Number(user.tokenVersion || 0)) {
      return res.status(401).json({ message: 'Session has been revoked.' });
    }
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion
    };
    return next();
  } catch {
    return res.status(401).json({ message: 'Token is invalid or expired.' });
  }
};

const checkRole = (allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized.' });
  if (req.user.role === 'super_admin' || allowedRoles.includes(req.user.role)) return next();
  return res.status(403).json({ message: 'Access forbidden. Insufficient permissions.' });
};

module.exports = { authMiddleware, checkRole };
