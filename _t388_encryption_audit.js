/**
 * Feature #388 – Regression sweep: encryption at application layer (Class A data)
 *
 * Verification steps:
 *   1. Inspect SQLite rows directly — Class A columns must be ciphertext
 *   2. Write a new diary entry via bot API, read via dashboard, confirm round-trip
 *   3. Confirm Class B metadata (timestamps, IDs) remains plaintext for queries
 *   4. Verify key rotation path still works
 *   5. Confirm encrypted file storage uses opaque IDs and signed-access streaming
 */

'use strict';

const http = require('http');
const crypto = require('crypto');

const BASE = 'http://localhost:3001';
const BOT_API_KEY = process.env.BOT_API_KEY || 'dev-bot-api-key';
const SUFFIX = crypto.randomBytes(4).toString('hex').toUpperCase();
const T_EMAIL = `t388_therapist_${SUFFIX}@test.com`;
const C_EMAIL = `t388_client_${SUFFIX}@test.com`;
const PASSWORD = 'TestPass123!';
const DIARY_TEXT = `T388_PLAINTEXT_CHECK_${SUFFIX}`;
const NOTE_TEXT = `T388_NOTE_${SUFFIX}`;

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

async function get(path, token) {
  return request('GET', path, null, token ? { Authorization: `Bearer ${token}` } : {});
}

async function post(path, body, token, extraHeaders = {}) {
  return request('POST', path, body,
    Object.assign({},
      token ? { Authorization: `Bearer ${token}` } : {},
      extraHeaders
    )
  );
}

async function dbQuery(sql, params = []) {
  const r = await post('/api/dev/db-query', { sql, params });
  if (r.status !== 200) throw new Error(`db-query failed: ${JSON.stringify(r.body)}`);
  return r.body.rows || [];
}

// ── Encryption format check ──────────────────────────────────────────────────
// Packed format: "version:ivB64:authTagB64:ciphertext"
// version is a small integer; components are base64.
function looksLikeCiphertext(val) {
  if (!val || typeof val !== 'string') return false;
  const parts = val.split(':');
  if (parts.length !== 4) return false;
  const version = parseInt(parts[0], 10);
  if (isNaN(version) || version < 1) return false;
  // iv should decode to ~16 bytes (12-byte GCM iv = 16 base64 chars)
  try {
    const ivBuf = Buffer.from(parts[1], 'base64');
    if (ivBuf.length < 8) return false;
    const tagBuf = Buffer.from(parts[2], 'base64');
    if (tagBuf.length < 8) return false;
    // ciphertext should be non-empty base64
    if (parts[3].length === 0) return false;
    return true;
  } catch {
    return false;
  }
}

// ── Setup: register therapist + client ───────────────────────────────────────

let therapistJwt, therapistId;
let clientId, clientTelegramId;
let csrfToken;

async function setup() {
  console.log('\n=== SETUP: register test therapist + client ===');

  // Get CSRF token
  const csrfR = await get('/api/csrf-token');
  csrfToken = csrfR.body.csrfToken;
  assert('Got CSRF token', !!csrfToken);

  // Register therapist
  const regR = await post('/api/auth/register',
    { email: T_EMAIL, password: PASSWORD, name: `T388 Therapist ${SUFFIX}` },
    null, { 'X-CSRF-Token': csrfToken }
  );
  assert(`Therapist registered (${T_EMAIL})`, regR.status === 201, JSON.stringify(regR.body));
  therapistJwt = regR.body.token;
  therapistId = regR.body.user?.id;

  // Register client
  const regC = await post('/api/auth/register',
    { email: C_EMAIL, password: PASSWORD, name: `T388 Client ${SUFFIX}`, role: 'client' },
    null, { 'X-CSRF-Token': csrfToken }
  );
  // Client registration via web returns 400 (clients must use bot), so we use dev endpoint
  if (regC.status !== 201) {
    // Use dev/seed endpoint approach: create client directly
    const seedR = await post('/api/dev/seed-clients', { therapist_id: therapistId, count: 1 });
    assert('Client seeded via dev endpoint', seedR.status === 200, JSON.stringify(seedR.body));
    // Get the newly created client's id
    const clients = await dbQuery(
      'SELECT id FROM users WHERE therapist_id = ? AND role = \'client\' ORDER BY id DESC LIMIT 1',
      [therapistId]
    );
    clientId = clients[0]?.id;
  } else {
    clientId = regC.body.user?.id;
  }

  assert('Got therapist ID', !!therapistId, `therapistId=${therapistId}`);
  assert('Got client ID', !!clientId, `clientId=${clientId}`);

  // Set consent so therapist can read client data
  const consentR = await post('/api/dev/set-consent', { client_id: clientId, consent: true });
  assert('Client consent enabled', consentR.status === 200);

  // Set a fake telegram_id on the client for bot API calls
  clientTelegramId = `388_${SUFFIX}`;
  const telegramR = await post('/api/dev/set-telegram-id', { user_id: clientId, telegram_id: clientTelegramId });
  assert('Client telegram_id set', telegramR.status === 200);

  // (Client already linked to therapist via seed endpoint)
}

// ── Step 1: Direct DB inspection — Class A columns must be ciphertext ────────

async function step1_dbInspection() {
  console.log('\n=== STEP 1: Direct DB row inspection — Class A must be ciphertext ===');

  // diary_entries: content_encrypted
  const diaryRows = await dbQuery(
    'SELECT id, content_encrypted, transcript_encrypted, client_id FROM diary_entries ORDER BY id DESC LIMIT 10'
  );
  console.log(`  Found ${diaryRows.length} diary entries`);

  let allDiaryEncrypted = true;
  for (const row of diaryRows) {
    if (row.content_encrypted && !looksLikeCiphertext(row.content_encrypted)) {
      allDiaryEncrypted = false;
      console.error(`  ✗  diary_entries row ${row.id}: content_encrypted is NOT ciphertext: "${String(row.content_encrypted).substring(0, 80)}"`);
    }
    if (row.transcript_encrypted && !looksLikeCiphertext(row.transcript_encrypted)) {
      allDiaryEncrypted = false;
      console.error(`  ✗  diary_entries row ${row.id}: transcript_encrypted is NOT ciphertext`);
    }
  }
  if (diaryRows.length > 0) {
    assert('diary_entries: all content_encrypted/transcript_encrypted are ciphertext', allDiaryEncrypted);
  } else {
    console.log('  ℹ  No diary entries found yet — will check after Step 2 write');
  }

  // therapist_notes: note_encrypted
  const noteRows = await dbQuery(
    'SELECT id, note_encrypted FROM therapist_notes ORDER BY id DESC LIMIT 10'
  );
  console.log(`  Found ${noteRows.length} therapist notes`);
  let allNotesEncrypted = true;
  for (const row of noteRows) {
    if (row.note_encrypted && !looksLikeCiphertext(row.note_encrypted)) {
      allNotesEncrypted = false;
      console.error(`  ✗  therapist_notes row ${row.id}: note_encrypted is NOT ciphertext: "${String(row.note_encrypted).substring(0, 80)}"`);
    }
  }
  if (noteRows.length > 0) {
    assert('therapist_notes: all note_encrypted are ciphertext', allNotesEncrypted);
  } else {
    console.log('  ℹ  No therapist notes yet — will write one in Step 2');
  }

  // sessions: transcript_encrypted, summary_encrypted
  const sessionRows = await dbQuery(
    'SELECT id, transcript_encrypted, summary_encrypted FROM sessions ORDER BY id DESC LIMIT 5'
  );
  console.log(`  Found ${sessionRows.length} sessions`);
  let allSessionsEncrypted = true;
  for (const row of sessionRows) {
    if (row.transcript_encrypted && !looksLikeCiphertext(row.transcript_encrypted)) {
      allSessionsEncrypted = false;
      console.error(`  ✗  sessions row ${row.id}: transcript_encrypted is NOT ciphertext`);
    }
    if (row.summary_encrypted && !looksLikeCiphertext(row.summary_encrypted)) {
      allSessionsEncrypted = false;
      console.error(`  ✗  sessions row ${row.id}: summary_encrypted is NOT ciphertext`);
    }
  }
  if (sessionRows.length > 0) {
    assert('sessions: all transcript_encrypted/summary_encrypted are ciphertext', allSessionsEncrypted);
  } else {
    console.log('  ℹ  No sessions with transcripts/summaries in DB');
  }

  // client_context: anamnesis_encrypted, current_goals_encrypted, etc.
  const ctxRows = await dbQuery(
    'SELECT id, anamnesis_encrypted, current_goals_encrypted, contraindications_encrypted, ai_instructions_encrypted FROM client_context ORDER BY id DESC LIMIT 5'
  );
  console.log(`  Found ${ctxRows.length} client_context rows`);
  let allCtxEncrypted = true;
  for (const row of ctxRows) {
    for (const field of ['anamnesis_encrypted', 'current_goals_encrypted', 'contraindications_encrypted', 'ai_instructions_encrypted']) {
      if (row[field] && !looksLikeCiphertext(row[field])) {
        allCtxEncrypted = false;
        console.error(`  ✗  client_context row ${row.id}: ${field} is NOT ciphertext`);
      }
    }
  }
  if (ctxRows.length > 0) {
    assert('client_context: all *_encrypted fields are ciphertext', allCtxEncrypted);
  } else {
    console.log('  ℹ  No client_context rows yet');
  }

  // sos_events: message_encrypted
  const sosRows = await dbQuery(
    'SELECT id, message_encrypted FROM sos_events ORDER BY id DESC LIMIT 5'
  );
  let allSosEncrypted = true;
  for (const row of sosRows) {
    if (row.message_encrypted && !looksLikeCiphertext(row.message_encrypted)) {
      allSosEncrypted = false;
      console.error(`  ✗  sos_events row ${row.id}: message_encrypted is NOT ciphertext`);
    }
  }
  if (sosRows.length > 0) {
    assert('sos_events: all message_encrypted are ciphertext', allSosEncrypted);
  } else {
    console.log('  ℹ  No SOS events in DB');
  }
}

// ── Step 2: Write via bot API, read via therapist API, confirm round-trip ────

async function step2_roundTrip() {
  console.log('\n=== STEP 2: Bot write → DB row → Therapist API read round-trip ===');

  // 2a. Write a diary entry via bot API
  const botR = await post('/api/bot/diary', {
    telegram_id: clientTelegramId,
    type: 'text',
    content: DIARY_TEXT
  }, null, { 'X-Bot-API-Key': BOT_API_KEY });
  assert(`Bot diary write returns 201 (got ${botR.status})`, botR.status === 201, JSON.stringify(botR.body));

  const entryId = botR.body?.entry?.id || botR.body?.id;
  assert('Bot diary write returns entry ID', !!entryId, `entryId=${entryId}`);

  // 2b. Inspect raw DB row — content_encrypted must be ciphertext, NOT the original plaintext
  const rawRows = await dbQuery(
    'SELECT id, content_encrypted, encryption_key_id, payload_version FROM diary_entries WHERE id = ?',
    [entryId]
  );
  assert('Raw DB row found for new entry', rawRows.length === 1);

  const rawRow = rawRows[0];
  const isCipher = looksLikeCiphertext(rawRow?.content_encrypted);
  assert(
    'content_encrypted in DB is ciphertext (not plaintext)',
    isCipher,
    `value="${String(rawRow?.content_encrypted).substring(0, 80)}"`
  );

  const isNotPlaintext = rawRow?.content_encrypted !== DIARY_TEXT;
  assert('content_encrypted does NOT equal the original plaintext', isNotPlaintext);

  assert(
    'encryption_key_id is set (non-null)',
    rawRow?.encryption_key_id !== null && rawRow?.encryption_key_id !== undefined,
    `key_id=${rawRow?.encryption_key_id}`
  );

  assert(
    'payload_version is set (>= 1)',
    rawRow?.payload_version >= 1,
    `version=${rawRow?.payload_version}`
  );

  // 2c. Read via therapist API — should return decrypted content
  const diaryR = await get(`/api/clients/${clientId}/diary`, therapistJwt);
  assert(`Therapist GET /clients/${clientId}/diary returns 200 (got ${diaryR.status})`,
    diaryR.status === 200, JSON.stringify(diaryR.body).substring(0, 200));

  const entries = diaryR.body?.entries || diaryR.body;
  const found = Array.isArray(entries) && entries.find(e => e.id === entryId);
  assert('New diary entry appears in therapist diary list', !!found);
  assert(
    'Therapist API returns decrypted content = original plaintext',
    found?.content === DIARY_TEXT,
    `found.content="${found?.content}" expected="${DIARY_TEXT}"`
  );

  // 2d. Write a therapist note and confirm round-trip
  const noteR = await post(`/api/clients/${clientId}/notes`,
    { content: NOTE_TEXT },
    therapistJwt,
    { 'X-CSRF-Token': csrfToken }
  );
  assert(`POST /clients/${clientId}/notes returns 201 (got ${noteR.status})`,
    noteR.status === 201, JSON.stringify(noteR.body).substring(0, 200));

  const noteId = noteR.body?.id;

  // Check raw DB row for note
  const rawNotes = await dbQuery(
    'SELECT id, note_encrypted, encryption_key_id, payload_version FROM therapist_notes WHERE id = ?',
    [noteId]
  );
  assert('Raw DB row found for new note', rawNotes.length === 1);
  const rawNote = rawNotes[0];
  assert(
    'note_encrypted in DB is ciphertext (not plaintext)',
    looksLikeCiphertext(rawNote?.note_encrypted),
    `value="${String(rawNote?.note_encrypted).substring(0, 80)}"`
  );
  assert('note_encrypted does NOT equal the original plaintext', rawNote?.note_encrypted !== NOTE_TEXT);

  // Read notes via therapist API
  const notesR = await get(`/api/clients/${clientId}/notes`, therapistJwt);
  assert(`GET /clients/${clientId}/notes returns 200`, notesR.status === 200);
  const notes = notesR.body?.notes || notesR.body;
  const foundNote = Array.isArray(notes) && notes.find(n => n.id === noteId);
  assert('New note appears in therapist notes list', !!foundNote);
  assert(
    'Therapist API returns decrypted note = original plaintext',
    foundNote?.content === NOTE_TEXT,
    `found.content="${foundNote?.content}" expected="${NOTE_TEXT}"`
  );

  // 2e. Write client_context (anamnesis) and confirm encryption (PUT endpoint)
  const ctxR = await request('PUT', `/api/clients/${clientId}/context`,
    { anamnesis: `T388_ANAMNESIS_${SUFFIX}` },
    { Authorization: `Bearer ${therapistJwt}`, 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' }
  );
  assert(`PUT /clients/${clientId}/context returns 200/201 (got ${ctxR.status})`,
    ctxR.status === 200 || ctxR.status === 201,
    JSON.stringify(ctxR.body).substring(0, 200));

  const ctxRows2 = await dbQuery(
    'SELECT id, anamnesis_encrypted FROM client_context WHERE therapist_id = ? AND client_id = ?',
    [therapistId, clientId]
  );
  if (ctxRows2.length > 0) {
    assert(
      'client_context.anamnesis_encrypted is ciphertext',
      looksLikeCiphertext(ctxRows2[0].anamnesis_encrypted),
      `value="${String(ctxRows2[0]?.anamnesis_encrypted).substring(0, 80)}"`
    );
    assert(
      'anamnesis_encrypted is NOT the plaintext value',
      ctxRows2[0].anamnesis_encrypted !== `T388_ANAMNESIS_${SUFFIX}`
    );
  }

  return entryId;
}

// ── Step 3: Class B metadata is plaintext ────────────────────────────────────

async function step3_classBPlaintext(entryId) {
  console.log('\n=== STEP 3: Class B metadata (timestamps, IDs) remains plaintext ===');

  const rows = await dbQuery(
    'SELECT id, client_id, entry_type, created_at, updated_at FROM diary_entries WHERE id = ?',
    [entryId]
  );
  assert('diary_entries metadata row found', rows.length === 1);

  const row = rows[0];

  // id must be a plain integer
  assert('id is a plain integer', Number.isInteger(row.id), `id=${row.id}`);

  // client_id must be a plain integer
  assert('client_id is a plain integer', Number.isInteger(row.client_id), `client_id=${row.client_id}`);

  // entry_type must be plaintext ('text', 'voice', 'video')
  assert(
    `entry_type is plaintext (got "${row.entry_type}")`,
    ['text', 'voice', 'video'].includes(row.entry_type)
  );

  // created_at must look like a datetime string (parseable)
  const dateOk = row.created_at && !isNaN(Date.parse(row.created_at));
  assert(
    `created_at is a parseable datetime ("${row.created_at}")`,
    dateOk
  );

  // updated_at same
  const updOk = row.updated_at && !isNaN(Date.parse(row.updated_at));
  assert(`updated_at is a parseable datetime ("${row.updated_at}")`, updOk);

  // Verify Class B metadata for therapist_notes too
  const noteRows = await dbQuery(
    'SELECT id, therapist_id, client_id, session_date, created_at FROM therapist_notes WHERE therapist_id = ? AND client_id = ? ORDER BY id DESC LIMIT 1',
    [therapistId, clientId]
  );
  if (noteRows.length > 0) {
    const nr = noteRows[0];
    assert('therapist_notes.id is plain integer', Number.isInteger(nr.id));
    assert('therapist_notes.therapist_id is plain integer', Number.isInteger(nr.therapist_id));
    assert('therapist_notes.created_at is parseable', nr.created_at && !isNaN(Date.parse(nr.created_at)));
  }

  // encryption_keys table: key_version and status must be plaintext (queryable)
  const keyRows = await dbQuery(
    "SELECT id, key_version, status FROM encryption_keys WHERE status = 'active'"
  );
  assert('encryption_keys has an active row', keyRows.length >= 1);
  const kr = keyRows[0];
  assert('encryption_keys.key_version is plain integer', Number.isInteger(kr.key_version));
  assert('encryption_keys.status is plaintext "active"', kr.status === 'active');
}

// ── Step 4: Key rotation ─────────────────────────────────────────────────────

async function step4_keyRotation() {
  console.log('\n=== STEP 4: Key rotation path ===');

  // Get current active version via API
  const verR = await get('/api/encryption/active-version', therapistJwt);
  assert(
    `GET /api/encryption/active-version returns 200 (got ${verR.status})`,
    verR.status === 200,
    JSON.stringify(verR.body)
  );
  const beforeVersion = verR.body?.active_version;
  assert('Active version is a positive integer', Number.isInteger(beforeVersion) && beforeVersion >= 1, `version=${beforeVersion}`);
  console.log(`  Current active key version: ${beforeVersion}`);

  // Rotate key — requires superadmin; use dev/set-role first
  const roleR = await post('/api/dev/set-role', { user_id: therapistId, role: 'superadmin' });
  assert('dev/set-role to superadmin succeeds', roleR.status === 200);

  // Get a fresh JWT as superadmin
  const loginR = await post('/api/auth/login',
    { email: T_EMAIL, password: PASSWORD },
    null,
    { 'X-CSRF-Token': csrfToken }
  );
  assert('Login as superadmin succeeds', loginR.status === 200, JSON.stringify(loginR.body));
  const superJwt = loginR.body?.token;

  const rotR = await post('/api/encryption/rotate', {}, superJwt, { 'X-CSRF-Token': csrfToken });
  assert(
    `POST /api/encryption/rotate returns 200 (got ${rotR.status})`,
    rotR.status === 200,
    JSON.stringify(rotR.body)
  );
  const afterVersion = rotR.body?.new_version;
  assert(
    `New key version (${afterVersion}) is one higher than before (${beforeVersion})`,
    afterVersion === beforeVersion + 1,
    `before=${beforeVersion} after=${afterVersion}`
  );

  // Previous version should now be 'rotated'
  const keysR = await get('/api/encryption/keys', superJwt);
  assert('GET /api/encryption/keys returns 200', keysR.status === 200);
  const keys = keysR.body?.keys || [];
  const oldKey = keys.find(k => k.key_version === beforeVersion);
  const newKey = keys.find(k => k.key_version === afterVersion);
  assert(`Old key v${beforeVersion} is now 'rotated'`, oldKey?.status === 'rotated', `status=${oldKey?.status}`);
  assert(`New key v${afterVersion} is 'active'`, newKey?.status === 'active', `status=${newKey?.status}`);

  // Encrypt some data with the new key version
  const encR = await post('/api/encryption/encrypt', { plaintext: `ROTATION_TEST_${SUFFIX}` }, superJwt);
  assert('Encrypt with new key returns 200', encR.status === 200);
  assert(`Encrypted data uses new key version ${afterVersion}`, encR.body?.key_version === afterVersion, `got=${encR.body?.key_version}`);
  assert('Encrypted result is ciphertext', looksLikeCiphertext(encR.body?.encrypted));

  // Decrypt it back
  const decR = await post('/api/encryption/decrypt', { encrypted: encR.body?.encrypted }, superJwt);
  assert('Decrypt returns 200', decR.status === 200);
  assert('Decrypt round-trip matches original', decR.body?.plaintext === `ROTATION_TEST_${SUFFIX}`, `got="${decR.body?.plaintext}"`);

  // Also verify OLD data (diary entry written before rotation) still decrypts
  const oldDiaryR = await get(`/api/clients/${clientId}/diary`, superJwt);
  assert('Old diary entry still readable after key rotation', oldDiaryR.status === 200);
  const entries = oldDiaryR.body?.entries || oldDiaryR.body;
  const found = Array.isArray(entries) && entries.find(e => e.content === DIARY_TEXT);
  assert('Old diary entry decrypts correctly with rotated key', !!found, `DIARY_TEXT="${DIARY_TEXT}"`);

  // Write a NEW diary entry after rotation (should use new key version)
  const botR2 = await post('/api/bot/diary', {
    telegram_id: clientTelegramId,
    type: 'text',
    content: `T388_AFTER_ROTATE_${SUFFIX}`
  }, null, { 'X-Bot-API-Key': BOT_API_KEY });
  assert('New diary entry after rotation: 201', botR2.status === 201);
  const newEntryId = botR2.body?.entry?.id || botR2.body?.id;

  const newRawRows = await dbQuery(
    'SELECT id, content_encrypted, encryption_key_id FROM diary_entries WHERE id = ?',
    [newEntryId]
  );
  assert('New entry uses new encryption_key_id', newRawRows.length === 1 && newRawRows[0].encryption_key_id === rotR.body.new_key_id,
    `key_id=${newRawRows[0]?.encryption_key_id} expected=${rotR.body.new_key_id}`
  );
  assert('New entry content_encrypted is still ciphertext', looksLikeCiphertext(newRawRows[0]?.content_encrypted));

  // Restore therapist role (not strictly needed but clean)
  await post('/api/dev/set-role', { user_id: therapistId, role: 'therapist' });
  console.log('  Restored therapist role');
}

// ── Step 5: Encrypted file storage — opaque IDs + signed-access streaming ────

async function step5_fileStorage() {
  console.log('\n=== STEP 5: Encrypted file storage — opaque IDs and signed-access streaming ===');

  // 5a. Check sessions audio_ref: should be UUID-based (opaque), not original filename
  const sessionRows = await dbQuery(
    'SELECT id, audio_ref FROM sessions WHERE audio_ref IS NOT NULL ORDER BY id DESC LIMIT 5'
  );
  console.log(`  Found ${sessionRows.length} sessions with audio_ref`);

  let allOpaque = true;
  for (const row of sessionRows) {
    const ref = row.audio_ref;
    if (!ref) continue;
    // The opaque ID is a UUID (8-4-4-4-12 hex) with optional extension, ending .enc
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const isOpaque = uuidPattern.test(ref) || ref.endsWith('.enc');
    if (!isOpaque) {
      allOpaque = false;
      console.error(`  ✗  session ${row.id}: audio_ref "${ref}" does NOT look opaque`);
    }
  }
  if (sessionRows.length > 0) {
    assert('Sessions: audio_ref values are opaque (UUID-based)', allOpaque);
  } else {
    console.log('  ℹ  No sessions with audio_ref in DB (no audio uploaded yet)');
  }

  // 5b. GET /api/sessions/:id/stream without auth → 401
  if (sessionRows.length > 0) {
    const sampleId = sessionRows[0].id;
    const noAuthR = await get(`/api/sessions/${sampleId}/stream`, null);
    assert(
      `GET /api/sessions/${sampleId}/stream without auth → 401 (got ${noAuthR.status})`,
      noAuthR.status === 401
    );
  }

  // 5c. Check diary_entries file_ref + audio_file_ref: should be opaque
  const diaryFileRows = await dbQuery(
    'SELECT id, file_ref, audio_file_ref FROM diary_entries WHERE audio_file_ref IS NOT NULL ORDER BY id DESC LIMIT 5'
  );
  console.log(`  Found ${diaryFileRows.length} diary entries with audio files`);

  let allDiaryOpaque = true;
  for (const row of diaryFileRows) {
    if (row.audio_file_ref) {
      const isEnc = row.audio_file_ref.endsWith('.enc');
      if (!isEnc) {
        allDiaryOpaque = false;
        console.error(`  ✗  diary_entry ${row.id}: audio_file_ref "${row.audio_file_ref}" does NOT end with .enc`);
      }
    }
  }
  if (diaryFileRows.length > 0) {
    assert('Diary audio files have .enc extension (encrypted on disk)', allDiaryOpaque);
  } else {
    console.log('  ℹ  No diary voice entries with audio files in DB');
  }

  // 5d. GET /api/diary/:id/stream without auth → 401
  const diaryStreamRows = await dbQuery(
    'SELECT id FROM diary_entries WHERE audio_file_ref IS NOT NULL ORDER BY id DESC LIMIT 1'
  );
  if (diaryStreamRows.length > 0) {
    const dId = diaryStreamRows[0].id;
    const noAuthDR = await get(`/api/diary/${dId}/stream`, null);
    assert(
      `GET /api/diary/${dId}/stream without auth → 401 (got ${noAuthDR.status})`,
      noAuthDR.status === 401
    );
  }

  // 5e. GET /api/clients/:id/diary/:entryId/stream without auth → 401
  const anyDiaryR = await dbQuery('SELECT id FROM diary_entries ORDER BY id DESC LIMIT 1');
  if (anyDiaryR.length > 0) {
    const eid = anyDiaryR[0].id;
    const noAuthStreamR = await get(`/api/clients/${clientId}/diary/${eid}/stream`, null);
    assert(
      `GET /api/clients/${clientId}/diary/${eid}/stream without auth → 401/403/404 (not 200) (got ${noAuthStreamR.status})`,
      noAuthStreamR.status !== 200
    );
  }

  // 5f. Verify assignment report attachments also use opaque IDs
  const attachRows = await dbQuery(
    'SELECT id, file_ref FROM assignment_report_attachments ORDER BY id DESC LIMIT 5'
  );
  console.log(`  Found ${attachRows.length} assignment attachment rows`);
  let allAttachOpaque = true;
  for (const row of attachRows) {
    if (row.file_ref && !row.file_ref.endsWith('.enc')) {
      allAttachOpaque = false;
      console.error(`  ✗  attachment ${row.id}: file_ref "${row.file_ref}" does NOT end with .enc`);
    }
  }
  if (attachRows.length > 0) {
    assert('Assignment attachments: file_ref values end with .enc', allAttachOpaque);
  } else {
    console.log('  ℹ  No assignment attachments in DB');
  }
}

// ── Final Step: Re-run Step 1 DB inspection after writes ─────────────────────

async function step1b_dbInspectionAfterWrites() {
  console.log('\n=== STEP 1b: Re-run DB inspection after writes (includes new entries) ===');

  const diaryRows = await dbQuery(
    `SELECT id, content_encrypted FROM diary_entries WHERE content_encrypted LIKE '%${DIARY_TEXT}%' LIMIT 5`
  );
  assert(
    'No diary row has plaintext content in content_encrypted column (grep check)',
    diaryRows.length === 0,
    `Found ${diaryRows.length} rows with plaintext "${DIARY_TEXT}" in content_encrypted`
  );

  const noteRows = await dbQuery(
    `SELECT id, note_encrypted FROM therapist_notes WHERE note_encrypted LIKE '%${NOTE_TEXT}%' LIMIT 5`
  );
  assert(
    'No note row has plaintext content in note_encrypted column (grep check)',
    noteRows.length === 0,
    `Found ${noteRows.length} rows with plaintext "${NOTE_TEXT}" in note_encrypted`
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('Feature #388 — Encryption regression audit');
  console.log('='.repeat(60));

  try {
    await setup();
    await step1_dbInspection();
    const entryId = await step2_roundTrip();
    await step3_classBPlaintext(entryId);
    await step4_keyRotation();
    await step5_fileStorage();
    await step1b_dbInspectionAfterWrites();
  } catch (err) {
    console.error('\nFATAL ERROR:', err.message);
    fail++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${pass} passed, ${fail} failed`);
  console.log('='.repeat(60));

  if (fail > 0) {
    process.exit(1);
  }
}

main();
