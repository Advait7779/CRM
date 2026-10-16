# Advait Digital website enquiries in CRM via Google Sheets

The website already saves enquiry forms in PostgreSQL and sends them to the **Website Cms** tab through a Google Apps Script webhook. The CRM asks that same Apps Script for new rows every five minutes and adds them to **Leads → Website Leads**. The website form and backend flow stay unchanged; the Apps Script deployment needs an update to support secure reads.

## Connect the CRM

1. The currently deployed Apps Script has the website write secret hardcoded. Before replacing its code, open **Project Settings → Script Properties** and add `WEBHOOK_SECRET` with that current value temporarily, plus a different new random `CRM_READ_SECRET` of at least 32 characters. Never paste either secret into source code or chat.
2. In the same Apps Script project, replace the webhook code with the updated `backend/googleAppsScriptWebhook.gs` from the Advait Digital website repository. Save it, then edit the **existing web-app deployment** to use a **new version**. This preserves the existing webhook URL. Verify one website enquiry still appears in the sheet.
3. Because the write secret appeared in chat, generate a replacement and change `WEBHOOK_SECRET` in Apps Script and `GOOGLE_SHEETS_WEBHOOK_SECRET` in the website backend's Coolify environment close together. Restart the backend and verify another enquiry reaches the sheet. The website backend retries temporary Sheet sync failures.
4. Deploy the CRM code and apply the `20261015_website_lead_sync` migration.
5. Set `WEBSITE_SHEET_START_AFTER_ID` to the last lead ID that should remain historical; only larger IDs will import. Do not use the current maximum if new leads have already arrived. On 16 October 2026, ID **39** was the last historical row, and new website enquiries had IDs **40**, **41**, and **42**. Set the cutoff to **39** to import those three. Check the sheet again before changing this value if later rows have arrived.
6. Set these CRM API environment variables through an HTTPS Coolify dashboard or encrypted SSH session:

   - `WEBSITE_SHEET_WEBHOOK_URL=` the existing HTTPS Apps Script web-app URL
   - `WEBSITE_SHEET_READ_SECRET=` the new `CRM_READ_SECRET` from step 1
   - `WEBSITE_SHEET_START_AFTER_ID=` the step 5 ID
   - `WEBSITE_SHEET_SYNC_INTERVAL_MINUTES=5` (optional)

7. Restart or redeploy the CRM API. It will poll the Apps Script on startup and then every five minutes. Submit one clearly identified website enquiry and confirm it appears in the website admin, the sheet, and CRM Website Leads. The original submission date and form name should match.

Never publish the Google Sheet or either webhook secret. Put secrets only in Apps Script properties and backend environment variables, never in browser code, Git, or chat. The Codex Google Drive connection used to inspect the sheet cannot be used automatically by the deployed CRM server.

## Behavior

- The Apps Script read action returns only the **Website Cms** tab and checks its exact nine-column header. It does not return the workbook's other tabs.
- IDs at or below `WEBSITE_SHEET_START_AFTER_ID` are ignored. The CRM stores the website lead ID uniquely, so retries and later sheet scans do not create duplicates or reset sales status.
- A temporary Apps Script failure leaves CRM data unchanged; the next poll retries. A malformed row is skipped and logged by row ID while later rows continue.
- CRM staff access follows the existing product classification and lead permissions. The Excel export uses the same Website Leads filter.
