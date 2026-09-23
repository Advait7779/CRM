# Service Management CRM

A full-stack service CRM for leads, customers, quotations, installations, billing, renewals, support tickets, inventory, employees, tasks, calendar events, notifications, and operational reporting.

## Stack

- React 19 and Vite
- Node.js 22 and Express 5
- PostgreSQL and Prisma ORM 7
- Docker deployment for Coolify

## Local development

1. Copy `server/.env.example` to `server/.env` and provide a local PostgreSQL connection, `JWT_SECRET`, and initial administrator credentials.
2. Install dependencies:

   ```powershell
   npm.cmd run install:all
   ```

3. Apply versioned Prisma migrations and create the initial administrator:

   ```powershell
   npm.cmd run db:migrate
   ```

4. Run the backend and frontend in separate terminals:

   ```powershell
   npm.cmd run dev:server
   npm.cmd run dev:client
   ```

The Vite client runs on port 5174 and proxies `/api` to port 5001.

## Production checks

```powershell
npm.cmd test
npm.cmd run build --prefix client
npm.cmd run lint --prefix client
```

Production endpoints:

- Liveness: `/health/live`
- Database readiness: `/health/ready`

## Database safety

`npm run db:migrate` runs `prisma migrate deploy` and then creates the initial administrator if no matching account exists. Production schema changes must be committed as versioned files under `server/prisma/migrations`.

`npm run seed:demo` is development-only, requires `DEMO_PASSWORD`, and only runs against an empty database. It never deletes existing application data.

## Production deployment

See [COOLIFY_DEPLOYMENT.md](./COOLIFY_DEPLOYMENT.md) for the Hostinger VPS and Coolify procedure.
