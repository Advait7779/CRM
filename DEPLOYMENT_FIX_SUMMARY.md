# Deployment fixes — 11 September 2026

## Completed
- Repaired customer overview's undefined installation-permission check.
- Restricted task list/detail/status/calendar access by assignedUserId. Mobile managers now select staff by ID; legacy name input is accepted only when it identifies one user uniquely.
- Restricted group listing, reading, and sending to group members/creator.
- Added persistent upload ownership and conversation-based file authorization, preventing chat routes from exposing unrelated HR/customer documents.
- Chat loads the latest 100 messages and offers older-page loading on web and mobile. Polling preserves loaded history; stale responses from other conversations are discarded.
- Kept the 1,000-request threshold, with separate buckets for authenticated users verified against the database; anonymous requests remain IP-limited and login retains its own limit.
- Restricted production CORS to the configured origins, and validated actual development hostnames rather than string prefixes.
- Added the missing chat/settings/upload registry migration without rewriting old migration files.
- Added an empty-database bootstrap that lets Prisma record the original baseline before dependent migrations.
- Applied the new additive migration locally after making a verified local backup. No records were deleted and the two unlinked test logins were left unchanged.
- Kept Field Workforce removed as requested; updated obsolete tests while preserving historical database tables.
- Applied compatible dependency fixes and reviewed overrides. The backend audit reports zero vulnerabilities.
- Added a non-root Docker runtime, source/build exclusions, and deployment guidance for networking, volumes, mobile URLs, and backups.

## Verification
- All 25 server tests pass, including isolated HTTP tests for private groups, task ownership, per-user request quotas, multipart upload/download authorization, and chat history beyond 500 messages.
- All 7 mobile contract tests pass; web and mobile lint checks pass.
- Web production build passes (existing large PDF-library chunk warning remains).
- Expo dependency compatibility check passes.
- Android JavaScript/Hermes export passes (2,770 modules); no APK was created.
- All five migrations reproduce every Prisma model column in a transaction-isolated schema; the rehearsal is rolled back automatically.
- Local migration status is up to date.
- Local read-only checks returned 200 for dashboard, notifications, tasks, leads, calendar, chat contacts, settings and customer overview. Non-member group access returned 404.

## Still required before public launch
1. Mobile npm audit still reports 15 affected packages (8 high, 7 moderate), propagated from image-size (Expo/Metro tooling) and decode-uri-component (React Navigation). No compatible complete fix is available in the retained SDK/dependency line. This is not a claim that every finding is reachable in the installed app. Do not expose the Metro development server publicly or build with untrusted assets. A separately verified framework/dependency migration is needed to clear these findings.
2. Docker is unavailable on this computer. Actual Linux image startup, Coolify proxy/HTTPS, volume permissions and a full fresh-server deployment still require staging verification.
3. Configure the private Git source, VPS, database network, real domain, strong production secrets, optional messaging providers, off-server backups and mobile HTTPS API URL.
4. Transfer existing database data AND uploads through a private channel and test restore before switching users to the hosted system.
5. Restart the existing backend/Expo development processes to load the changed code. No running user-managed process was terminated during this work.

See COOLIFY_DEPLOYMENT.md for the deployment sequence. Use npm run migrate (not a bare prisma migrate deploy) so empty-database bootstrap runs correctly.

## Local backup
C:/Users/advai/AppData/Local/ServiceManagementBackups/before-chat-fixes-2026-09-11T05-13-35-293Z.dump

The backup is outside OneDrive. Its archive listing was verified; a full restore rehearsal of this business-data backup has not been performed.
