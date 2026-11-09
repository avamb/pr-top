/**
 * Feature #389 — Regression sweep: Telegram bot client interactions
 *
 * Verification steps:
 *   1. Connect a test client via invite code
 *   2. Send text, voice, and video diary entries
 *   3. Trigger SOS and confirm therapist receives multi-channel alert
 *   4. Complete an assigned exercise
 *   5. Verify bot replies in the client's chosen language (EN/RU/ES/UK)
 */

'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const BOT_API_KEY = process.env.BOT_API_KEY || 'dev-bot-api-key';
const BOT_HEADERS = { 'x-bot-api-key': BOT_API_KEY };

const SUFFIX = crypto.randomBytes(4).toString('hex').toUpperCase();
const T_EMAIL = `t389_therapist_${SUFFIX}@test.com`;
const PASSWORD = 'TestPass389!';

// Simulated Telegram IDs (large numbers unlikely to collide with existing rows)
const T_TID = String(10000000 + Math.floor(Math.random() * 8000000)); // therapist
const C_TID = String(20000000 + Math.floor(Math.random() * 8000000)); // client EN
const C_TID_RU = String(30000000 + Math.floor(Math.random() * 8000000));
const C_TID_ES = String(40000000 + Math.floor(Math.random() * 8000000));
const C_TID_UK = String(50000000 + Math.floor(Math.random() * 8000000));

let pass = 0;
let fail = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓  ${label}`);
    pass++;
  } else {
    console.error(`  ✗  ${label}${detail ? ' — ' + detail : ''}`);
    fail++;
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers
      }
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', d => { raw += d; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw), headers: res.headers }); }
        catch (e) { resolve({ status: res.statusCode, body: raw, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function get(path, token) {
  return request('GET', path, null, token ? { Authorization: `Bearer ${token}` } : {});
}

function post(path, body, token, extraHeaders = {}) {
  return request('POST', path, body,
    Object.assign({}, token ? { Authorization: `Bearer ${token}` } : {}, extraHeaders)
  );
}

function put(path, body, token, extraHeaders = {}) {
  return request('PUT', path, body,
    Object.assign({}, token ? { Authorization: `Bearer ${token}` } : {}, extraHeaders)
  );
}

// Bot API helpers
function botPost(path, body) {
  return request('POST', path, body, BOT_HEADERS);
}

function botGet(path) {
  return request('GET', path, null, BOT_HEADERS);
}

function botPut(path, body) {
  return request('PUT', path, body, BOT_HEADERS);
}

// Dev helpers — return rows as array-of-objects
async function dbQuery(sql, params = []) {
  const r = await post('/api/dev/db-query', { sql, params });
  if (r.status !== 200) throw new Error('db-query failed: ' + JSON.stringify(r.body));
  return r.body.rows || [];
}

// Audit query: filter by action + target_id (uses the /api/dev/audit-query endpoint)
async function auditRows(action, target_id) {
  const r = await post('/api/dev/audit-query', { action, target_id });
  if (r.status !== 200) throw new Error('audit-query failed: ' + JSON.stringify(r.body));
  return r.body.rows || [];
}

// ── Main audit ───────────────────────────────────────────────────────────────

async function run() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(' Feature #389 — Bot client interaction regression sweep');
  console.log('══════════════════════════════════════════════════════════\n');

  // ────────────────────────────────────────────────────────────────────────
  // SETUP: Register therapist via web API and get CSRF + JWT
  // ────────────────────────────────────────────────────────────────────────
  console.log('── SETUP: Therapist registration ──');

  const csrfR = await get('/api/csrf-token');
  const csrf = csrfR.body.csrfToken;
  assert('CSRF token obtained', csrf && csrf.length >= 32, csrf);

  const regR = await post('/api/auth/register',
    { email: T_EMAIL, password: PASSWORD },
    null,
    { 'X-CSRF-Token': csrf }
  );
  assert('Therapist registered (201)', regR.status === 201,
    `got ${regR.status}: ${JSON.stringify(regR.body).substring(0, 100)}`);
  const therapistToken = regR.body.token;
  const therapistDbId = regR.body.user?.id;
  assert('Therapist JWT returned', !!therapistToken);
  assert('Therapist DB id returned', !!therapistDbId, String(therapistDbId));

  // Get therapist's invite code
  const inviteR = await get('/api/invite-code', therapistToken);
  assert('Invite code retrieved (200)', inviteR.status === 200, `got ${inviteR.status}`);
  const inviteCode = inviteR.body.invite_code;
  assert('Invite code is 8 chars', inviteCode && inviteCode.length === 8, inviteCode);
  console.log(`  Invite code: ${inviteCode}`);

  // Link the web therapist account with a bot Telegram ID via dev endpoint
  const linkR = await post('/api/dev/set-telegram-id', { user_id: therapistDbId, telegram_id: T_TID });
  assert('Therapist telegram_id linked via dev endpoint', linkR.body.updated === true,
    JSON.stringify(linkR.body));
  console.log(`  Therapist DB id: ${therapistDbId}, TID: ${T_TID}`);

  // ────────────────────────────────────────────────────────────────────────
  // STEP 1: Connect test client via invite code
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n── STEP 1: Connect client via invite code ──');

  // Register client in bot
  const cRegR = await botPost('/api/bot/register', {
    telegram_id: C_TID,
    role: 'client',
    language: 'en',
    first_name: 'Test',
    last_name: `Client389_${SUFFIX}`
  });
  assert('Client bot register (200/201)', cRegR.status === 200 || cRegR.status === 201,
    `got ${cRegR.status}: ${JSON.stringify(cRegR.body).substring(0, 100)}`);

  // Connect client with invite code
  const connectR = await botPost('/api/bot/connect', {
    telegram_id: C_TID,
    invite_code: inviteCode
  });
  assert('Client connect returns 200', connectR.status === 200,
    `got ${connectR.status}: ${JSON.stringify(connectR.body).substring(0, 100)}`);
  assert('Connect requires_consent flag set', connectR.body.requires_consent === true);
  const foundTherapistId = connectR.body.therapist?.id;
  assert('Connect returns therapist id', !!foundTherapistId, String(foundTherapistId));
  assert('Connect found correct therapist', foundTherapistId === therapistDbId,
    `expected ${therapistDbId}, got ${foundTherapistId}`);

  // Grant consent (5-checkbox consent flow v1)
  const consentR = await botPost('/api/bot/consent', {
    telegram_id: C_TID,
    therapist_id: foundTherapistId,
    consent: true,
    consent_version: 1,
    consent_text_hash: crypto.createHash('sha256').update('consent-text-v1').digest('hex'),
    mode: 'connect'
  });
  assert('Consent granted (200)', consentR.status === 200,
    `got ${consentR.status}: ${JSON.stringify(consentR.body).substring(0, 100)}`);
  assert('Consent response has linked=true', consentR.body.linked === true);

  // Verify client is linked in DB via bot user endpoint
  const userR = await botGet(`/api/bot/user/${C_TID}`);
  assert('Client user fetch (200)', userR.status === 200, `got ${userR.status}`);
  assert('Client has therapist_id set', userR.body.user?.therapist_id === foundTherapistId,
    `therapist_id=${userR.body.user?.therapist_id}`);
  assert('Client has consent_therapist_access=true', userR.body.user?.consent_therapist_access === true);
  assert('Client language is en', userR.body.user?.language === 'en');
  assert('Client consent_version=1', userR.body.user?.consent_version === 1,
    `got ${userR.body.user?.consent_version}`);

  const clientDbId = userR.body.user?.id;
  console.log(`  Client DB id: ${clientDbId}, TID: ${C_TID}`);

  // Invalid invite code returns 404
  const badConnR = await botPost('/api/bot/connect', {
    telegram_id: C_TID,
    invite_code: 'BADCODE1'
  });
  assert('Invalid invite code returns 400/404', badConnR.status === 400 || badConnR.status === 404,
    `got ${badConnR.status}`);

  // ────────────────────────────────────────────────────────────────────────
  // STEP 2: Send text, voice, and video diary entries
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n── STEP 2: Diary entries (text / voice / video) ──');

  const TEXT_CONTENT = `T389_TEXT_DIARY_${SUFFIX}`;
  const VOICE_CONTENT = `T389_VOICE_TRANSCRIPT_${SUFFIX}`;

  // Text diary entry
  const textDiaryR = await botPost('/api/bot/diary', {
    telegram_id: C_TID,
    content: TEXT_CONTENT,
    entry_type: 'text'
  });
  assert('Text diary created (201)', textDiaryR.status === 201,
    `got ${textDiaryR.status}: ${JSON.stringify(textDiaryR.body).substring(0, 100)}`);
  assert('Text diary returns entry.id', !!textDiaryR.body.entry?.id);
  const textEntryId = textDiaryR.body.entry?.id;

  // Voice diary entry (small base64 audio simulation)
  const fakeAudioBase64 = Buffer.from('FAKE_AUDIO_BYTES_T389_' + SUFFIX).toString('base64');
  const voiceDiaryR = await botPost('/api/bot/diary', {
    telegram_id: C_TID,
    content: VOICE_CONTENT,
    entry_type: 'voice',
    file_data: fakeAudioBase64,
    file_ext: '.ogg'
  });
  assert('Voice diary created (201)', voiceDiaryR.status === 201,
    `got ${voiceDiaryR.status}: ${JSON.stringify(voiceDiaryR.body).substring(0, 100)}`);
  assert('Voice diary returns entry.id', !!voiceDiaryR.body.entry?.id);
  const voiceEntryId = voiceDiaryR.body.entry?.id;

  // Video diary entry (small base64 video simulation)
  const fakeVideoBase64 = Buffer.from('FAKE_VIDEO_BYTES_T389_' + SUFFIX).toString('base64');
  const videoDiaryR = await botPost('/api/bot/diary', {
    telegram_id: C_TID,
    content: 'T389_VIDEO_PLACEHOLDER_' + SUFFIX,
    entry_type: 'video',
    file_data: fakeVideoBase64,
    file_ext: '.mp4'
  });
  assert('Video diary created (201)', videoDiaryR.status === 201,
    `got ${videoDiaryR.status}: ${JSON.stringify(videoDiaryR.body).substring(0, 100)}`);
  assert('Video diary returns entry.id', !!videoDiaryR.body.entry?.id);
  const videoEntryId = videoDiaryR.body.entry?.id;

  // Verify all 3 entries visible to therapist via dashboard API
  const diaryListR = await get(`/api/clients/${clientDbId}/diary`, therapistToken);
  assert('Therapist can fetch client diary (200)', diaryListR.status === 200,
    `got ${diaryListR.status}`);
  const entries = diaryListR.body.entries || [];
  const textEntry = entries.find(e => e.id === textEntryId);
  assert('Text diary entry appears in therapist view', !!textEntry,
    `entries: ${entries.map(e => e.id).join(',')}`);
  assert('Text diary entry decrypts correctly', textEntry?.content === TEXT_CONTENT,
    `got: "${textEntry?.content}"`);
  const voiceEntry = entries.find(e => e.id === voiceEntryId);
  assert('Voice diary entry appears in therapist view', !!voiceEntry);
  assert('Voice diary entry has type=voice', voiceEntry?.entry_type === 'voice');
  const videoEntry = entries.find(e => e.id === videoEntryId);
  assert('Video diary entry appears in therapist view', !!videoEntry);
  assert('Video diary entry has type=video', videoEntry?.entry_type === 'video');

  // DB: Class A data must be encrypted
  const rawDiary = await dbQuery(
    'SELECT id, content_encrypted, entry_type FROM diary_entries WHERE client_id = ? ORDER BY id DESC LIMIT 10',
    [clientDbId]
  );
  const textRow = rawDiary.find(r => r.id === textEntryId);
  assert('Text diary DB column is ciphertext (not plaintext)',
    textRow && textRow.content_encrypted && !textRow.content_encrypted.includes(TEXT_CONTENT),
    `raw: ${String(textRow && textRow.content_encrypted).substring(0, 40)}`);
  assert('Text diary ciphertext has colon separator (format N:iv:tag:ct)',
    textRow && typeof textRow.content_encrypted === 'string' && textRow.content_encrypted.includes(':'));
  const voiceRow = rawDiary.find(r => r.id === voiceEntryId);
  assert('Voice diary has type=voice in DB', voiceRow && voiceRow.entry_type === 'voice');
  const videoRow = rawDiary.find(r => r.id === videoEntryId);
  assert('Video diary has type=video in DB', videoRow && videoRow.entry_type === 'video');

  // Bot diary history endpoint (/api/bot/diary/:telegram_id)
  const histR = await botGet(`/api/bot/diary/${C_TID}`);
  assert('Bot diary history endpoint (200)', histR.status === 200,
    `got ${histR.status}`);
  const botEntries = histR.body.entries || histR.body.diary || [];
  assert('Bot diary history returns >= 3 entries', botEntries.length >= 3,
    `found ${botEntries.length}`);

  // Therapist on non-client should get 403/404 (no cross-client leak)
  const wrongClientR = await get(`/api/clients/99999/diary`, therapistToken);
  assert('Cross-client diary access blocked (403/404)', wrongClientR.status === 403 || wrongClientR.status === 404,
    `got ${wrongClientR.status}`);

  // ────────────────────────────────────────────────────────────────────────
  // STEP 3: Trigger SOS and confirm therapist receives multi-channel alert
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n── STEP 3: SOS trigger and multi-channel alert ──');

  const SOS_MSG = `T389_SOS_MESSAGE_${SUFFIX}`;
  const sosR = await botPost('/api/bot/sos', {
    telegram_id: C_TID,
    message: SOS_MSG
  });
  assert('SOS triggered (201)', sosR.status === 201,
    `got ${sosR.status}: ${JSON.stringify(sosR.body).substring(0, 100)}`);
  assert('SOS returns sos_event object', !!sosR.body.sos_event);
  const sosId = sosR.body.sos_event?.id;
  assert('SOS event has id', !!sosId, String(sosId));
  assert('SOS event status is triggered', sosR.body.sos_event?.status === 'triggered');
  assert('SOS event has correct client_id', sosR.body.sos_event?.client_id === clientDbId,
    `got ${sosR.body.sos_event?.client_id}`);
  assert('SOS event has correct therapist_id', sosR.body.sos_event?.therapist_id === foundTherapistId,
    `got ${sosR.body.sos_event?.therapist_id}`);

  // DB: SOS message is Class A encrypted
  const sosDbRows = await dbQuery(
    'SELECT id, client_id, therapist_id, message_encrypted, status FROM sos_events WHERE id = ?',
    [sosId]
  );
  assert('SOS DB row exists', sosDbRows.length > 0);
  const sosRow = sosDbRows[0];
  assert('SOS message is encrypted (not plaintext)', sosRow.message_encrypted && !sosRow.message_encrypted.includes(SOS_MSG),
    `raw: ${String(sosRow.message_encrypted).substring(0, 40)}`);
  assert('SOS message ciphertext has colon format', sosRow.message_encrypted && String(sosRow.message_encrypted).includes(':'));
  assert('SOS DB status=triggered', sosRow.status === 'triggered');

  // Audit log: sos_triggered entry created
  const sosAuditRows = await auditRows('sos_triggered', sosId);
  assert('SOS audit log: sos_triggered entry', sosAuditRows.length > 0);

  // Audit log: sos_notification_sent entry (multi-channel alert dispatched)
  const sosNotifRows = await auditRows('sos_notification_sent', sosId);
  assert('SOS audit log: sos_notification_sent entry (multi-channel alert)', sosNotifRows.length > 0,
    'Multi-channel notification dispatch record missing');

  // SOS deduplication: rapid second SOS within 30s should be deduplicated (200)
  const sosDedupR = await botPost('/api/bot/sos', {
    telegram_id: C_TID,
    message: SOS_MSG + '_DEDUP'
  });
  assert('Rapid second SOS is deduplicated (200 not 201)', sosDedupR.status === 200,
    `got ${sosDedupR.status}`);
  assert('Dedup response has deduplicated=true', sosDedupR.body.deduplicated === true);

  // Therapist views SOS events via dashboard
  const sosListR = await get(`/api/clients/${clientDbId}/sos`, therapistToken);
  assert('Therapist can view SOS events (200)', sosListR.status === 200,
    `got ${sosListR.status}`);
  const sosList = sosListR.body.sos_events || [];
  const ourSos = sosList.find(s => s.id === sosId);
  assert('SOS event appears in therapist dashboard', !!ourSos);

  // Non-authed SOS endpoint → 401
  const unauthSosR = await request('GET', `/api/clients/${clientDbId}/sos`, null, {});
  assert('Unauthenticated SOS list → 401', unauthSosR.status === 401,
    `got ${unauthSosR.status}`);

  // ────────────────────────────────────────────────────────────────────────
  // STEP 4: Complete an assigned exercise
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n── STEP 4: Exercise assignment and completion ──');

  // Get available exercises (pre-seeded library)
  const exerciseLibR = await get('/api/exercises', therapistToken);
  assert('Exercise library reachable (200)', exerciseLibR.status === 200,
    `got ${exerciseLibR.status}`);
  const exercises = exerciseLibR.body.exercises || [];
  assert('Exercise library has at least one exercise', exercises.length > 0,
    `found ${exercises.length}`);
  const exerciseId = exercises[0].id;
  const exerciseTitle = exercises[0].title_en || exercises[0].title_ru || 'Test Exercise';
  console.log(`  Sending exercise id=${exerciseId}: "${exerciseTitle}"`);

  // Therapist sends exercise to client (Bearer auth bypasses CSRF requirement)
  const sendExR = await post(
    `/api/clients/${clientDbId}/exercises`,
    { exercise_id: exerciseId },
    therapistToken
  );
  assert('Therapist sends exercise (201)', sendExR.status === 201,
    `got ${sendExR.status}: ${JSON.stringify(sendExR.body).substring(0, 120)}`);
  const deliveryId = sendExR.body.delivery?.id;
  assert('Exercise delivery id returned', !!deliveryId, String(deliveryId));

  // Client lists exercises via bot — should see pending exercise
  const clientExR = await botGet(`/api/bot/exercises/${C_TID}`);
  assert('Client gets exercise list (200)', clientExR.status === 200,
    `got ${clientExR.status}`);
  const allDeliveries = clientExR.body.exercises || [];
  const ourDelivery = allDeliveries.find(e => e.delivery_id === deliveryId);
  assert('Assigned exercise appears in client list', !!ourDelivery,
    `delivery ids: ${allDeliveries.map(e => e.delivery_id).join(',')}`);
  assert('Exercise status is sent', ourDelivery?.status === 'sent');
  assert('Pending count >= 1', clientExR.body.pending_count >= 1,
    `pending_count=${clientExR.body.pending_count}`);

  // Client acknowledges exercise → status becomes acknowledged
  const ackR = await botPost(`/api/bot/exercises/${deliveryId}/acknowledge`, {
    telegram_id: C_TID
  });
  assert('Client acknowledges exercise (200)', ackR.status === 200,
    `got ${ackR.status}: ${JSON.stringify(ackR.body).substring(0, 100)}`);
  assert('Acknowledge sets status=acknowledged', ackR.body.status === 'acknowledged');

  // Client responds (completes) exercise
  const RESPONSE_TEXT = `T389_EXERCISE_RESPONSE_${SUFFIX}`;
  const respondR = await botPost(`/api/bot/exercises/${deliveryId}/respond`, {
    telegram_id: C_TID,
    response_text: RESPONSE_TEXT
  });
  assert('Client completes exercise (200)', respondR.status === 200,
    `got ${respondR.status}: ${JSON.stringify(respondR.body).substring(0, 100)}`);
  assert('Completion sets status=completed', respondR.body.status === 'completed');
  assert('Response_encrypted flag is true', respondR.body.response_encrypted === true);

  // Therapist can view completed exercise (endpoint returns { deliveries: [...] })
  const tExListR = await get(`/api/clients/${clientDbId}/exercises`, therapistToken);
  assert('Therapist can view exercise deliveries (200)', tExListR.status === 200,
    `got ${tExListR.status}`);
  const tExList = tExListR.body.deliveries || [];
  const completedEx = tExList.find(e => e.id === deliveryId);
  assert('Exercise shows completed in therapist view', completedEx?.status === 'completed',
    `status=${completedEx?.status}`);

  // DB: response must be encrypted
  const exDbRows = await dbQuery(
    'SELECT id, status, response_encrypted FROM exercise_deliveries WHERE id = ?',
    [deliveryId]
  );
  assert('Exercise DB row found', exDbRows.length > 0);
  const exRow = exDbRows[0];
  assert('Exercise DB status=completed', exRow.status === 'completed');
  assert('Exercise response_encrypted is ciphertext (not plaintext)',
    exRow.response_encrypted && !String(exRow.response_encrypted).includes(RESPONSE_TEXT));

  // Audit log: exercise_completed
  const exAuditRows = await auditRows('exercise_completed', deliveryId);
  assert('Exercise completion in audit log', exAuditRows.length > 0);

  // Double-complete should not error (idempotency graceful)
  const respondR2 = await botPost(`/api/bot/exercises/${deliveryId}/respond`, {
    telegram_id: C_TID,
    response_text: 'SECOND_RESPONSE'
  });
  assert('Double-complete exercise does not crash (2xx/4xx)', respondR2.status >= 200 && respondR2.status < 500,
    `got ${respondR2.status}`);

  // ────────────────────────────────────────────────────────────────────────
  // STEP 5: Verify bot replies in client's chosen language (EN/RU/ES/UK)
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n── STEP 5: Language support (EN / RU / ES / UK) ──');

  // Register clients for RU, ES, UK
  const langClients = [
    { tid: C_TID_RU, lang: 'ru', label: 'RU' },
    { tid: C_TID_ES, lang: 'es', label: 'ES' },
    { tid: C_TID_UK, lang: 'uk', label: 'UK' },
  ];

  for (const lc of langClients) {
    const lrR = await botPost('/api/bot/register', {
      telegram_id: lc.tid,
      role: 'client',
      language: lc.lang,
      first_name: `T389`,
      last_name: `${lc.lang.toUpperCase()}_${SUFFIX}`
    });
    assert(`${lc.label}: bot register OK`, lrR.status === 200 || lrR.status === 201,
      `got ${lrR.status}`);

    // Fetch and verify language persisted
    const luR = await botGet(`/api/bot/user/${lc.tid}`);
    assert(`${lc.label}: user fetch (200)`, luR.status === 200, `got ${luR.status}`);
    assert(`${lc.label}: language stored = '${lc.lang}'`,
      luR.body.user?.language === lc.lang,
      `got '${luR.body.user?.language}'`);
  }

  // EN client (already registered) should still have language=en
  const enUserR = await botGet(`/api/bot/user/${C_TID}`);
  assert("EN: language stored = 'en'", enUserR.body.user?.language === 'en',
    `got '${enUserR.body.user?.language}'`);

  // DB verify: all 4 language values persisted correctly
  const langDbRows = await dbQuery(
    `SELECT telegram_id, language FROM users WHERE telegram_id IN (?, ?, ?, ?)`,
    [C_TID, C_TID_RU, C_TID_ES, C_TID_UK]
  );
  assert('All 4 language clients in DB', langDbRows.length === 4,
    `found ${langDbRows.length}`);
  const langMap = {};
  for (const r of langDbRows) { langMap[r.telegram_id] = r.language; }
  assert('EN client language=en in DB', langMap[C_TID] === 'en');
  assert('RU client language=ru in DB', langMap[C_TID_RU] === 'ru');
  assert('ES client language=es in DB', langMap[C_TID_ES] === 'es');
  assert('UK client language=uk in DB', langMap[C_TID_UK] === 'uk');

  // Load bot i18n module and verify key messages in all 4 languages
  const i18n = require('./src/bot/src/i18n.js');
  const t = i18n.t;
  assert('i18n module exports t() function', typeof t === 'function');

  const testKeys = ['diarySaved', 'sosConfirmed', 'exerciseCompleted', 'connected',
                    'voiceSaved', 'videoSaved', 'helpClient'];
  const langs = ['en', 'ru', 'es', 'uk'];

  for (const key of testKeys) {
    const values = langs.map(l => t(l, key));
    const allDefined = values.every(v => v && typeof v === 'string' && v.length > 0);
    assert(`i18n key '${key}' defined in all 4 languages`, allDefined,
      `values: ${values.map(v => (v || '').substring(0, 20)).join(' | ')}`);

    // EN and RU (at minimum) must differ — ensures real translations, not fallback-only
    const enVal = t('en', key);
    const ruVal = t('ru', key);
    assert(`i18n key '${key}' EN != RU (real translation)`, enVal !== ruVal,
      `both = '${String(enVal).substring(0, 30)}'`);
  }

  // Function-based i18n keys (take arguments)
  // Note: t(lang, key) returns the raw value — callers must invoke it if it's a function
  const fnKeyTests = [
    { key: 'welcomeBack', args: ['client'] },
    { key: 'alreadyRegistered', args: ['client'] },
    { key: 'welcomeTherapist', args: ['ABCD1234'] },
  ];
  for (const { key, args } of fnKeyTests) {
    for (const lang of langs) {
      const raw = t(lang, key);
      const val = typeof raw === 'function' ? raw(...args) : raw;
      assert(`i18n fn key '${key}' (${lang}) callable and returns non-empty string`,
        val && typeof val === 'string' && val.length > 5,
        `got: '${String(val).substring(0, 30)}'`);
    }
  }

  // Profile PUT does NOT support language field (by design — language is set at registration)
  const profPutBadR = await botPut(`/api/bot/profile/${C_TID_RU}`, { language: 'ru' });
  assert('PUT /profile with unsupported language field returns 400', profPutBadR.status === 400,
    `got ${profPutBadR.status}`);

  // Language still persists from original registration (not changed by profile PUT)
  const afterPutR = await botGet(`/api/bot/user/${C_TID_RU}`);
  assert('Language still correct after failed profile PUT', afterPutR.body.user?.language === 'ru',
    `got '${afterPutR.body.user?.language}'`);

  // ────────────────────────────────────────────────────────────────────────
  // STEP 5b: Bot sessions listing endpoint
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n── STEP 5b: Bot sessions endpoint ──');

  const sessionsR = await botGet(`/api/bot/sessions/${C_TID}`);
  assert('Bot sessions endpoint (200)', sessionsR.status === 200,
    `got ${sessionsR.status}: ${JSON.stringify(sessionsR.body).substring(0, 80)}`);
  // No sessions yet for this new client — just verify the endpoint responds correctly
  assert('Bot sessions response has sessions array',
    Array.isArray(sessionsR.body.sessions || sessionsR.body.data || sessionsR.body),
    `type: ${typeof sessionsR.body}`);

  // ────────────────────────────────────────────────────────────────────────
  // STEP 5c: Mock-data grep — no stub patterns in bot source files
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n── STEP 5c: Mock-data pattern check ──');

  const MOCK_PATTERNS = ['globalThis', 'devStore', 'dev-store', 'mockDb', 'mockData',
    'fakeData', 'sampleData', 'dummyData', 'isDevelopment', 'isDev'];

  const botRouteContent = fs.readFileSync('./src/backend/src/routes/bot.js', 'utf8');
  const botIndexContent = fs.readFileSync('./src/bot/src/index.js', 'utf8');
  const i18nContent = fs.readFileSync('./src/bot/src/i18n.js', 'utf8');

  for (const pat of MOCK_PATTERNS) {
    const re = new RegExp(pat);
    const inBotRoute = re.test(botRouteContent);
    const inBotIndex = re.test(botIndexContent);
    const inI18n = re.test(i18nContent);
    assert(`No '${pat}' pattern in bot source files`,
      !inBotRoute && !inBotIndex && !inI18n,
      `found in: ${[inBotRoute && 'routes/bot.js', inBotIndex && 'bot/index.js', inI18n && 'i18n.js'].filter(Boolean).join(', ')}`);
  }

  // ────────────────────────────────────────────────────────────────────────
  // RESULTS
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(` Results: ${pass} passed, ${fail} failed`);
  console.log('══════════════════════════════════════════════════════════\n');

  if (fail > 0) process.exit(1);
}

run().catch(err => {
  console.error('\nFATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
