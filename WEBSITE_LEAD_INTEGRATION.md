# Advait Digital website enquiries in CRM via Google Sheets

The website already saves enquiry forms in PostgreSQL and syncs them to the **Website Cms** tab of its Google Sheet. The CRM reads that tab every five minutes and adds new rows to **Leads → Website Leads**. The website and its form flow need no deployment change.

## Connect the CRM

1. Deploy the CRM code and apply the `20261015_website_lead_sync` migration.
2. Create or reuse a Google service account with the Sheets API enabled. Share the spreadsheet with its client email as **Viewer**. The CRM uses read-only OAuth scope.
3. Immediately before enabling the CRM sync, note the largest numeric ID already in column A of **Website Cms**. Set that value as `WEBSITE_SHEET_START_AFTER_ID`; only larger IDs will import. As checked on 15 October 2026, the largest existing ID was **42**. Recheck it at activation because new enquiries may arrive meanwhile.
4. Set these CRM API environment variables through an HTTPS Coolify dashboard or encrypted SSH session:

   - `WEBSITE_SHEET_SPREADSHEET_ID=1S-ZvDpj2LSc6-z4Cs35PDzDDmsj-Ht_txQCOCOMeubs`
   - `WEBSITE_SHEET_TAB_NAME=Website Cms`
   - `WEBSITE_SHEET_CLIENT_EMAIL=` the service account email
   - `WEBSITE_SHEET_PRIVATE_KEY_BASE64=` base64 encoded service account private key
   - `WEBSITE_SHEET_START_AFTER_ID=` the step 3 ID
   - `WEBSITE_SHEET_SYNC_INTERVAL_MINUTES=5` (optional)

5. Restart or redeploy the CRM API. It will poll the sheet on startup and then every five minutes. Submit one clearly identified website enquiry and confirm it appears in the website admin, the sheet, and CRM Website Leads. The original submission date and form name should match.

Never publish the Google Sheet or service account key. The key belongs only in the CRM API environment, not in browser code or Git. The Codex Google Drive connection used to inspect the sheet cannot be used automatically by the deployed CRM server.

## Behavior

- The importer reads only the **Website Cms** tab and checks its exact nine-column header. It does not read the workbook's other tabs.
- IDs at or below `WEBSITE_SHEET_START_AFTER_ID` are ignored. The CRM stores the website lead ID uniquely, so retries and later sheet scans do not create duplicates or reset sales status.
- A temporary Google API failure leaves CRM data unchanged; the next poll retries. A malformed row is skipped and logged by row ID while later rows continue.
- CRM staff access follows the existing product classification and lead permissions. The Excel export uses the same Website Leads filter.
