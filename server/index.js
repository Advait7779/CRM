const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { authMiddleware } = require('./middleware/auth');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const http = require('http');
require('./config/env');

const { connectDB, prisma } = require('./config/prisma');
const { jsonReplacer } = require('./utils/prismaData');
const apiRouter = require('./routes/api');
const { createJustdialRouter } = require('./routes/justdial');
const { startScheduler } = require('./services/scheduler');
const { isAllowedOrigin } = require('./utils/accessPolicy');

const app = express();
const server = http.createServer(app);
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.set('json replacer', jsonReplacer);
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:5174', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin, allowedOrigins, isProduction)) {
      return callback(null, true);
    }
    const error = new Error('Origin is not allowed by CORS.');
    error.status = 403;
    return callback(error);
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use(compression());
app.use(morgan(isProduction ? 'combined' : 'dev', {
  // GET enquiries contain personal data and the endpoint path contains its secret.
  skip: (req) => req.originalUrl.startsWith('/api/integrations/justdial/')
}));
app.use('/api/integrations/justdial', createJustdialRouter(prisma));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', authLimiter);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  keyGenerator: req => req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip),
  message: { message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', (req, res, next) => {
  const publicAuthRoute = ['/auth/login', '/auth/seed'].includes(req.path);
  const hasSession = req.headers.authorization || /(?:^|;\s*)sm_session=/.test(req.headers.cookie || '');
  if (!publicAuthRoute && hasSession) {
    return authMiddleware(req, res, () => apiLimiter(req, res, next));
  }
  return apiLimiter(req, res, next);
});

app.use('/api', apiRouter);

app.get('/health/live', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/health/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', database: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'not_ready', database: 'disconnected' });
  }
});

app.get('/health', (req, res) => res.redirect(307, '/health/live'));

if (isProduction) {
  const clientBuild = path.join(__dirname, '..', 'client', 'dist');
  const hasClient = fs.existsSync(path.join(clientBuild, 'index.html'));
  if (hasClient) {
    app.use(express.static(clientBuild, {
      index: false,
      maxAge: '1y',
      immutable: true,
      etag: true,
      setHeaders: (res, filePath) => {
        if (!filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));
    app.get('/{*splat}', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientBuild, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.json({ status: 'ok', service: 'CRM API Server', health: '/health/live' });
    });
  }
}

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('Unhandled request error:', err.message);
  const prismaErrors = {
    P2002: { status: 409, message: 'A record with the same unique value already exists.' },
    P2003: { status: 409, message: 'This record is still referenced by related data.' },
    P2025: { status: 404, message: 'The requested record was not found.' }
  };
  const mapped = prismaErrors[err.code];
  const status = err.status || mapped?.status || (err.name === 'PrismaClientValidationError' ? 400 : 500);
  const safeMessage = mapped?.message
    || (status < 500 ? err.message : 'An unexpected server error occurred.');
  return res.status(status).json({
    message: isProduction ? safeMessage : (mapped?.message || err.message)
  });
});

const PORT = Number(process.env.PORT || 5001);
const HOST = process.env.HOST || '0.0.0.0';
let stopScheduler = () => {};

async function startServer() {
  if (isProduction) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    }
    if (!process.env.CORS_ORIGIN) {
      throw new Error('CORS_ORIGIN must be configured in production.');
    }
  }
  await connectDB();
  stopScheduler = startScheduler();

  return new Promise((resolve) => {
    server.listen(PORT, HOST, () => {
      console.log(`Server running on ${HOST}:${PORT} [${process.env.NODE_ENV || 'development'}]`);
      resolve(server);
    });
  });
}

function shutdown(signal) {
  console.log(`${signal} received. Closing server.`);
  stopScheduler();
  server.close(async () => {
    try {
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error('Shutdown failed:', error.message);
      process.exit(1);
    }
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  });
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { app, server, startServer };
