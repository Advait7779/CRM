# Facebook and Instagram leads from Google Sheets

The CRM imports the linked **Allinone Leads - Oct'26** tab (gid `1497736270`) from spreadsheet `1S-ZvDpj2LSc6-z4Cs35PDzDDmsj-Ht_txQCOCOMeubs`. Both `fb` and `ig` platform rows become source `Facebook`; the original platform is retained. Existing rows are backfilled on the first successful sync, and new rows are checked every five minutes. This integration only reads the linked tab and never writes to the sheet.

## Deployment setup

1. In a Google Cloud project, enable the Google Sheets API and create a service account with a JSON private key.
2. Share the spreadsheet with the service account email as **Viewer**. The account needs access to the spreadsheet even though the developer's Google Drive connection can read it.
3. Set these secrets in the **CRM server** environment (for example, Coolify), never in the browser build or source control:

   - `FACEBOOK_SHEET_CLIENT_EMAIL`: service account `client_email`.
   - `FACEBOOK_SHEET_PRIVATE_KEY`: service account `private_key`. Both real PEM line breaks and escaped `\n` line breaks work.

   The spreadsheet ID and gid default to the linked source. `FACEBOOK_SHEET_SYNC_INTERVAL_MINUTES=5` can change the polling interval. See `server/.env.example` for all settings.

4. Deploy the CRM and apply migration `20261027_facebook_lead_sync` through the normal server start or `npm run migrate --prefix server`. Restart the server. A first read starts about 15 seconds later; check the server logs for the import count.
5. Check **Lead Management → All** and **Facebook Leads**. The initial source tab contained 41 leads when inspected on 27 October 2026 (29 `fb`, 12 `ig`), so the first import should be close to 41 unless rows were added, deleted, or invalid. Confirm an imported lead's phone, service, and original enquiry date. Check the Facebook Leads Excel export too.

## Data handling

- `id` is stored uniquely as `facebookLeadId`; rescans do not duplicate leads or reset status and assignment.
- `created_time` becomes `facebookSubmittedAt` and is shown as the lead date. CRM `createdAt` records import time.
- The `p:` phone prefix is removed. Email is optional. Sheet platform, campaign, form, city, extra note columns, and the complete source row are retained in the lead notes or payload.
- The sheet's `lead_status` is preserved in `facebookPayload`. CRM status starts as **New** and is then managed by sales staff.
- Existing CRM product access rules still apply. Rows selecting `other` are classified as **Unclassified**, so administrators see them while sales users need an appropriate product classification before the rows enter their scoped lead list.
- If credentials are missing, the sync stays disabled and logs only which setting needs attention. Header changes or Google API errors leave existing CRM records intact and are retried at the next interval.
