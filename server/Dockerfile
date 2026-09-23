FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5004
ENV TZ=Asia/Kolkata
ENV APP_TIME_ZONE=Asia/Kolkata

RUN apk add --no-cache curl

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./
RUN npm run prisma:generate

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

EXPOSE 5004

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:5004/health/live || exit 1

CMD ["sh", "-c", "npm run migrate && node index.js"]
