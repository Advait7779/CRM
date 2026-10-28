// Deploy as a separate Apps Script web app: Execute as me, access Anyone.
// Set FACEBOOK_SHEET_READ_SECRET (32+ random characters) in Script Properties.
// The workbook stays private; only callers with the secret can read its tabs.
const FACEBOOK_SPREADSHEET_ID = '1S-ZvDpj2LSc6-z4Cs35PDzDDmsj-Ht_txQCOCOMeubs';

function facebookJson_(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let request;
  try { request = JSON.parse(e.postData.contents || '{}'); }
  catch { return facebookJson_({ success: false, error: 'Invalid request.' }); }

  const secret = PropertiesService.getScriptProperties().getProperty('FACEBOOK_SHEET_READ_SECRET');
  if (!secret || secret.length < 32 || request.secret !== secret) {
    return facebookJson_({ success: false, error: 'Unauthorized.' });
  }

  try {
    const workbook = SpreadsheetApp.openById(FACEBOOK_SPREADSHEET_ID);
    if (request.action === 'listTabs') {
      const tabs = workbook.getSheets().filter(sheet => !sheet.isSheetHidden()).map(sheet => ({
        gid: sheet.getSheetId(), title: sheet.getName(), index: sheet.getIndex() - 1,
        maxPageSize: 1000
      }));
      return facebookJson_({ success: true, tabs });
    }

    if (request.action === 'readTab') {
      const gid = Number(request.gid);
      const startRow = Number(request.startRow);
      const limit = Number(request.limit);
      if (!Number.isSafeInteger(gid) || gid < 0 || !Number.isSafeInteger(startRow) || startRow < 1
        || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
        return facebookJson_({ success: false, error: 'Invalid tab request.' });
      }
      const sheet = workbook.getSheetById(gid);
      if (!sheet || sheet.isSheetHidden()) {
        return facebookJson_({ success: false, error: 'Spreadsheet tab not found.' });
      }
      const lastRow = sheet.getLastRow();
      const width = Math.min(52, sheet.getLastColumn());
      const count = Math.min(limit, Math.max(0, lastRow - startRow + 1));
      const values = count && width ? sheet.getRange(startRow, 1, count, width).getDisplayValues() : [];
      const nextRow = startRow + values.length;
      return facebookJson_({ success: true, values, nextRow, lastRow, hasMore: nextRow <= lastRow });
    }
    return facebookJson_({ success: false, error: 'Unknown action.' });
  } catch {
    return facebookJson_({ success: false, error: 'Spreadsheet read failed. Check script access to the workbook.' });
  }
}
