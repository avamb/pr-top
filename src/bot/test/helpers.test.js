'use strict';
// Unit tests for the pure helpers exported by src/index.js. The module is
// importable without a Telegram token (no polling starts). The repo .env is
// never read: dotenv looks in the CWD, so we move to an empty temp dir first
// and supply dummy values.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const entry = path.resolve(__dirname, '..', 'src', 'index.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prtop-bot-'));
process.chdir(tmp);
process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.BOT_API_KEY = 'test-bot-key-xxxxxxxx';
process.env.BACKEND_URL = 'http://127.0.0.1:1';

const { escapeMd, mdInEntity, stripMd, commandRegex, redact } = require(entry);

test.after(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* best effort */ } });

test('escapeMd escapes legacy-Markdown specials and tolerates null', () => {
  assert.strictEqual(escapeMd('a_b*c`d[e'), 'a\\_b\\*c\\`d\\[e');
  assert.strictEqual(escapeMd(null), '');
  assert.strictEqual(escapeMd(undefined), '');
  assert.strictEqual(escapeMd(42), '42');
  assert.strictEqual(escapeMd('plain text'), 'plain text');
});

test('mdInEntity swaps specials for look-alikes (no backslashes inside entities)', () => {
  const out = mdInEntity('a_b*c`d[e');
  assert.ok(!/[_*`\[\\]/.test(out), out);
  assert.strictEqual(out.length, 'a_b*c`d[e'.length);
  assert.strictEqual(mdInEntity(null), '');
  assert.strictEqual(mdInEntity('Anna'), 'Anna');
});

test('stripMd drops markers and unescapes escaped characters', () => {
  assert.strictEqual(stripMd('*bold* and `code`'), 'bold and code');
  assert.strictEqual(stripMd('snake\\_case'), 'snake_case');
  assert.strictEqual(stripMd(null), '');
});

test('commandRegex matches only anchored commands and captures arguments', () => {
  const re = commandRegex('sos');
  assert.ok(re.test('/sos'));
  assert.ok(re.test('/sos@MyBot'));
  const m = re.exec('/sos I need help');
  assert.ok(m && m[1] === 'I need help');
  assert.strictEqual(re.exec('/sos')[1], undefined);
  // A diary line mentioning the command must not trigger it.
  assert.ok(!re.test('he said /sos'));
  assert.ok(!re.test('/sosx'));
  assert.ok(!re.test('please /sos now'));
  assert.ok(commandRegex('start').test('/start abc123'));
});

test('redact hides the bot API key and token-shaped strings', () => {
  const key = process.env.BOT_API_KEY;
  assert.ok(!redact(`request failed with key ${key}`).includes(key));
  const tokenLike = 'bot1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  assert.ok(!redact(`GET https://api.telegram.org/${tokenLike}/getMe`).includes('AAAAAAAAAAAAAAAAAAAA'));
  assert.strictEqual(redact(undefined), '');
  assert.strictEqual(redact('nothing secret'), 'nothing secret');
});
