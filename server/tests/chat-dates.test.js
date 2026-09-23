const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { prepareData, jsonReplacer } = require('../utils/prismaData');

// Run the same behavioral checks on each client without loading React Native.
for (const client of ['client', 'mobile']) {
  const source = fs.readFileSync(path.resolve(__dirname, '../../', client, 'src/utils/chatDate.js'), 'utf8');
  const helpers = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

  test(client + ': polling and older-page loads preserve history without duplicating messages', async () => {
    const { mergeChatPage } = await helpers;
    const message = id => ({ id, createdAt: new Date(2026, 0, 1, 0, 0, id).toISOString() });
    const previous = [message(1), message(2), message(3)];
    assert.deepEqual(mergeChatPage(previous, [message(3), message(4)]).map(row => row.id), [1, 2, 3, 4]);
    assert.deepEqual(mergeChatPage(previous, [message(0), message(1)], true).map(row => row.id), [0, 1, 2, 3]);
    assert.deepEqual(mergeChatPage(previous, []), []);
    assert.deepEqual(mergeChatPage(previous, [], true), previous);
    assert.deepEqual(previous.map(row => row.id), [1, 2, 3]);
  });

  test(client + ': old and new messages are grouped by full calendar dates', async () => {
    const { chatDayKey, chatDayLabel, chatPreviewDate, sortChatMessages } = await helpers;
    const older = { id: 27, createdAt: '2026-08-22T06:52:16.752Z' };
    const newer = { id: 38, createdAt: '2026-09-08T10:18:59.528Z' };
    const now = new Date('2026-09-08T10:24:00Z');
    assert.notEqual(chatDayKey(older.createdAt), chatDayKey(newer.createdAt));
    assert.match(chatDayLabel(older.createdAt, now), /Sat.*22.*Aug.*2026/);
    assert.match(chatDayLabel(newer.createdAt, now), /Today.*Tue.*8.*Sept.*2026/);
    assert.match(chatPreviewDate(older.createdAt, now), /2026/);
    const input = [newer, older];
    assert.deepEqual(sortChatMessages(input), [older, newer]);
    assert.equal(input[0], newer, 'sorting must not mutate React state');
  });

  test(client + ': local midnight, year changes, leap days and invalid dates', async () => {
    const { chatDayKey, chatDayLabel, chatTime, chatPreviewDate, sortChatMessages } = await helpers;
    const now = new Date(2027, 0, 1, 0, 5);
    const previous = new Date(2026, 11, 31, 23, 55);
    assert.equal(chatDayKey(previous), '2026-12-31');
    assert.match(chatDayLabel(previous, now), /Yesterday.*2026/);
    assert.match(chatDayLabel(now, now), /Today.*2027/);
    assert.match(chatDayLabel(new Date(2024, 1, 29, 12), new Date(2024, 2, 1, 12)), /Yesterday.*29.*Feb.*2024/);
    assert.equal(chatDayKey(now.toISOString()), chatDayKey(now));
    for (const invalid of [null, undefined, '', 'invalid']) {
      assert.equal(chatDayLabel(invalid, now), 'Date unavailable');
      assert.equal(chatTime(invalid), 'Time unavailable');
      assert.equal(chatPreviewDate(invalid, now), '');
    }
    const sameTime = now.toISOString();
    assert.deepEqual(sortChatMessages([{ id: 2, createdAt: sameTime }, { id: 1, createdAt: sameTime }]).map(m => m.id), [1, 2]);
  });
}

test('chat read updates preserve the original full send timestamp', () => {
  const timestamp = new Date('2026-08-22T06:52:16.752Z');
  const stored = prepareData('chatMessages', { message: 'Example', createdAt: timestamp }, { create: true });
  const update = prepareData('chatMessages', { read: true });
  assert.equal(stored.createdAt, timestamp);
  assert.equal(Object.hasOwn(update, 'createdAt'), false);
  assert.equal(JSON.parse(JSON.stringify(stored, jsonReplacer)).createdAt, timestamp.toISOString());
});
