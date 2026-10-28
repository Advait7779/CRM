const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Apps Script bridge authorizes reads, lists visible tabs and pages rows', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'googleAppsScriptFacebookLeads.gs'), 'utf8');
  let workbookOpens = 0;
  const sheet = {
    isSheetHidden: () => false,
    getSheetId: () => 1497736270,
    getName: () => 'October leads',
    getIndex: () => 1,
    getLastRow: () => 3,
    getLastColumn: () => 2,
    getRange: (row, column, count, width) => {
      assert.equal(column, 1);
      assert.equal(width, 2);
      return { getDisplayValues: () => [['id', 'name'], ['l:1', 'Lead 1'], ['l:2', 'Lead 2']].slice(row - 1, row - 1 + count) };
    }
  };
  const hidden = { isSheetHidden: () => true };
  const context = {
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-facebook-script-secret-at-least-32-characters' }) },
    SpreadsheetApp: { openById: id => {
      assert.equal(id, '1S-ZvDpj2LSc6-z4Cs35PDzDDmsj-Ht_txQCOCOMeubs');
      workbookOpens += 1;
      return { getSheets: () => [sheet, hidden], getSheetById: gid => gid === 1497736270 ? sheet : null };
    } }
  };
  vm.runInNewContext(source, context, { filename: 'googleAppsScriptFacebookLeads.gs' });
  const invoke = body => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  assert.equal(invoke({ action: 'listTabs', secret: 'wrong' }).error, 'Unauthorized.');
  assert.equal(workbookOpens, 0);
  const secret = 'test-facebook-script-secret-at-least-32-characters';
  assert.equal(invoke({ action: 'listTabs', secret }).tabs.length, 1);
  const first = invoke({ action: 'readTab', secret, gid: 1497736270, startRow: 1, limit: 2 });
  assert.equal(first.values.length, 2);
  assert.equal(first.hasMore, true);
  assert.equal(first.nextRow, 3);
  const second = invoke({ action: 'readTab', secret, gid: 1497736270, startRow: 3, limit: 2 });
  assert.equal(second.values[0][1], 'Lead 2');
  assert.equal(second.hasMore, false);
  assert.equal(invoke({ action: 'readTab', secret, gid: 1497736270, startRow: 1, limit: 251 }).error, 'Invalid tab request.');
});
