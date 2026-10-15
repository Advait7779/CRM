# Advait Digital website enquiries in CRM via Google Sheets

The website already saves enquiry forms in PostgreSQL and sends them to the **Website Cms** tab through a Google Apps Script webhook. The CRM asks that same Apps Script for new rows every five minutes and adds them to **Leads → Website Leads**. The website form and backend flow stay unchanged; the Apps Script deployment needs an update to support secure reads.

## Connect the CRM

1. In the existing Google Apps Script project, replace the webhook code with the updated `backend/googleAppsScriptWebhook.gs` from the Advait Digital website repository. Keep the existing `WEBHOOK_SECRET` script property for website writes, and add a new random `CRM_READ_SECRET` property of at least 32 characters. The read secret must be different from the write secret. Deploy a **new web-app version** so the existing URL serves the updated code.
2. Because the write webhook secret appeared in a screenshot shared in chat, rotate `WEBHOOK_SECRET` in Apps Script and `GOOGLE_SHEETS_WEBHOOK_SECRET` in the website backend's Coolify environment. Apply both changes together so website enquiries continue reaching the sheet.
3. Deploy the CRM code and apply the `20261015_website_lead_sync` migration.
4. Immediately before enabling the CRM sync, note the largest numeric ID already in column A of **Website Cms**. Set that value as `WEBSITE_SHEET_START_AFTER_ID`; only larger IDs will import. As checked on 15 October 2026, the largest existing ID was **42**. Recheck it at activation because new enquiries may arrive meanwhile.
5. Set these CRM API environment variables through an HTTPS Coolify dashboard or encrypted SSH session:

   - `WEBSITE_SHEET_WEBHOOK_URL=` the existing HTTPS Apps Script web-app URL
   - `WEBSITE_SHEET_READ_SECRET=` the new `CRM_READ_SECRET` from step 1
   - `WEBSITE_SHEET_START_AFTER_ID=` the step 4 ID
   - `WEBSITE_SHEET_SYNC_INTERVAL_MINUTES=5` (optional)

6. Restart or redeploy the CRM API. It will poll the Apps Script on startup and then every five minutes. Submit one clearly identified website enquiry and confirm it appears in the website admin, the sheet, and CRM Website Leads. The original submission date and form name should match.

Never publish the Google Sheet or either webhook secret. Put secrets only in Apps Script properties and backend environment variables, never in browser code, Git, or chat. The Codex Google Drive connection used to inspect the sheet cannot be used automatically by the deployed CRM server.

## Behavior

- The Apps Script read action returns only the **Website Cms** tab and checks its exact nine-column header. It does not return the workbook's other tabs.
- IDs at or below `WEBSITE_SHEET_START_AFTER_ID` are ignored. The CRM stores the website lead ID uniquely, so retries and later sheet scans do not create duplicates or reset sales status.
- A temporary Apps Script failure leaves CRM data unchanged; the next poll retries. A malformed row is skipped and logged by row ID while later rows continue.
- CRM staff access follows the existing product classification and lead permissions. The Excel export uses the same Website Leads filter.
