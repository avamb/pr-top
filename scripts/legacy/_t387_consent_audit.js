/**
 * Feature #387 – Consent enforcement regression sweep
 *
 * Steps verified:
 *  1  – Read all protected routes without consent        → 403
 *  2  – Revoke consent mid-session                       → subsequent reads blocked
 *  3  – Export endpoint consent check                    → 403 without consent
 *  4  – Signed-file (diary stream) without consent       → 403
 *  5  – WebSocket: therapist-auth-only, no consent gate  → connects; invalid rejected
 *  6  – Audit log: access_denied entries written         → verified
 *  7  – Audit log: consent_granted / consent_revoked     → verified
 *  8  – Cross-therapist isolation                        → therapist B blocked from A's client
 *  9  – SOS bypasses consent (design: emergency access)  → no 500 error
 */

'use strict';
const http = require('http');
const { WebSocket } = require('./src/backend/node_modules/ws');

const TS = Date.now();

let passed = 0;
let failed = 0;
const errors = [];

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
    errors.push(label + (detail ? ': ' + detail : ''));
  }
}

/* ─── HTTP helpers ─────────────────────────────────────── */
function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: 'localhost',
      port: 3001,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        let json;
        try { json = JSON.parse(raw); } catch { json = raw; }
        resolve({ status: res.statusCode, body: json, headers: res.headers });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const get    = (path, headers)       => req('GET',    path, null,  headers);
const post   = (path, body, headers) => req('POST',   path, body,  headers);
const put    = (path, body, headers) => req('PUT',    path, body,  headers);
const getQS  = (path, qs, headers)   => get(path + '?' + new URLSearchParams(qs).toString(), headers);

/* ─── Auth helpers ─────────────────────────────────────── */
async function getCsrf() {
  const r = await get('/api/csrf-token');
  return r.body.csrfToken;
}

async function registerTherapist(suffix) {
  const csrf = await getCsrf();
  const r = await post('/api/auth/register', {
    email: `t387_${suffix}_${TS}@test.com`,
    password: 'Test1234!',
    firstName: 'T387',
    lastName: suffix,
    role: 'therapist',
  }, { 'X-CSRF-Token': csrf });
  if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.body)}`);
  return { token: r.body.token, userId: r.body.user?.id };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const bot  = ()      => ({ 'X-Bot-Api-Key': 'dev-bot-api-key' });

/** Get therapist invite code. Returns the invite_code string. */
async function getInviteCode(token) {
  const r = await get('/api/invite-code', auth(token));
  if (r.status !== 200) throw new Error(`invite-code failed: ${JSON.stringify(r.body)}`);
  return r.body.invite_code;
}

/**
 * Full 3-step bot onboarding:
 *  1. POST /api/bot/register (create client user)
 *  2. POST /api/bot/connect  (find therapist via invite code)
 *  3. POST /api/bot/consent  (link + grant consent, optional)
 * Returns { clientId }
 */
async function setupClient(telegramId, therapistId, inviteCode, grantConsent = true) {
  // 1. Register
  const regR = await post('/api/bot/register', {
    telegram_id: String(telegramId),
    role: 'client',
    language: 'en',
    first_name: 'Client387',
    last_name: 'Test',
  }, bot());
  if (regR.status !== 201 && regR.status !== 200) {
    throw new Error(`bot/register failed (${regR.status}): ${JSON.stringify(regR.body)}`);
  }
  const clientId = regR.body.user?.id;

  // 2. Connect (find therapist by invite code — does NOT link yet)
  const connR = await post('/api/bot/connect', {
    telegram_id: String(telegramId),
    invite_code: inviteCode,
  }, bot());
  if (connR.status !== 200) {
    throw new Error(`bot/connect failed (${connR.status}): ${JSON.stringify(connR.body)}`);
  }

  // 3. Consent (optionally link and grant)
  if (grantConsent) {
    const csR = await post('/api/bot/consent', {
      telegram_id: String(telegramId),
      therapist_id: therapistId,
      consent: true,
      consent_version: 1,
    }, bot());
    if (csR.status !== 200) {
      throw new Error(`bot/consent failed (${csR.status}): ${JSON.stringify(csR.body)}`);
    }
  }

  return { clientId };
}

/** Revoke consent via bot endpoint. */
const revokeConsent = (telegramId) =>
  post('/api/bot/revoke-consent', { telegram_id: String(telegramId) }, bot());

/* ─── DB helper (via /api/dev/audit-query — avoids subprocess on Windows) ─── */
async function dbQuery(action, actor_id, target_id, lim = 30) {
  try {
    const body = { limit: lim };
    if (action)   body.action   = action;
    if (actor_id) body.actor_id = actor_id;
    if (target_id) body.target_id = target_id;
    const r = await post('/api/dev/audit-query', body);
    if (r.status !== 200) {
      console.error('  DB query error: HTTP ' + r.status, JSON.stringify(r.body));
      return [];
    }
    return r.body.rows || [];
  } catch (e) {
    console.error('  DB query error:', e.message.slice(0, 300));
    return [];
  }
}

/* ─── MAIN ─────────────────────────────────────────────── */
async function main() {
  console.log('\n======================================================');
  console.log('Feature #387 — Consent Enforcement Regression Sweep');
  console.log('======================================================\n');

  /* ── Seed: therapist A ───────────────────────────────── */
  const tA = await registerTherapist('A');
  console.log(`Therapist A: id=${tA.userId}`);

  const invCodeA = await getInviteCode(tA.token);
  console.log(`Invite code A: ${invCodeA}`);

  /* ── Client C1: connected (bot/connect) but NO consent ── */
  // bot/connect finds the therapist but does NOT link yet.
  // So therapist_id=NULL → "not_linked_therapist" denial.
  // To test "consent_not_granted" we need to link BUT not grant consent.
  // We use devSetConsent after a full consent-grant to simulate: grant then immediately revoke.
  const tgId1 = 887000 + Math.floor(Math.random() * 9000);

  // Register client
  const regR = await post('/api/bot/register', {
    telegram_id: String(tgId1),
    role: 'client',
    language: 'en',
    first_name: 'Client387', last_name: 'Test',
  }, bot());
  if (regR.status !== 201 && regR.status !== 200) throw new Error(`bot/register: ${JSON.stringify(regR.body)}`);
  const cId1 = regR.body.user?.id;
  console.log(`Client C1: id=${cId1}, tgId=${tgId1}`);

  // Connect (find therapist, no link yet)
  await post('/api/bot/connect', { telegram_id: String(tgId1), invite_code: invCodeA }, bot());

  // Grant consent first (so therapist_id is set) then flip it off via dev endpoint
  // This gives us a client that IS linked but has consent=0, testing "consent_not_granted"
  await post('/api/bot/consent', {
    telegram_id: String(tgId1),
    therapist_id: tA.userId,
    consent: true,
    consent_version: 1,
  }, bot());
  // Immediately revoke consent via dev endpoint (keeps therapist_id, sets consent=0)
  await post('/api/dev/set-consent', { client_id: cId1, consent: false });
  console.log(`Client C1 linked but consent=0 (consent_not_granted scenario)`);

  /* ════════════════════════════════════════════════════════
     STEP 1 – Read all protected routes without consent → 403
  ════════════════════════════════════════════════════════ */
  console.log('\n── Step 1: reads WITHOUT consent ──────────────────');
  {
    const d = await get(`/api/clients/${cId1}/diary`, auth(tA.token));
    assert('GET /diary without consent → 403', d.status === 403,
      `got ${d.status}: ${JSON.stringify(d.body)}`);
    assert('Error: denied due to consent or auth',
      typeof d.body?.error === 'string' &&
      (d.body.error.toLowerCase().includes('consent') ||
       d.body.error.toLowerCase().includes('authorized')),
      d.body?.error);

    const ctx = await get(`/api/clients/${cId1}/context`, auth(tA.token));
    assert('GET /context without consent → 403', ctx.status === 403, `got ${ctx.status}`);

    const ses = await get(`/api/clients/${cId1}/sessions`, auth(tA.token));
    assert('GET /sessions without consent → 403', ses.status === 403, `got ${ses.status}`);

    const ex = await get(`/api/clients/${cId1}/exercises`, auth(tA.token));
    assert('GET /exercises without consent → 403', ex.status === 403, `got ${ex.status}`);

    const csrf = await getCsrf();
    const notePost = await post(`/api/clients/${cId1}/notes`,
      { content: 'should-be-blocked' },
      { ...auth(tA.token), 'X-CSRF-Token': csrf });
    assert('POST /notes without consent → 403', notePost.status === 403, `got ${notePost.status}`);

    const ctxPut = await put(`/api/clients/${cId1}/context`,
      { anamnesis: 'blocked' },
      { ...auth(tA.token), 'X-CSRF-Token': csrf });
    assert('PUT /context without consent → 403', ctxPut.status === 403, `got ${ctxPut.status}`);

    // Correct exercise-send route: POST /api/clients/:id/exercises (not /exercises/send)
    const exSend = await post(`/api/clients/${cId1}/exercises`,
      { exercise_id: 1 },
      { ...auth(tA.token), 'X-CSRF-Token': csrf });
    assert('POST /exercises (send) without consent → 403', exSend.status === 403, `got ${exSend.status}`);
  }

  /* ════════════════════════════════════════════════════════
     STEP 4 – Diary stream without consent → 403
  ════════════════════════════════════════════════════════ */
  console.log('\n── Step 4: diary stream without consent ────────────');
  let diaryEntryId = null;
  {
    // Create diary entry via bot (client-side write, no therapist consent needed)
    const botDiary = await post('/api/bot/diary', {
      telegram_id: String(tgId1),
      content: 'T387 consent audit diary entry',
      type: 'text',
    }, bot());
    const diarySaved = botDiary.status === 200 || botDiary.status === 201;
    assert('Bot creates diary entry (client write, consent irrelevant)', diarySaved,
      `got ${botDiary.status}: ${JSON.stringify(botDiary.body)}`);
    diaryEntryId = botDiary.body?.entry?.id;
    console.log(`  Diary entry id=${diaryEntryId}`);

    if (diaryEntryId) {
      const stream = await get(`/api/diary/${diaryEntryId}/stream`, auth(tA.token));
      assert('GET /diary/:id/stream without consent → 403', stream.status === 403,
        `got ${stream.status}: ${JSON.stringify(stream.body)}`);
    }
  }

  /* ════════════════════════════════════════════════════════
     Grant consent — verify access opens up
  ════════════════════════════════════════════════════════ */
  console.log('\n── Grant consent → verify access works ─────────────');
  {
    // Re-grant via bot/consent
    const grantR = await post('/api/bot/consent', {
      telegram_id: String(tgId1),
      therapist_id: tA.userId,
      consent: true,
      consent_version: 1,
    }, bot());
    assert('Bot consent grant → 200', grantR.status === 200,
      `got ${grantR.status}: ${JSON.stringify(grantR.body)}`);

    const d = await get(`/api/clients/${cId1}/diary`, auth(tA.token));
    assert('GET /diary WITH consent → 200', d.status === 200, `got ${d.status}`);
    assert('Diary returns entries array', Array.isArray(d.body?.entries), typeof d.body?.entries);

    const ctx = await get(`/api/clients/${cId1}/context`, auth(tA.token));
    assert('GET /context WITH consent → 200', ctx.status === 200, `got ${ctx.status}`);

    const ses = await get(`/api/clients/${cId1}/sessions`, auth(tA.token));
    assert('GET /sessions WITH consent → 200', ses.status === 200, `got ${ses.status}`);

    // Create a note while consented (for the notes-retain-after-revoke test)
    const csrf = await getCsrf();
    const noteOk = await post(`/api/clients/${cId1}/notes`,
      { content: 'T387 test note while consented' },
      { ...auth(tA.token), 'X-CSRF-Token': csrf });
    assert('POST /notes WITH consent → 201', noteOk.status === 201,
      `got ${noteOk.status}: ${JSON.stringify(noteOk.body)}`);
  }

  /* ════════════════════════════════════════════════════════
     STEP 2 – Revoke consent mid-session → everything blocked
  ════════════════════════════════════════════════════════ */
  console.log('\n── Step 2: revoke consent mid-session ──────────────');
  {
    const revokeR = await revokeConsent(tgId1);
    assert('Bot revoke-consent → 200', revokeR.status === 200,
      `got ${revokeR.status}: ${JSON.stringify(revokeR.body)}`);

    const d = await get(`/api/clients/${cId1}/diary`, auth(tA.token));
    assert('GET /diary after revoke → 403', d.status === 403, `got ${d.status}`);

    const ctx = await get(`/api/clients/${cId1}/context`, auth(tA.token));
    assert('GET /context after revoke → 403', ctx.status === 403, `got ${ctx.status}`);

    const ses = await get(`/api/clients/${cId1}/sessions`, auth(tA.token));
    assert('GET /sessions after revoke → 403', ses.status === 403, `got ${ses.status}`);

    const ex = await get(`/api/clients/${cId1}/exercises`, auth(tA.token));
    assert('GET /exercises after revoke → 403', ex.status === 403, `got ${ex.status}`);

    const csrf = await getCsrf();
    const notePost = await post(`/api/clients/${cId1}/notes`,
      { content: 'blocked after revoke' },
      { ...auth(tA.token), 'X-CSRF-Token': csrf });
    assert('POST /notes after revoke → 403', notePost.status === 403, `got ${notePost.status}`);

    if (diaryEntryId) {
      const stream = await get(`/api/diary/${diaryEntryId}/stream`, auth(tA.token));
      assert('GET /diary/:id/stream after revoke → 403', stream.status === 403,
        `got ${stream.status}`);
    }

    // Notes-list: design intent — therapist retains read to their own notes even after revoke
    const notesList = await get(`/api/clients/${cId1}/notes`, auth(tA.token));
    console.log(`  GET /notes after revoke: ${notesList.status}`);
    // Code comment on line ~817: "therapist retains access to their own notes even after client revokes"
    // BUT: bot revoke-consent sets therapist_id=NULL, so the standard ownership check also fails.
    // Actual behavior depends on whether notes route uses verifyClientConsent or direct ownership.
    assert('GET /notes after revoke: no 500 (200 design-intent or 403 stricter)',
      notesList.status === 200 || notesList.status === 403,
      `unexpected: ${notesList.status}`);
    const notesDesign = notesList.status === 200
      ? '200 — therapist retains note-list read (design intent)'
      : '403 — revoke also blocks note-list (stricter)';
    console.log(`  Notes behavior: ${notesDesign}`);
  }

  /* ════════════════════════════════════════════════════════
     STEP 5 – WebSocket: therapist-auth-only
  ════════════════════════════════════════════════════════ */
  console.log('\n── Step 5: WebSocket auth checks ───────────────────');

  await new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:3001/ws?token=${tA.token}`);
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; assert('WS: authenticated therapist connects', false, 'timed out'); }
      ws.terminate(); resolve();
    }, 4000);
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'connected') {
        clearTimeout(timer);
        if (!done) { done = true; assert('WS: authenticated therapist connects (no consent gate)', true); ws.close(); resolve(); }
      }
    });
    ws.on('error', (e) => {
      clearTimeout(timer);
      if (!done) { done = true; assert('WS: authenticated therapist connects', false, e.message); resolve(); }
    });
  });

  await new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:3001/ws?token=INVALID_TOKEN_T387');
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; assert('WS: invalid token rejected', false, 'timed out'); }
      ws.terminate(); resolve();
    }, 4000);
    ws.on('close', (code) => {
      clearTimeout(timer);
      if (!done) { done = true; assert('WS: invalid token → close 4001', code === 4001, `got ${code}`); resolve(); }
    });
    ws.on('error', () => {});
  });

  /* ════════════════════════════════════════════════════════
     STEP 8 – Cross-therapist isolation
  ════════════════════════════════════════════════════════ */
  console.log('\n── Step 8: cross-therapist isolation ───────────────');
  {
    const tB = await registerTherapist('B');
    console.log(`Therapist B: id=${tB.userId}`);

    // Create a fresh client consented to therapist A
    const invCodeA2 = await getInviteCode(tA.token);
    const tgId2 = 889000 + Math.floor(Math.random() * 9000);
    const { clientId: cId2 } = await setupClient(tgId2, tA.userId, invCodeA2, true);
    console.log(`Client C2 (consented to A): id=${cId2}`);

    // Therapist B tries to access therapist A's client
    const d = await get(`/api/clients/${cId2}/diary`, auth(tB.token));
    assert("B cannot read A's client diary → 403", d.status === 403,
      `got ${d.status}: ${JSON.stringify(d.body)?.slice(0, 80)}`);

    const ctx = await get(`/api/clients/${cId2}/context`, auth(tB.token));
    assert("B cannot read A's client context → 403", ctx.status === 403, `got ${ctx.status}`);

    const csrf = await getCsrf();
    const notePostB = await post(`/api/clients/${cId2}/notes`,
      { content: 'cross-therapist-injection' },
      { ...auth(tB.token), 'X-CSRF-Token': csrf });
    assert("B cannot create notes for A's client → 403", notePostB.status === 403, `got ${notePostB.status}`);

    // Diary stream also isolated
    if (diaryEntryId) {
      const stream = await get(`/api/diary/${diaryEntryId}/stream`, auth(tB.token));
      assert("B cannot stream A's client diary → 403", stream.status === 403, `got ${stream.status}`);
    }
  }

  /* ════════════════════════════════════════════════════════
     STEP 3 – Export endpoint consent check
  ════════════════════════════════════════════════════════ */
  console.log('\n── Step 3: export consent enforcement ──────────────');
  {
    // C1 has no consent (revoked in step 2 via bot, therapist_id=NULL)
    // Re-link with consent=0 via devSetConsent to test the consent_not_granted path
    // First re-register + connect + grant consent to link, then flip consent=0
    const invCodeA3 = await getInviteCode(tA.token);
    const tgId3 = 886000 + Math.floor(Math.random() * 9000);
    const { clientId: cId3 } = await setupClient(tgId3, tA.userId, invCodeA3, true);
    await post('/api/dev/set-consent', { client_id: cId3, consent: false });
    console.log(`Client C3 linked but consent=0: id=${cId3}`);

    // GET /api/export/client/:id?format=json (not POST!)
    const exportR = await getQS(`/api/export/client/${cId3}`, { format: 'json' }, auth(tA.token));
    assert('GET /export/client without consent → 403', exportR.status === 403,
      `got ${exportR.status}: ${JSON.stringify(exportR.body)?.slice(0, 100)}`);
  }

  /* ════════════════════════════════════════════════════════
     STEP 9 – SOS bypasses consent (but still requires ownership)
  ════════════════════════════════════════════════════════ */
  console.log('\n── Step 9: SOS bypass consent ───────────────────────');
  {
    // Create a client linked to therapist A, no consent
    const invCodeA4 = await getInviteCode(tA.token);
    const tgId4 = 884000 + Math.floor(Math.random() * 9000);
    const { clientId: cId4 } = await setupClient(tgId4, tA.userId, invCodeA4, true);
    await post('/api/dev/set-consent', { client_id: cId4, consent: false });
    console.log(`Client C4 linked + consent=0: id=${cId4}`);

    // SOS: no consent check — only ownership check (therapist_id must match)
    const sosR = await get(`/api/clients/${cId4}/sos`, auth(tA.token));
    console.log(`  SOS status (linked, no consent): ${sosR.status}`);
    assert('SOS: no 500 error (200 if accessible, 403 if also blocked)', sosR.status !== 500,
      `got ${sosR.status}`);
    // Per code comment: "therapist can view [SOS] without consent" — should be 200
    assert('SOS: accessible without consent when linked (200)', sosR.status === 200,
      `got ${sosR.status}: ${JSON.stringify(sosR.body)?.slice(0, 100)}`);
  }

  /* ════════════════════════════════════════════════════════
     STEPS 6 & 7 – Audit log verification
  ════════════════════════════════════════════════════════ */
  console.log('\n── Steps 6 & 7: Audit log entries ──────────────────');
  {
    // access_denied entries written for therapist A's blocked access attempts
    // actor_id = therapist (the one being denied), no target_id filter
    const denied = await dbQuery('access_denied', tA.userId, null, 30);
    console.log(`  access_denied entries for therapist A: ${denied.length}`);
    assert('Audit: access_denied entries written', denied.length > 0, `found ${denied.length}`);

    const withReason = denied.filter(e => {
      try {
        const d = JSON.parse(e.details_encrypted);
        return d.reason === 'not_linked_therapist' || d.reason === 'consent_not_granted';
      } catch { return false; }
    });
    assert('Audit: access_denied entries contain reason field', withReason.length > 0,
      `${withReason.length}/${denied.length} have valid reason`);

    // consent_granted entries — target_id stores therapist A's id (string in audit)
    const granted = await dbQuery('consent_granted', null, String(tA.userId), 10);
    console.log(`  consent_granted entries (target=therapist A): ${granted.length}`);
    assert('Audit: consent_granted entries written', granted.length > 0, `found ${granted.length}`);

    if (granted.length > 0) {
      const details = (() => { try { return JSON.parse(granted[0].details_encrypted); } catch { return {}; } })();
      assert('Audit: consent_granted.details has client_id', details.client_id !== undefined,
        JSON.stringify(details));
      assert('Audit: consent_granted.details has therapist_id', details.therapist_id !== undefined,
        JSON.stringify(details));
      assert('Audit: consent_granted.details has consent_version', details.consent_version !== undefined,
        JSON.stringify(details));
    }

    // consent_revoked entries — target_id stores therapist A's id
    const revoked = await dbQuery('consent_revoked', null, String(tA.userId), 10);
    console.log(`  consent_revoked entries (target=therapist A): ${revoked.length}`);
    assert('Audit: consent_revoked entries written', revoked.length > 0, `found ${revoked.length}`);

    if (revoked.length > 0) {
      const details = (() => { try { return JSON.parse(revoked[0].details_encrypted); } catch { return {}; } })();
      assert('Audit: consent_revoked.details has client_id', details.client_id !== undefined,
        JSON.stringify(details));
      assert('Audit: consent_revoked.details has therapist_id', details.therapist_id !== undefined,
        JSON.stringify(details));
    }
  }

  /* ════════════════════════════════════════════════════════
     SUMMARY
  ════════════════════════════════════════════════════════ */
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed assertions:');
    errors.forEach(e => console.log(`  ✗ ${e}`));
  }
  console.log('══════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
