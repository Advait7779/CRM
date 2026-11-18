# Facebook and Instagram leads from Google Sheets

The CRM reads [Advait - Nov'26 Lead Sheet](https://docs.google.com/spreadsheets/d/16wyHLQBQcCqPTKKM3snje5xrAZqM4MF1vekrmzu9-VE/edit). The workbook link is enough to discover its tabs; individual tab URLs are unnecessary. **Facebook Leads** in the sidebar lists those tabs dynamically. Selecting a tab displays its rows and CRM status. Administrators can sync tabs with a recognizable Meta lead layout into the CRM. The three shorter historical tabs without Meta lead IDs can be inspected but cannot be synced into CRM. The **All CRM Facebook leads** view includes manual CRM entries and previously imported leads, including historical imports from the retired workbook.

The **All-in-One-Nov'26**, **Computer Repair**, **GPS Tracker-Nov'26**, and **Fuel-Tracking-Device-Nov'26** Meta lead tabs are checked on the automatic five-minute sync. Other new tabs with the same Meta ID layout are discovered automatically. Historical tabs without Meta IDs remain view-only. Both `fb` and `ig` platform rows become source `Facebook`; the original platform is retained. The integration never writes to the Google Sheet.

## Deployment setup: Apps Script (recommended)

This connection does not need a Google Cloud service account or a JSON key. It uses a separate Apps Script web app that reads this workbook with the deploying Google user's access. Do **not** publish the spreadsheet itself or replace the existing website enquiry script.

1. Using a Google account that can open the workbook, visit `https://script.google.com`, click **New project**, and name it **CRM Facebook Leads Reader**. This is a separate script project so existing website enquiry automations stay untouched.
2. Replace the starter `Code.gs` contents with the complete source in [`server/googleAppsScriptFacebookLeads.gs`](server/googleAppsScriptFacebookLeads.gs). Save.
3. Generate a unique random secret of at least 32 characters. In Apps Script **Project Settings → Script Properties**, add `FACEBOOK_SHEET_READ_SECRET` with that secret. Keep it out of source code, chat, and GitHub.
4. In Apps Script, click **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy, complete the Google authorization for spreadsheet read access, and copy the `/exec` web app URL. If your Workspace administrator does not allow **Anyone** web apps, this option needs administrator approval or a different authentication method.
5. Set these two values in the **CRM server** environment (for example, Coolify):

   - `FACEBOOK_SHEET_WEBHOOK_URL`: the `/exec` URL from step 4.
   - `FACEBOOK_SHEET_READ_SECRET`: exactly the same secret from step 3.

   `docker-compose.coolify.yml` passes both into the CRM container. Leave `FACEBOOK_SHEET_CLIENT_EMAIL` and `FACEBOOK_SHEET_PRIVATE_KEY` unset. The script settings take precedence if both methods are configured. Set `FACEBOOK_SHEET_SPREADSHEET_ID=16wyHLQBQcCqPTKKM3snje5xrAZqM4MF1vekrmzu9-VE` and `FACEBOOK_SHEET_GID=1627876618` in Coolify if those variables were previously set to the retired workbook; explicitly set values override the new code defaults. `FACEBOOK_SHEET_SYNC_INTERVAL_MINUTES=5` changes the polling interval.

6. Deploy the CRM and apply migrations `20261027_facebook_lead_sync` and `20261027_facebook_lead_tabs` through the normal server start or `npm run migrate --prefix server`. Restart the server. A first read of the automatic tab starts about 15 seconds later; check server logs for the import count.
7. Open **Facebook Leads** in the sidebar. Confirm the tab picker lists the seven tabs in the new workbook and no tabs from the retired workbook. Select a tab to inspect it; use **Sync tab into CRM** only for a mapped Meta lead tab. The old CRM lead records remain available in **All CRM Facebook leads**.

The Apps Script endpoint accepts only secret-authenticated POST requests for listing tabs and reading at most 1000 rows per request. It never writes to the spreadsheet. CRM staff still need their CRM login, and raw unmapped tab access remains restricted to administrators. The endpoint URL alone cannot read rows without the secret.

### Updating an existing Apps Script deployment for faster tabs

To switch an existing Apps Script deployment to the new workbook, replace its `Code.gs` with the current [`server/googleAppsScriptFacebookLeads.gs`](server/googleAppsScriptFacebookLeads.gs), save, then choose **Deploy → Manage deployments → Edit → New version → Deploy**. Keep the same Script Property and web app URL. The CRM checks that the reader identifies the new workbook and reports an error until the new script version is deployed; this prevents old tabs from being shown accidentally. The browser tab cache is reset by this update. The script lists tabs without scanning every tab for its row count and reads up to 1000 rows per request.

The server also starts warming its tab cache after startup and when someone opens the tab picker. It reads two tabs at a time to avoid a burst of Apps Script requests. A tab that has already been warmed opens from memory; older cached rows are shown immediately while a fresh copy loads in the background. A tab opened before its first read finishes still waits for Google Sheets. **Refresh** waits for a live copy.

## Alternative: service account

If your organization permits JSON keys, enable the Sheets API in a Google Cloud project, create a service account, share the workbook with its email as **Viewer**, and set `FACEBOOK_SHEET_CLIENT_EMAIL` and `FACEBOOK_SHEET_PRIVATE_KEY` in the CRM server environment. Both real PEM line breaks and escaped `\n` line breaks work. Do not set the Apps Script URL or secret if using this method. The Apps Script method avoids changing an organization-wide key creation policy.

If the browser reports `404 API endpoint not found` for `/api/facebook-sheet/tabs`, the frontend is calling an API deployment that does not have the new routes. Redeploy the API server from the same commit as the frontend, including both Facebook migrations. This 404 occurs before any Google Sheets credential check. Once the route responds, a missing credential or workbook Viewer grant will produce a separate configuration or Google access error. In a Coolify Compose deployment, the `FACEBOOK_SHEET_*` variables must be passed through `docker-compose.coolify.yml`; put their values in Coolify environment settings and redeploy both services.

## Data handling

- `id` is stored uniquely as `facebookLeadId`; rescans do not duplicate leads or reset status and assignment.
- `FacebookLeadTabs` records every source tab containing the lead. One Meta ID remains one CRM lead even when it appears in several tabs. Selected-tab Excel export includes the tab's visible sheet rows and CRM status, including rows not yet imported.
- `created_time` becomes `facebookSubmittedAt` and is shown as the lead date. CRM `createdAt` records import time.
- The `p:` phone prefix is removed. Email is optional. Sheet platform, campaign, form, city, extra note columns, and the complete source row are retained in the lead notes or payload.
- The sheet's `lead_status` is preserved in `facebookPayload`. CRM status starts as **New** and is then managed by sales staff.
- After the notification update is deployed, the first Facebook sheet sync records a notification start time. Existing sheet rows and already imported CRM leads are not messaged. New imported leads submitted after that time use the matching Justdial product group's saved SMS, RCS, and WhatsApp URLs once. Unclassified leads have no matching message group and are skipped. Provider HTTP success is logged by channel; actual handset delivery must be checked with the messaging provider.
- Existing CRM product access rules still apply. Rows selecting `other` are classified as **Unclassified**, so administrators see them while sales users need an appropriate product classification before the rows enter their scoped lead list.
- All sales roles can open the new page. Raw rows from unmapped tabs are visible only to Super Admin and Director; only those roles can start a tab sync. Rows in mapped tabs are limited by the existing product permissions for sales staff.
- If credentials are missing, the sync stays disabled and logs only which setting needs attention. Header changes or Google API errors leave existing CRM records intact and are retried at the next interval.
