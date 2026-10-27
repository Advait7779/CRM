# Facebook and Instagram leads from Google Sheets

The CRM reads spreadsheet `1S-ZvDpj2LSc6-z4Cs35PDzDDmsj-Ht_txQCOCOMeubs`. The main workbook link is enough to discover its tabs; individual tab URLs are unnecessary. **Facebook Leads** in the sidebar lists those tabs dynamically. Selecting a tab displays its rows and CRM status. Administrators can sync tabs with a recognizable Meta lead layout into the CRM; empty, job-application, website-enquiry, and unmapped irregular tabs remain available for read-only inspection. The **All CRM Facebook leads** view includes manual CRM entries as well as imports.

The linked **Allinone Leads - Oct'26** tab (gid `1497736270`) remains on the automatic five-minute sync. Other tabs are synced on demand. Both `fb` and `ig` platform rows become source `Facebook`; the original platform is retained. The integration never writes to the Google Sheet.

## Deployment setup

1. In a Google Cloud project, enable the Google Sheets API and create a service account with a JSON private key.
2. Share the spreadsheet with the service account email as **Viewer**. The account needs access to the spreadsheet even though the developer's Google Drive connection can read it.
3. Set these secrets in the **CRM server** environment (for example, Coolify), never in the browser build or source control:

   - `FACEBOOK_SHEET_CLIENT_EMAIL`: service account `client_email`.
   - `FACEBOOK_SHEET_PRIVATE_KEY`: service account `private_key`. Both real PEM line breaks and escaped `\n` line breaks work.

   The spreadsheet ID and gid default to the linked source. `FACEBOOK_SHEET_SYNC_INTERVAL_MINUTES=5` can change the polling interval. See `server/.env.example` for all settings.

4. Deploy the CRM and apply migrations `20261027_facebook_lead_sync` and `20261027_facebook_lead_tabs` through the normal server start or `npm run migrate --prefix server`. Restart the server. A first read of the automatic tab starts about 15 seconds later; check the server logs for the import count.
5. Open **Facebook Leads** in the sidebar. Confirm that the tab picker lists the workbook's tabs. Select a tab to inspect it; use **Sync tab into CRM** only for a mapped Meta lead tab. The initial October source tab contained 41 leads when inspected on 27 October 2026 (29 `fb`, 12 `ig`), so its first import should be close to 41 unless rows were added, deleted, or invalid.

If the browser reports `404 API endpoint not found` for `/api/facebook-sheet/tabs`, the frontend is calling an API deployment that does not have the new routes. Redeploy the API server from the same commit as the frontend, including both Facebook migrations. This 404 occurs before any Google Sheets credential check. Once the route responds, a missing credential or workbook Viewer grant will produce a separate configuration or Google access error. In a Coolify Compose deployment, the `FACEBOOK_SHEET_*` variables must be passed through `docker-compose.coolify.yml`; put their values in Coolify environment settings and redeploy both services.

## Data handling

- `id` is stored uniquely as `facebookLeadId`; rescans do not duplicate leads or reset status and assignment.
- `FacebookLeadTabs` records every source tab containing the lead. One Meta ID remains one CRM lead even when it appears in several tabs. Selected-tab Excel export includes the tab's visible sheet rows and CRM status, including rows not yet imported.
- `created_time` becomes `facebookSubmittedAt` and is shown as the lead date. CRM `createdAt` records import time.
- The `p:` phone prefix is removed. Email is optional. Sheet platform, campaign, form, city, extra note columns, and the complete source row are retained in the lead notes or payload.
- The sheet's `lead_status` is preserved in `facebookPayload`. CRM status starts as **New** and is then managed by sales staff.
- Existing CRM product access rules still apply. Rows selecting `other` are classified as **Unclassified**, so administrators see them while sales users need an appropriate product classification before the rows enter their scoped lead list.
- All sales roles can open the new page. Raw rows from unmapped tabs are visible only to Super Admin and Director; only those roles can start a tab sync. Rows in mapped tabs are limited by the existing product permissions for sales staff.
- If credentials are missing, the sync stays disabled and logs only which setting needs attention. Header changes or Google API errors leave existing CRM records intact and are retried at the next interval.
