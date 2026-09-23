# Hostinger VPS + Coolify Deployment

This project is deployed as one Docker application: Express serves the compiled React client and the API on port `5001`. PostgreSQL should be a separate Coolify database resource.

## 1. Prepare source control and DNS

Coolify should deploy this directory from a private Git repository. Commit the project without `server/.env`, `node_modules`, `client/dist`, or uploaded files.

Create an `A` record such as `crm.example.com` pointing to the Hostinger VPS public IP. Coolify will provision HTTPS after the domain is attached.

## 2. Create PostgreSQL in Coolify

In the same Coolify project:

1. Add a PostgreSQL database.
2. Enable persistent storage and scheduled backups.
3. Copy its internal connection URL into the CRM application's `DATABASE_URL`.
4. Use `DB_SSL=false` for the private Coolify network. For an external provider that requires TLS, set `DB_SSL=true`.
5. For a separate database resource, enable **Connect to Predefined Network** on the Compose application. Verify the database's generated internal hostname is used by both `migrate` and `crm`.

Do not expose PostgreSQL publicly unless it is specifically required.

## 3. Create the CRM resource

Use the Docker Compose application with `docker-compose.coolify.yml` (recommended). It runs migrations as a one-shot service and starts the web service only after migration succeeds.

Assign the HTTPS domain to the `crm` service with internal port `5001` (for example `https://crm.example.com:5001` in Coolify's domain field). Do not attach a domain to `migrate`. Exclude the completed one-shot migration service from ongoing health monitoring in Coolify. Verify a subsequent redeployment runs the migration job again.

The image runs as the non-root `node` user (UID 1000). Existing upload volumes copied from another server must be writable by UID 1000; do not make the volume world-writable.

If you use a Dockerfile application instead, configure Coolify's pre-deployment command as `npm run migrate`, set port `5001`, health path `/health/ready`, and attach a persistent volume at `/app/uploads`.

The image builds the React client, installs production server dependencies, and generates Prisma Client. In Compose, the `migrate` service applies committed migrations and creates the initial administrator before the `crm` web service starts.

Always use `npm run migrate` for deployment. It initializes an empty database with the original baseline before applying dependent migrations, without renaming old migrations or modifying their checksums. A bare `prisma migrate deploy` skips this bootstrap and must not be used for a fresh database. Run `npm run migrations:verify` from `server` to rehearse SQL/schema coverage in a rolled-back isolated schema.

## 4. Configure environment variables

Required:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=5001
TZ=Asia/Kolkata
APP_TIME_ZONE=Asia/Kolkata
DATABASE_URL=postgresql://...
DB_SSL=false
JWT_SECRET=<at least 64 random characters>
JWT_EXPIRES_IN=8h
CORS_ORIGIN=https://crm.example.com
ADMIN_NAME=Super Admin
ADMIN_EMAIL=<administrator email>
ADMIN_PASSWORD=<unique password of at least 12 characters>
UPLOAD_DIR=/app/uploads
UPLOAD_MAX_TOTAL_BYTES=2147483648
ENABLE_SCHEDULER=true
```

Generate a JWT secret with:

```bash
openssl rand -hex 64
```

Optional SMTP:

```text
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=...
EMAIL_PASS=...
```

SMTP email is implemented. WhatsApp, SMS, RCS, and voice require provider-specific adapters; until configured, the API reports those channels as skipped rather than falsely delivered.

Keep `ADMIN_PASSWORD` configured because the one-shot migration service validates it on each deployment; it is not used to overwrite an existing administrator. Password changes are made inside the CRM.

## 5. Deploy and verify

After deployment:

1. Confirm Coolify reports the container healthy.
2. Open `https://crm.example.com/health/live`.
3. Open `https://crm.example.com/health/ready` and confirm the database is connected.
4. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
5. Change the administrator password from **My Profile**.
6. Test a customer, invoice, payment, renewal, document upload, and CSV report.

## 6. Backups and updates

- Back up PostgreSQL daily and retain multiple restore points.
- Keep the `/app/uploads` volume persistent and back it up with the database.
- Deploy updates from a tagged Git commit.
- Verify `/health/ready` after every deployment.
- Review and commit every file under `server/prisma/migrations` before deploying.
- Never run `npm run seed:demo` in a production container.

## Mobile and release verification

Set `EXPO_PUBLIC_API_URL=https://crm.example.com/api` in the Expo/EAS build environment, or enter this URL in Expo Go's Server Settings. Existing saved development URLs take precedence and must be changed manually. Never put database credentials or JWT secrets in `EXPO_PUBLIC_*` variables.

Before going live, run `npm run check` at the root and `npm run check --prefix mobile`. Test admin and employee login, private group membership, files, task assignment, and chat history in staging. The local demo logins without employee records are test accounts; do not use them as production employees or guess payroll links.

Database migrations do not copy business records or files from your computer. Back up and transfer the database and uploads together through a private channel, test restoration, and confirm record/file counts before switching DNS. Set daily off-server backups for both resources. Do not place unencrypted payroll/customer database dumps in a cloud-synced source directory.

## Coolify troubleshooting

- **502 / unhealthy:** confirm application port `5001` and inspect `/health/live`.
- **Database not ready:** verify `DATABASE_URL`, database resource health, `DB_SSL`, and the `npm run migrate` deployment log.
- **Login rejected by CORS:** `CORS_ORIGIN` must exactly match the public HTTPS origin.
- **Uploaded files disappear:** attach a persistent volume at `/app/uploads`.
- **SMTP skipped:** add all four `EMAIL_*` variables and redeploy.
