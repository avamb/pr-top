// Track N (audit wave 3) bot tests — node:test, self-contained.
// Part 1: pure helpers exported by src/bot/src/index.js (no token -> no bot).
// Part 2: handler behaviour with a fake node-telegram-bot-api injected into
//         the require cache and the backend API (axios instance) stubbed.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const EventEmitter = require('events');

// The bot module leaves timers behind: exit once the last test is done.
test.after(() => { setTimeout(() => process.exit(process.exitCode || 0), 300).unref(); });

const BOT_DIR = path.resolve(__dirname, '..');
const INDEX = path.join(BOT_DIR, 'src', 'index.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'trackN-bot-'));
process.chdir(TMP); // dotenv finds no .env here
process.env.NODE_ENV = 'test';
process.env.BOT_API_KEY = 'test-bot-api-key-xxxxxxxxxxxxxx';
process.env.BOT_HEARTBEAT_FILE = path.join(TMP, 'bot-heartbeat');

function freshRequire(withToken) {
  for (const k of Object.keys(require.cache)) if (k.startsWith(path.join(BOT_DIR, 'src'))) delete require.cache[k];
  if (withToken) process.env.TELEGRAM_BOT_TOKEN = '123456:TEST_TOKEN_abcdefghijklmnopqrstuvwxyz';
  else delete process.env.TELEGRAM_BOT_TOKEN;
  const origLog = console.log, origErr = console.error;
  console.log = () => {}; console.error = () => {};
  try { return require(INDEX); } finally { console.log = origLog; console.error = origErr; }
}

// ------------------------------------------------------------ Part 1
const helpers = freshRequire(false);
const { messages } = require(path.join(BOT_DIR, 'src', 'i18n.js'));

test('M22: TTL state expires entries, keeps object syntax, is size-bounded and swept', async () => {
  const s = helpers.createTtlState('t1', { ttlMs: 50, maxEntries: 3 });
  s[1] = 'a';
  assert.equal(s[1], 'a');
  assert.equal(s['1'], 'a', 'number and string keys are the same key');
  assert.ok(1 in s);
  delete s[1];
  assert.equal(s[1], undefined);
  s.a = 1; s.b = 2; s.c = 3; s.d = 4;
  assert.equal(s.a, undefined, 'oldest entry evicted at maxEntries');
  assert.equal(s.d, 4);
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(s.d, undefined, 'expired after ttl');
  s.e = { x: 1 };
  assert.ok(helpers.sweepAllStates(Date.now() + 1000) >= 1, 'sweep removes expired entries');
  assert.equal(s.e, undefined);
});

test('Review: touchOnRead extends the TTL while the user is active', async () => {
  const s2 = helpers.createTtlState('touch', { ttlMs: 60, touchOnRead: true });
  s2.x = 1;
  for (let k = 0; k < 4; k++) { await new Promise((r) => setTimeout(r, 30)); assert.equal(s2.x, 1, 'read keeps it alive'); }
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(s2.x, undefined, 'expires once untouched');
});

test('M24: size helpers', () => {
  assert.equal(helpers.MAX_TELEGRAM_DOWNLOAD_BYTES, 20 * 1024 * 1024);
  assert.equal(helpers.isFileTooLarge(20 * 1024 * 1024), false);
  assert.equal(helpers.isFileTooLarge(20 * 1024 * 1024 + 1), true);
  assert.equal(helpers.isFileTooLarge(undefined), false, 'unknown size is not rejected up front');
  assert.equal(helpers.isPayloadTooLargeError({ response: { status: 413, data: {} } }), true);
  assert.equal(helpers.isPayloadTooLargeError({ response: { status: 400, data: { code: 'FILE_TOO_LARGE' } } }), true);
  assert.equal(helpers.isPayloadTooLargeError({ response: { status: 500, data: { code: 'X' } } }), false);
  assert.equal(helpers.isPayloadTooLargeError(new Error('network')), false);
});

test('M24: media semaphore never runs more than its limit', async () => {
  const sem = helpers.createSemaphore(2);
  let running = 0, peak = 0;
  const job = () => sem.run(async () => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 20)); running--; });
  await Promise.all([job(), job(), job(), job(), job()]);
  assert.equal(peak, 2);
});

test('L: localized exercise fields fall back to English', () => {
  const ex = { title_en: 'Breathe', title_uk: 'Дихання', instructions_en: 'Do it' };
  assert.equal(helpers.localizedField(ex, 'title', 'uk'), 'Дихання');
  assert.equal(helpers.localizedField(ex, 'title', 'es'), 'Breathe');
  assert.equal(helpers.localizedField(ex, 'instructions', 'ru'), 'Do it');
});

test('L: menu commands exist in all 4 languages; new i18n keys present everywhere', () => {
  const en = helpers.buildMenuCommands('en');
  const ru = helpers.buildMenuCommands('ru');
  assert.equal(en.length, 10);
  for (const lang of ['en', 'ru', 'es', 'uk']) {
    for (const c of helpers.buildMenuCommands(lang)) assert.ok(c.description && c.description.length <= 256, `${lang}/${c.command}`);
  }
  assert.notEqual(en[0].description, ru[0].description);
  const keys = ['consentStale', 'consentLinkedIntro', 'consentDeclinedUnlinked', 'exerciseConsentRevoked', 'mediaTooLarge',
    'mediaDownloadFailed', 'shareEmailCodeSent', 'shareEmailCodeReminder', 'shareEmailCodeInvalid', 'shareEmailCodeExpired',
    'shareEmailCodeRateLimited', 'settingsLoadFailed', 'settingsUpdateFailed', 'actionFailedRetry', 'otherInfoTooLong',
    'diaryNoContent', 'exerciseFallbackTitle', 'assignmentFallbackTitle', 'therapistFallbackName', 'forwardCaptionVoice', 'forwardCaptionVideo'];
  for (const lang of ['en', 'ru', 'es', 'uk']) {
    for (const k of keys) {
      assert.ok(messages[lang][k] !== undefined, `${lang}.${k}`);
      assert.equal(typeof messages[lang][k], typeof messages.en[k], `${lang}.${k} type`);
    }
  }
});

test('Heartbeat file is written', () => {
  const f = path.join(TMP, 'hb-test');
  helpers.writeHeartbeat(f);
  const age = Date.now() - fs.statSync(f).mtimeMs;
  assert.ok(age < 5000);
  assert.equal(helpers.HEARTBEAT_FILE, process.env.BOT_HEARTBEAT_FILE);
});

// ------------------------------------------------------------ Part 2
// Fake Telegram bot: records everything, lets the test emit updates.
const sent = [];
const answers = [];
let getFileCalls = 0;
let commandsSet = [];
class FakeBot extends EventEmitter {
  constructor() { super(); this.textHandlers = []; this._polling = { _lastUpdate: Date.now() }; }
  onText(re, cb) { this.textHandlers.push([re, cb]); }
  async sendMessage(chatId, text, opts) { sent.push({ chatId, text, opts }); return { message_id: sent.length }; }
  async answerCallbackQuery(id, opts) { answers.push({ id, opts }); }
  async editMessageReplyMarkup() { return true; }
  async editMessageText() { return true; }
  async setMyCommands(cmds, form) { commandsSet.push({ cmds, form }); }
  async setMyShortDescription() {}
  async setMyDescription() {}
  async getFile() { getFileCalls++; return { file_path: 'voice/file.ogg' }; }
  async sendVoice() {}
  async sendVideo() {}
  async stopPolling() {}
  async startPolling() {}
  isPolling() { return true; }
}
let bot;
let botModule;
const apiCalls = [];
let apiImpl = {};

test('bot handlers (fake Telegram)', async (t) => {
  const tgPath = require.resolve(path.join(BOT_DIR, 'node_modules', 'node-telegram-bot-api'));
  require.cache[tgPath] = { id: tgPath, filename: tgPath, loaded: true, exports: function (token, opts) { bot = new FakeBot(token, opts); return bot; } };
  botModule = freshRequire(true);
  const api = botModule.api;
  for (const m of ['get', 'post', 'put']) {
    api[m] = async (url, body) => {
      apiCalls.push({ m, url, body });
      const fn = apiImpl[`${m} ${url}`] || Object.entries(apiImpl).find(([k]) => k.endsWith('*') && `${m} ${url}`.startsWith(k.slice(0, -1)))?.[1];
      if (!fn) { const e = new Error('no stub for ' + m + ' ' + url); e.response = { status: 404, data: {} }; throw e; }
      return fn(body);
    };
  }
  const flush = () => new Promise((r) => setTimeout(r, 30));
  const reset = () => { sent.length = 0; answers.length = 0; apiCalls.length = 0; apiImpl = {}; getFileCalls = 0; };
  const clientUser = (extra) => ({ data: { user: Object.assign({ id: 5, role: 'client', language: 'en', therapist_id: null, consent_therapist_access: false, consent_version: 0 }, extra) } });
  const cbq = (from, data) => ({ id: 'cb' + Math.random(), from: { id: from }, data, message: { message_id: 77, chat: { id: from, type: 'private' } } });
  const textMsg = (from, text) => ({ from: { id: from }, chat: { id: from, type: 'private' }, text });

  await flush();
  await t.test('L: setMyCommands sent per language', () => {
    const langs = commandsSet.map((c) => c.form.language_code).filter(Boolean).sort();
    assert.deepEqual(langs, ['en', 'es', 'ru', 'uk']);
    const ru = commandsSet.find((c) => c.form.language_code === 'ru');
    assert.equal(ru.cmds.find((c) => c.command === 'sos').description, messages.ru.cmdSos);
  });

  await t.test('M22: stale consent button after restart -> "send /start again", nothing posted', async () => {
    reset();
    apiImpl['get /api/bot/user/1001'] = () => clientUser();
    bot.emit('callback_query', cbq(1001, 'consent_continue_42'));
    await flush();
    assert.ok(sent.some((s) => s.text === messages.en.consentStale));
    assert.ok(answers.some((a) => a.opts && a.opts.text === messages.en.consentStale));
    assert.ok(!apiCalls.some((c) => c.url === '/api/bot/consent'));
  });

  await t.test('M7: legacy consent_yes_<id> is not honoured', async () => {
    reset();
    apiImpl['get /api/bot/user/1002'] = () => clientUser();
    bot.emit('callback_query', cbq(1002, 'consent_yes_42'));
    await flush();
    assert.ok(!apiCalls.some((c) => c.url === '/api/bot/consent'));
    assert.ok(sent.some((s) => s.text === messages.en.consentStale));
  });

  await t.test('Review: linked Cancel asks "Disconnect?"; Back reopens the prompt; only Yes unlinks', async () => {
    reset();
    apiImpl['get /api/bot/user/1003'] = () => clientUser({ therapist_id: 42, consent_therapist_access: false });
    apiImpl['get /api/bot/therapist-display/42'] = () => ({ data: { display_name: 'Dr Who', available: true } });
    bot.emit('message', textMsg(1003, 'hello diary'));
    await flush();
    assert.ok(sent.some((s) => s.text === messages.en.consentLinkedIntro), 'linked intro shown');
    assert.ok(!apiCalls.some((c) => c.url === '/api/bot/diary'), 'diary not saved before consent');
    apiImpl['post /api/bot/consent'] = () => ({ data: { linked: false } });
    apiImpl['post /api/bot/revoke-consent'] = () => ({ data: { revoked: true } });
    bot.emit('callback_query', cbq(1003, 'consent_cancel_42'));
    await flush();
    assert.ok(!apiCalls.some((c) => c.url === '/api/bot/revoke-consent'), 'Cancel alone does not unlink');
    const confirm = sent.find((s) => s.text === messages.en.linkedDisconnectConfirm('Dr Who'));
    assert.ok(confirm, 'confirmation asked');
    const btns = confirm.opts.reply_markup.inline_keyboard[0].map((b) => b.callback_data);
    assert.deepEqual(btns, ['linked_disconnect_yes_42', 'linked_disconnect_back_42']);

    sent.length = 0;
    bot.emit('callback_query', cbq(1003, 'linked_disconnect_back_42'));
    await flush();
    assert.ok(sent.some((s) => s.text === messages.en.consentLinkedIntro), 'Back reopens the consent prompt');
    assert.ok(!apiCalls.some((c) => c.url === '/api/bot/revoke-consent'));

    bot.emit('callback_query', cbq(1003, 'linked_disconnect_yes_42'));
    await flush();
    assert.ok(apiCalls.some((c) => c.url === '/api/bot/revoke-consent'), 'Yes -> revoke-consent');
    assert.ok(sent.some((s) => s.text === messages.en.consentDeclinedUnlinked));
  });

  await t.test('Review: "Yes, disconnect" for a therapist the client is no longer linked to does nothing', async () => {
    reset();
    apiImpl['get /api/bot/user/1010'] = () => clientUser({ therapist_id: 99, consent_therapist_access: false });
    bot.emit('callback_query', cbq(1010, 'linked_disconnect_yes_42'));
    await flush();
    assert.ok(!apiCalls.some((c) => c.url === '/api/bot/revoke-consent'));
    assert.ok(sent.some((s) => s.text === messages.en.consentStale));
  });

  await t.test('Review: declining a re-consent prompt keeps the link and explains the pause', async () => {
    reset();
    apiImpl['get /api/bot/user/1004'] = () => clientUser({ therapist_id: 43, consent_therapist_access: true, consent_version: 1 });
    apiImpl['get /api/bot/therapist-display/43'] = () => ({ data: { display_name: 'Dr X', available: true } });
    bot.emit('message', textMsg(1004, 'entry'));
    await flush();
    assert.ok(sent.some((s) => s.text === messages.en.consentReprompt));
    apiImpl['post /api/bot/consent'] = () => ({ data: { linked: false } });
    apiImpl['post /api/bot/revoke-consent'] = () => ({ data: { revoked: true } });
    bot.emit('callback_query', cbq(1004, 'consent_cancel_43'));
    await flush();
    assert.ok(!apiCalls.some((c) => c.url === '/api/bot/revoke-consent'), 'no unlink');
    assert.ok(apiCalls.some((c) => c.url === '/api/bot/consent' && c.body.consent === false), 'decline audited');
    assert.ok(sent.some((s) => s.text === messages.en.consentReconsentDeclined));
    sent.length = 0;
    bot.emit('message', textMsg(1004, 'another entry'));
    await flush();
    assert.ok(sent.some((s) => s.text === messages.en.consentReprompt), 'still gated: prompt shown again');
    assert.ok(!apiCalls.some((c) => c.url === '/api/bot/diary'));
  });

  await t.test('Review: a stale Cancel for another therapist leaves the current prompt alone', async () => {
    reset();
    apiImpl['get /api/bot/user/1011'] = () => clientUser({ therapist_id: 44, consent_therapist_access: true, consent_version: 1 });
    apiImpl['get /api/bot/therapist-display/44'] = () => ({ data: { display_name: 'Dr Y', available: true } });
    bot.emit('message', textMsg(1011, 'entry'));
    await flush();
    bot.emit('callback_query', cbq(1011, 'consent_cancel_7'));
    await flush();
    assert.ok(sent.some((s) => s.text === messages.en.consentStale));
    sent.length = 0;
    apiImpl['post /api/bot/consent'] = () => ({ data: { linked: true, reconsent: true } });
    for (const pt of ['storage', 'ai', 'supervision', 'revoke', 'encryption']) bot.emit('callback_query', cbq(1011, 'consent_chk_44_' + pt));
    await flush();
    bot.emit('callback_query', cbq(1011, 'consent_continue_44'));
    await flush();
    assert.ok(sent.some((s) => s.text === messages.en.consentReconfirmed), 'current prompt still works');
  });

  await t.test('Review: THERAPIST_UNAVAILABLE -> state cleared, localized message, disconnect offered', async () => {
    reset();
    apiImpl['get /api/bot/user/1012'] = () => clientUser({ therapist_id: 45, consent_therapist_access: false });
    apiImpl['get /api/bot/therapist-display/45'] = () => ({ data: { display_name: 'Dr Z', available: true } });
    bot.emit('message', textMsg(1012, 'entry'));
    await flush();
    for (const pt of ['storage', 'ai', 'supervision', 'revoke', 'encryption']) bot.emit('callback_query', cbq(1012, 'consent_chk_45_' + pt));
    await flush();
    apiImpl['post /api/bot/consent'] = () => { const e = new Error('403'); e.response = { status: 403, data: { code: 'THERAPIST_UNAVAILABLE', error: 'This therapist account is currently unavailable.' } }; throw e; };
    sent.length = 0;
    bot.emit('callback_query', cbq(1012, 'consent_continue_45'));
    await flush();
    const msg = sent.find((s) => s.text === messages.en.linkedTherapistUnavailable);
    assert.ok(msg, 'localized message, not raw backend English');
    assert.equal(msg.opts.reply_markup.inline_keyboard[0][0].callback_data, 'linked_disconnect_yes_45');
    sent.length = 0;
    bot.emit('callback_query', cbq(1012, 'consent_continue_45'));
    await flush();
    assert.ok(sent.some((s) => s.text === messages.en.consentStale), 'prompt state was cleared');
  });

  await t.test('Review: linked to a blocked therapist -> no impossible prompt, disconnect offered', async () => {
    reset();
    apiImpl['get /api/bot/user/1013'] = () => clientUser({ therapist_id: 46, consent_therapist_access: false });
    apiImpl['get /api/bot/therapist-display/46'] = () => ({ data: { display_name: 'Dr B', available: false } });
    bot.emit('message', textMsg(1013, 'entry'));
    await flush();
    assert.ok(sent.some((s) => s.text === messages.en.linkedTherapistUnavailable));
    assert.ok(!sent.some((s) => s.text === messages.en.consentLinkedIntro));
    assert.ok(!apiCalls.some((c) => c.url === '/api/bot/diary'));
  });

  await t.test('M24: voice over 20 MB rejected before download', async () => {
    reset();
    apiImpl['get /api/bot/user/1005'] = () => clientUser();
    bot.emit('voice', { from: { id: 1005 }, chat: { id: 1005, type: 'private' }, voice: { file_id: 'F', duration: 900, file_size: 25 * 1024 * 1024 } });
    await flush();
    assert.equal(getFileCalls, 0);
    assert.ok(sent.some((s) => s.text === messages.en.mediaTooLarge));
    assert.ok(!apiCalls.some((c) => c.url === '/api/bot/diary'));
  });

  await t.test('M24: failed download is reported, nothing saved', async () => {
    reset();
    apiImpl['get /api/bot/user/1006'] = () => clientUser();
    bot.getFile = async () => { getFileCalls++; return null; };
    bot.emit('voice', { from: { id: 1006 }, chat: { id: 1006, type: 'private' }, voice: { file_id: 'F', duration: 5, file_size: 1000 } });
    await new Promise((r) => setTimeout(r, 1300)); // one retry with 1 s pause
    assert.ok(sent.some((s) => s.text.includes(messages.en.mediaDownloadFailed)));
    assert.ok(!apiCalls.some((c) => c.url === '/api/bot/diary'));
  });

  await t.test('Exercise answer after revoke -> localized message', async () => {
    reset();
    apiImpl['get /api/bot/user/1007'] = () => clientUser();
    apiImpl['get /api/bot/exercises/1007'] = () => ({ data: { exercises: [] } });
    apiImpl['post /api/bot/exercises/55/acknowledge'] = () => ({ data: {} });
    bot.emit('callback_query', cbq(1007, 'exercise_start_55'));
    await flush();
    apiImpl['post /api/bot/exercises/55/respond'] = () => { const e = new Error('403'); e.response = { status: 403, data: { code: 'CONSENT_REVOKED', error: 'x' } }; throw e; };
    bot.emit('message', textMsg(1007, 'my answer'));
    await flush();
    assert.ok(sent.some((s) => s.text === messages.en.exerciseConsentRevoked));
  });

  await t.test('M8: therapist email step waits for the mailed code', async () => {
    reset();
    apiImpl['get /api/bot/user/1008'] = () => ({ data: { user: { id: 9, role: 'therapist', language: 'en' } } });
    // phone (contact) is saved plainly; the email answers 202 pending
    apiImpl['put /api/bot/profile/1008'] = (body) => body && body.email ? ({ status: 202, data: { email_pending: true, ttl_min: 15 } }) : ({ data: {} });
    apiImpl['post /api/bot/register'] = () => ({ data: { already_existed: false, user: { role: 'therapist', invite_code: 'abc' } } });
    // role selection -> welcome + phone prompt; contact -> email prompt
    bot.emit('callback_query', cbq(1008, 'role_therapist'));
    await flush();
    bot.emit('contact', { from: { id: 1008 }, chat: { id: 1008, type: 'private' }, contact: { phone_number: '+100' } });
    await flush();
    bot.emit('message', textMsg(1008, 'me@example.com'));
    await flush();
    const putEmail = apiCalls.find((c) => c.m === 'put' && c.body && c.body.email);
    assert.ok(putEmail, 'email sent to backend as pending');
    assert.ok(sent.some((s) => s.text === messages.en.shareEmailCodeSent('me@example.com', 15)));
    apiImpl['post /api/bot/profile/1008/confirm-email'] = (body) => {
      if (body.code !== '123456') { const e = new Error('bad'); e.response = { status: 400, data: { code: 'CODE_INVALID', attempts_left: 4 } }; throw e; }
      return { data: { email: 'me@example.com' } };
    };
    bot.emit('message', textMsg(1008, '000000'));
    await flush();
    assert.ok(sent.some((s) => s.text === messages.en.shareEmailCodeInvalid(4)));
    bot.emit('message', textMsg(1008, '123456'));
    await flush();
    assert.ok(sent.some((s) => s.text === messages.en.shareEmailSaved));
    assert.ok(sent.some((s) => s.text === messages.en.shareOtherInfoPrompt), 'continues to the other-info step');
  });
});
