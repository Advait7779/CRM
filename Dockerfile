# Multi-stage Dockerfile for Service Management Platform

# 1. Build Client Assets
FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# 2. Production Server Environment
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001
ENV TZ=Asia/Kolkata
ENV APP_TIME_ZONE=Asia/Kolkata

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/
RUN cd server && npm run prisma:generate
COPY --from=client-builder /app/client/dist ./client/dist

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

# Expose HTTP port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/health/live || exit 1

WORKDIR /app/server
CMD ["sh", "-c", "npm run migrate && node index.js"]
