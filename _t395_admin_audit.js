/**
 * Feature #395 Audit Script
 * Regression sweep: admin panel and audit logs
 *
 * Steps:
 * 1. Log in as superadmin and visit /admin/* routes
 * 2. Switch AI provider (OpenAI ↔ Anthropic ↔ Gemini ↔ OpenRouter) and run smoke summary
 * 3. View audit logs — confirm recent auth and consent events appear
 * 4. Trigger manual backup and verify encrypted artifact + retention policy
 *
 * Run: node _t395_admin_audit.js
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
const failures = [];

// ─── helpers ─────────────────────────────────────────────────────────────────

function req(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0,
        ...headers
      }
    };
    const r = http.request(opts, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw), headers: res.headers }); }
        catch (_) { resolve({ status: res.statusCode, body: raw, headers: res.headers }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

// Multipart form-data request for file upload
function multipartReq(urlPath, fields, fileField, filename, mimeType, fileBuffer, authToken) {
  return new Promise((resolve, reject) => {
    const boundary = 'boundary' + Date.now();
    const parts = [];

    // Add text fields
    for (const [key, val] of Object.entries(fields)) {
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
      );
    }

    // Add file
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const fileFooter = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(parts.join('')),
      Buffer.from(fileHeader),
      fileBuffer,
      Buffer.from(fileFooter)
    ]);

    const opts = {
      hostname: 'localhost',
      port: 3001,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        Authorization: `Bearer ${authToken}`
      }
    };
    const r = http.request(opts, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (_) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    r.write(body);
    r.end();
  });
}

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    failures.push(`${label}${detail ? ': ' + detail : ''}`);
    console.log(`  ✗ ${label}${detail ? ' [' + detail + ']' : ''}`);
  }
}

async function getCsrf(authToken) {
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  const r = await req('GET', '/api/csrf-token', null, headers);
  return r.body.csrfToken;
}

async function loginAdmin() {
  const csrf = await getCsrf();
  const r = await req('POST', '/api/auth/login', {
    email: 'admin@pr-top.com',
    password: 'Admin123!'
  }, { 'X-CSRF-Token': csrf });
  return r;
}

async function registerTherapist(tag) {
  const ts = Date.now();
  const email = `t395_${tag}_${ts}@test.com`;
  const csrf = await getCsrf();
  const r = await req('POST', '/api/auth/register', {
    email,
    password: 'Test12345!',
    name: `T395 ${tag}`
  }, { 'X-CSRF-Token': csrf });
  if (r.status !== 201) throw new Error(`Register failed (${tag}): ${JSON.stringify(r.body)}`);
  return { email, token: r.body.token, userId: r.body.user && r.body.user.id };
}

async function authReq(method, urlPath, body, token) {
  return req(method, urlPath, body, { Authorization: `Bearer ${token}` });
}

async function authCsrfReq(method, urlPath, body, token) {
  const csrf = await getCsrf(token);
  return req(method, urlPath, body, {
    Authorization: `Bearer ${token}`,
    'X-CSRF-Token': csrf
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n=== Feature #395: Admin Panel & Audit Logs Regression Audit ===\n');

  // ============================================================
  // STEP 0: Login as superadmin
  // ============================================================
  console.log('--- STEP 0: Superadmin login ---');

  const loginRes = await loginAdmin();
  assert('Superadmin login → 200', loginRes.status === 200, `got ${loginRes.status}: ${JSON.stringify(loginRes.body)}`);
  assert('Login returns JWT token', loginRes.body && !!loginRes.body.token);
  assert('User role is superadmin', loginRes.body && loginRes.body.user && loginRes.body.user.role === 'superadmin');

  const token = loginRes.body && loginRes.body.token;
  if (!token) {
    console.error('Cannot proceed without admin token');
    process.exit(1);
  }

  // Verify a non-superadmin cannot access admin routes
  const therapistUser = await registerTherapist('rbac');
  const deniedRes = await authReq('GET', '/api/admin/therapists', null, therapistUser.token);
  assert('Therapist cannot access /api/admin/therapists → 403', deniedRes.status === 403);

  // Unauthenticated
  const unauthRes = await req('GET', '/api/admin/therapists', null, {});
  assert('Unauthenticated admin access → 401', unauthRes.status === 401);

  // ============================================================
  // STEP 1: All /admin/* routes return 200
  // ============================================================
  console.log('\n--- STEP 1: Superadmin /admin/* route verification ---');

  const adminGetRoutes = [
    '/api/admin/therapists',
    '/api/admin/stats/users',
    '/api/admin/stats/subscriptions',
    '/api/admin/stats/utm',
    '/api/admin/settings',
    '/api/admin/settings/assistant-ai',
    '/api/admin/logs/audit',
    '/api/admin/logs/system',
    '/api/admin/logs/audit/actions',
    '/api/admin/backup/status',
    '/api/admin/backups',
    '/api/admin/ai/models',
    '/api/admin/ai/usage',
    '/api/admin/ai/usage/summary',
    '/api/admin/ai/usage/daily',
    '/api/admin/ai/limits',
  ];

  for (const route of adminGetRoutes) {
    const r = await authReq('GET', route, null, token);
    assert(`GET ${route} → 200`, r.status === 200, `got ${r.status}`);
  }

  // Verify returned data shapes
  const statsRes = await authReq('GET', '/api/admin/stats/users', null, token);
  assert('stats/users has therapists count', statsRes.body && typeof statsRes.body.therapists === 'number');
  assert('stats/users has clients count', statsRes.body && typeof statsRes.body.clients === 'number');
  assert('stats/users has audit_log_entries', statsRes.body && typeof statsRes.body.audit_log_entries === 'number');
  assert('stats/users has subscription_breakdown', statsRes.body && statsRes.body.subscription_breakdown !== undefined);

  const therapistListRes = await authReq('GET', '/api/admin/therapists', null, token);
  assert('Therapist list is array', Array.isArray(therapistListRes.body && therapistListRes.body.therapists));

  const settingsRes = await authReq('GET', '/api/admin/settings', null, token);
  assert('Settings endpoint returns settings object', settingsRes.body && settingsRes.body.settings !== undefined);

  const backupStatusRes = await authReq('GET', '/api/admin/backup/status', null, token);
  assert('Backup status has backup_count', backupStatusRes.body && typeof backupStatusRes.body.backup_count === 'number');
  assert('Backup status has retention_limit', backupStatusRes.body && typeof backupStatusRes.body.retention_limit === 'number');

  // ============================================================
  // STEP 2: AI Provider Switching + Smoke Summary
  // ============================================================
  console.log('\n--- STEP 2: AI provider switching ---');

  // 2a. Verify all 4 providers listed
  const modelsRes = await authReq('GET', '/api/admin/ai/models', null, token);
  assert('GET /api/admin/ai/models → 200', modelsRes.status === 200);

  const providers = modelsRes.body && modelsRes.body.summarization_providers;
  assert('summarization_providers is array', Array.isArray(providers));

  const providerNames = providers ? providers.map(p => p.provider) : [];
  assert('OpenAI provider listed', providerNames.includes('openai'));
  assert('Anthropic provider listed', providerNames.includes('anthropic'));
  assert('Google provider listed', providerNames.includes('google'));
  assert('OpenRouter provider listed', providerNames.includes('openrouter'));

  assert('Current provider settings returned', modelsRes.body && modelsRes.body.current !== undefined);
  assert('Current summarization settings present', modelsRes.body && modelsRes.body.current && modelsRes.body.current.summarization !== undefined);
  assert('Current transcription settings present', modelsRes.body && modelsRes.body.current && modelsRes.body.current.transcription !== undefined);
  assert('Current assistant settings present', modelsRes.body && modelsRes.body.current && modelsRes.body.current.assistant !== undefined);

  // 2b. Switch to Anthropic
  const switchAnthropicRes = await authCsrfReq('PUT', '/api/admin/ai/models', {
    summarization: { provider: 'anthropic', model: 'claude-3-haiku-20240307' }
  }, token);
  assert('Switch to Anthropic summarization → 200', switchAnthropicRes.status === 200, `got ${switchAnthropicRes.status}`);
  assert(
    'Anthropic provider persisted after switch',
    switchAnthropicRes.body && switchAnthropicRes.body.current &&
    switchAnthropicRes.body.current.summarization.provider === 'anthropic'
  );
  assert(
    'Anthropic model persisted',
    switchAnthropicRes.body && switchAnthropicRes.body.current &&
    switchAnthropicRes.body.current.summarization.model === 'claude-3-haiku-20240307'
  );

  // Verify persisted in DB
  const modelsAfterAnthropicRes = await authReq('GET', '/api/admin/ai/models', null, token);
  assert(
    'Anthropic provider confirmed in follow-up GET',
    modelsAfterAnthropicRes.body && modelsAfterAnthropicRes.body.current &&
    modelsAfterAnthropicRes.body.current.summarization.provider === 'anthropic'
  );

  // 2c. Switch to Google
  const switchGoogleRes = await authCsrfReq('PUT', '/api/admin/ai/models', {
    summarization: { provider: 'google', model: 'gemini-1.5-flash' }
  }, token);
  assert('Switch to Google/Gemini summarization → 200', switchGoogleRes.status === 200);
  assert(
    'Google provider persisted',
    switchGoogleRes.body && switchGoogleRes.body.current &&
    switchGoogleRes.body.current.summarization.provider === 'google'
  );

  // 2d. Switch to OpenRouter
  const switchOpenRouterRes = await authCsrfReq('PUT', '/api/admin/ai/models', {
    summarization: { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct' }
  }, token);
  assert('Switch to OpenRouter summarization → 200', switchOpenRouterRes.status === 200);
  assert(
    'OpenRouter provider persisted',
    switchOpenRouterRes.body && switchOpenRouterRes.body.current &&
    switchOpenRouterRes.body.current.summarization.provider === 'openrouter'
  );

  // 2e. Switch back to OpenAI (restore default)
  const switchOpenAIRes = await authCsrfReq('PUT', '/api/admin/ai/models', {
    summarization: { provider: 'openai', model: 'gpt-4o-mini' },
    assistant: { provider: 'openai', model: 'gpt-4o-mini' }
  }, token);
  assert('Switch back to OpenAI → 200', switchOpenAIRes.status === 200);
  assert(
    'OpenAI provider confirmed after switch back',
    switchOpenAIRes.body && switchOpenAIRes.body.current &&
    switchOpenAIRes.body.current.summarization.provider === 'openai'
  );

  // 2f. AI test endpoint
  const aiTestOpenAI = await authReq('GET', '/api/admin/ai/test?provider=openai', null, token);
  assert('GET /api/admin/ai/test?provider=openai → 200', aiTestOpenAI.status === 200);
  assert('AI test response has configured field', aiTestOpenAI.body && typeof aiTestOpenAI.body.configured === 'boolean');
  assert('AI test response has success field', aiTestOpenAI.body && typeof aiTestOpenAI.body.success === 'boolean');
  // Dev mode: no real API key, so configured=false
  assert('OpenAI not configured in dev mode', aiTestOpenAI.body && aiTestOpenAI.body.configured === false);

  const aiTestAnthropicRes = await authReq('GET', '/api/admin/ai/test?provider=anthropic', null, token);
  assert('GET /api/admin/ai/test?provider=anthropic → 200', aiTestAnthropicRes.status === 200);
  assert('Anthropic not configured in dev mode', aiTestAnthropicRes.body && aiTestAnthropicRes.body.configured === false);

  const aiTestBadRes = await authReq('GET', '/api/admin/ai/test?provider=nonexistent', null, token);
  assert('Unknown provider → 400', aiTestBadRes.status === 400);

  const aiTestNoProvRes = await authReq('GET', '/api/admin/ai/test', null, token);
  assert('Missing provider → 400', aiTestNoProvRes.status === 400);

  // 2g. Smoke summary — register therapist, create client, upload session, summarize
  console.log('  (Registering smoke therapist for summary test...)');
  const smokeUser = await registerTherapist('smoke');
  const smokeCsrf = await getCsrf(smokeUser.token);

  // Create a client
  const smokeClientRes = await req('POST', '/api/clients/solo', {
    first_name: 'SmokeClient',
    email: `smoke_c_${Date.now()}@test.com`
  }, { Authorization: `Bearer ${smokeUser.token}`, 'X-CSRF-Token': smokeCsrf });
  const smokeClientId = smokeClientRes.body && smokeClientRes.body.client && smokeClientRes.body.client.id;

  if (smokeClientId) {
    // Upload a tiny fake mp3 session
    const fakeAudio = Buffer.alloc(2048, 0);
    const sessionUpRes = await multipartReq(
      '/api/sessions',
      { client_id: String(smokeClientId) },
      'audio', 'test.mp3', 'audio/mpeg',
      fakeAudio, smokeUser.token
    );
    // Session upload returns { id, therapist_id, client_id, ... } directly
    const smokeSessionId = sessionUpRes.body && (sessionUpRes.body.id || (sessionUpRes.body.session && sessionUpRes.body.session.id));
    assert('Smoke session created → 201', sessionUpRes.status === 201, `got ${sessionUpRes.status}: ${JSON.stringify(sessionUpRes.body)}`);

    if (smokeSessionId) {
      await sleep(2000);

      // Trigger summarization
      const smokeSummarizeCsrf = await getCsrf(smokeUser.token);
      const summarizeRes = await req('POST', `/api/sessions/${smokeSessionId}/summarize`, null, {
        Authorization: `Bearer ${smokeUser.token}`,
        'X-CSRF-Token': smokeSummarizeCsrf
      });
      assert(
        `Smoke summary triggered → 200 or 201`,
        summarizeRes.status === 200 || summarizeRes.status === 201,
        `got ${summarizeRes.status}: ${JSON.stringify(summarizeRes.body)}`
      );

      // Verify summary stored and retrievable
      const summaryRes = await authReq('GET', `/api/sessions/${smokeSessionId}/summary`, null, smokeUser.token);
      assert('Smoke summary retrievable → 200', summaryRes.status === 200);
      assert(
        'Smoke summary is non-empty string',
        summaryRes.body && typeof summaryRes.body.summary === 'string' && summaryRes.body.summary.length > 0
      );
      console.log(`  ℹ️  Summary preview: "${(summaryRes.body.summary || '').substring(0, 80)}..."`);
    }
  } else {
    console.log('  ⚠️  Could not create smoke client (may need to check client endpoint)');
  }

  // ============================================================
  // STEP 3: Audit logs — recent auth and consent events
  // ============================================================
  console.log('\n--- STEP 3: Audit log viewer ---');

  // Generate a consent event: register therapist + connect bot client
  const auditUser = await registerTherapist('audit');
  const inviteRes = await authReq('GET', '/api/auth/invite-code', null, auditUser.token);
  const inviteCode = inviteRes.body && inviteRes.body.invite_code;

  if (inviteCode) {
    // Set telegram_id for therapist
    await req('POST', '/api/dev/set-telegram-id', {
      user_id: auditUser.userId,
      telegram_id: `audit_ther_${auditUser.userId}`
    });

    // Bot connect (generates audit event)
    const botTelegramId = `audit_bot_${Date.now()}`;
    const botConnectRes = await req('POST', '/api/bot/connect', {
      telegram_id: botTelegramId,
      invite_code: inviteCode,
      language: 'en',
      name: 'Audit Test Client'
    }, { 'X-Bot-API-Key': 'dev-bot-api-key' });

    const connectTherapistId = botConnectRes.body && botConnectRes.body.therapist && botConnectRes.body.therapist.id;
    if (connectTherapistId) {
      // Give consent (generates consent_given audit event)
      await req('POST', '/api/bot/consent', {
        telegram_id: botTelegramId,
        therapist_id: connectTherapistId,
        consent_version: 1,
        consent_hash: 'audit_hash_' + Date.now()
      }, { 'X-Bot-API-Key': 'dev-bot-api-key' });
    }
  }

  // Now check audit logs
  const auditLogsRes = await authReq('GET', '/api/admin/logs/audit', null, token);
  assert('GET /api/admin/logs/audit → 200', auditLogsRes.status === 200);
  assert('Audit logs is array', Array.isArray(auditLogsRes.body && auditLogsRes.body.logs));
  assert('Audit log total > 0', auditLogsRes.body && typeof auditLogsRes.body.total === 'number' && auditLogsRes.body.total > 0,
    `got ${auditLogsRes.body && auditLogsRes.body.total}`);
  assert('Audit log has page field', auditLogsRes.body && typeof auditLogsRes.body.page === 'number');
  assert('Audit log has total_pages', auditLogsRes.body && typeof auditLogsRes.body.total_pages === 'number');

  // Verify log entry structure
  if (auditLogsRes.body && auditLogsRes.body.logs && auditLogsRes.body.logs.length > 0) {
    const firstLog = auditLogsRes.body.logs[0];
    assert('Log entry has id', firstLog.id !== undefined);
    assert('Log entry has action', firstLog.action !== undefined);
    assert('Log entry has created_at', firstLog.created_at !== undefined);
  }

  // Distinct audit actions
  const actionsRes = await authReq('GET', '/api/admin/logs/audit/actions', null, token);
  assert('GET /api/admin/logs/audit/actions → 200', actionsRes.status === 200);
  assert('Actions list is array', Array.isArray(actionsRes.body && actionsRes.body.actions));

  const actions = actionsRes.body && actionsRes.body.actions;
  console.log(`  ℹ️  Distinct audit actions: ${actions ? actions.join(', ') : 'none'}`);

  // At least one known event type must be present
  const knownActions = [
    'login', 'user_registered', 'register', 'manual_backup', 'database_backup',
    'consent_given', 'update_ai_models', 'update_platform_settings', 'sos_triggered',
    'password_reset_requested', 'remove_plan_override', 'manual_plan_override'
  ];
  const hasKnownAction = actions && actions.some(a => knownActions.includes(a));
  assert('Audit log contains at least one known event type', hasKnownAction, `actions: ${actions ? actions.join(',') : 'none'}`);

  // Filter by update_ai_models (we switched providers in step 2)
  const filteredRes = await authReq('GET', '/api/admin/logs/audit?action=update_ai_models', null, token);
  assert('GET /api/admin/logs/audit?action=update_ai_models → 200', filteredRes.status === 200);
  assert(
    'update_ai_models audit events appear after provider switches',
    filteredRes.body && filteredRes.body.total > 0,
    `got total=${filteredRes.body && filteredRes.body.total}`
  );

  // Filter by consent_given if it appeared
  if (actions && actions.includes('consent_given')) {
    const consentLogRes = await authReq('GET', '/api/admin/logs/audit?action=consent_given', null, token);
    assert('consent_given event visible in audit log', consentLogRes.body && consentLogRes.body.total > 0);
  }

  // Pagination
  const paginatedRes = await authReq('GET', '/api/admin/logs/audit?page=1&per_page=5', null, token);
  assert('Paginated audit logs → 200', paginatedRes.status === 200);
  assert('per_page=5 respected', paginatedRes.body && paginatedRes.body.per_page === 5);
  assert(
    'No more than 5 logs per page',
    paginatedRes.body && Array.isArray(paginatedRes.body.logs) && paginatedRes.body.logs.length <= 5
  );

  // Date filter (today)
  const today = new Date().toISOString().split('T')[0];
  const dateFilterRes = await authReq('GET', `/api/admin/logs/audit?date_from=${today}`, null, token);
  assert('Date-filtered audit logs → 200', dateFilterRes.status === 200);
  assert(
    'Today filter returns events (we created some today)',
    dateFilterRes.body && dateFilterRes.body.total > 0,
    `got total=${dateFilterRes.body && dateFilterRes.body.total}`
  );

  // System logs
  const sysLogsRes = await authReq('GET', '/api/admin/logs/system', null, token);
  assert('GET /api/admin/logs/system → 200', sysLogsRes.status === 200);
  assert('System logs is array', Array.isArray(sysLogsRes.body && sysLogsRes.body.logs));
  assert('System logs has total', sysLogsRes.body && typeof sysLogsRes.body.total === 'number');

  const sysLogsInfoRes = await authReq('GET', '/api/admin/logs/system?level=info', null, token);
  assert('System logs filtered by level=info → 200', sysLogsInfoRes.status === 200);

  // ============================================================
  // STEP 4: Manual backup + encrypted artifact + retention policy
  // ============================================================
  console.log('\n--- STEP 4: Manual backup + encrypted artifact + retention policy ---');

  // Pre-backup count
  const preBackupStatusRes = await authReq('GET', '/api/admin/backup/status', null, token);
  const preBackupCount = preBackupStatusRes.body && preBackupStatusRes.body.backup_count;
  console.log(`  ℹ️  Pre-backup count: ${preBackupCount}`);

  // Trigger manual backup
  const backupCsrf = await getCsrf(token);
  const backupRes = await req('POST', '/api/admin/backup', null, {
    Authorization: `Bearer ${token}`,
    'X-CSRF-Token': backupCsrf
  });
  assert('POST /api/admin/backup → 200', backupRes.status === 200, `got ${backupRes.status}: ${JSON.stringify(backupRes.body)}`);
  assert('Backup returns filename', backupRes.body && !!backupRes.body.filename);
  assert('Backup file has non-zero size', backupRes.body && backupRes.body.size > 0);
  assert('Backup returns raw_size', backupRes.body && typeof backupRes.body.raw_size === 'number');

  const backupFilename = backupRes.body && backupRes.body.filename;
  console.log(`  ℹ️  Backup filename: ${backupFilename}`);

  // Filename pattern check
  if (backupFilename) {
    assert(
      'Backup filename follows prtop_backup_*.db.gz.enc pattern',
      backupFilename.startsWith('prtop_backup_') && backupFilename.endsWith('.db.gz.enc'),
      `got: ${backupFilename}`
    );
  }

  // Verify file is on disk (encrypted, > 16 bytes)
  const backupDir = path.resolve(__dirname, 'src/backend/backups');
  let backupExists = false;
  let backupSizeOnDisk = 0;

  if (backupFilename) {
    const backupPath = path.join(backupDir, backupFilename);
    try {
      const stat = fs.statSync(backupPath);
      backupExists = true;
      backupSizeOnDisk = stat.size;
      console.log(`  ℹ️  Backup on disk: ${backupPath} (${stat.size} bytes)`);
    } catch (e) {
      console.log(`  ℹ️  Could not stat ${backupPath}: ${e.message}`);
    }
  }
  assert('Backup file exists on disk', backupExists, `expected ${backupFilename} in ${backupDir}`);
  assert('Backup file > 16 bytes (has AES IV prefix + payload)', backupSizeOnDisk > 16, `got ${backupSizeOnDisk}`);

  // Verify encryption: file must NOT start with SQLite magic bytes
  if (backupExists && backupFilename) {
    const backupPath = path.join(backupDir, backupFilename);
    try {
      const buf = fs.readFileSync(backupPath);
      const firstSix = buf.slice(0, 6).toString('ascii');
      assert('Backup file is encrypted (does not start with SQLite magic)', firstSix !== 'SQLite', `first 6 bytes: ${firstSix}`);
      assert('Backup file has at least IV + 1 payload byte', buf.length >= 17);
      // First 16 bytes are random AES-CBC IV (should be non-ASCII random bytes, not null)
      const iv = buf.slice(0, 16);
      const nonZeroBytes = iv.filter(b => b !== 0).length;
      assert('Backup IV looks random (has non-zero bytes)', nonZeroBytes > 4, `non-zero bytes in IV: ${nonZeroBytes}`);
    } catch (e) {
      console.log(`  ⚠️  Could not verify encryption: ${e.message}`);
    }
  }

  // Post-backup status
  const postBackupStatusRes = await authReq('GET', '/api/admin/backup/status', null, token);
  assert('GET /api/admin/backup/status after backup → 200', postBackupStatusRes.status === 200);

  const postBackupCount = postBackupStatusRes.body && postBackupStatusRes.body.backup_count;
  assert(
    'Backup count >= 1 after manual backup',
    typeof postBackupCount === 'number' && postBackupCount >= 1,
    `got ${postBackupCount}`
  );
  if (typeof preBackupCount === 'number') {
    assert(
      'Backup count incremented by 1',
      postBackupCount === preBackupCount + 1,
      `before=${preBackupCount}, after=${postBackupCount}`
    );
  }
  assert('last_backup is set', postBackupStatusRes.body && postBackupStatusRes.body.last_backup !== null);
  assert('last_backup_size is present', postBackupStatusRes.body && postBackupStatusRes.body.last_backup_size !== undefined);

  // Retention limit must be positive
  assert(
    'Retention limit is positive number',
    postBackupStatusRes.body && typeof postBackupStatusRes.body.retention_limit === 'number' &&
    postBackupStatusRes.body.retention_limit > 0,
    `got ${postBackupStatusRes.body && postBackupStatusRes.body.retention_limit}`
  );

  // total_size field
  assert('total_size field present', postBackupStatusRes.body && postBackupStatusRes.body.total_size !== undefined);

  // List backups — our file must appear
  const listBackupsRes = await authReq('GET', '/api/admin/backups', null, token);
  assert('GET /api/admin/backups → 200', listBackupsRes.status === 200);

  const backupList = Array.isArray(listBackupsRes.body) ? listBackupsRes.body
    : (listBackupsRes.body && listBackupsRes.body.backups ? listBackupsRes.body.backups : null);
  assert('Backup list is an array', Array.isArray(backupList), `got: ${typeof listBackupsRes.body}`);

  if (Array.isArray(backupList) && backupFilename) {
    const found = backupList.some(b =>
      (typeof b === 'string' && b === backupFilename) ||
      (typeof b === 'object' && (b.filename === backupFilename || b.name === backupFilename))
    );
    assert(`Our backup ${backupFilename} appears in backup list`, found);
  }

  // Audit log entry for the backup
  const backupAuditRes = await authReq('GET', '/api/admin/logs/audit?action=manual_backup', null, token);
  assert('manual_backup audit filter → 200', backupAuditRes.status === 200);
  assert('manual_backup event in audit log', backupAuditRes.body && backupAuditRes.body.total >= 1,
    `got total=${backupAuditRes.body && backupAuditRes.body.total}`);

  // ============================================================
  // STEP 5: Admin therapist management (plan override + block)
  // ============================================================
  console.log('\n--- STEP 5: Admin therapist management ---');

  // Find a therapist to test plan override on (use the smoke therapist registered earlier)
  const therapistListRes2 = await authReq('GET', '/api/admin/therapists', null, token);
  const allTherapists = therapistListRes2.body && therapistListRes2.body.therapists;

  // Use the auditing therapist we registered
  const targetTherapist = allTherapists && allTherapists.find(t => t.email && t.email.includes('t395_audit_'));

  if (targetTherapist) {
    // Manual plan override: set to 'pro'
    const planOverrideCsrf = await getCsrf(token);
    const planOverrideRes = await req('PUT', `/api/admin/therapists/${targetTherapist.id}/plan`, {
      plan: 'pro',
      reason: 'T395 regression test override'
    }, { Authorization: `Bearer ${token}`, 'X-CSRF-Token': planOverrideCsrf });
    assert(`Manual plan override therapist → 200`, planOverrideRes.status === 200, `got ${planOverrideRes.status}: ${JSON.stringify(planOverrideRes.body)}`);
    assert('Plan override set to pro', planOverrideRes.body && planOverrideRes.body.plan === 'pro');
    assert('is_manual_override flag set', planOverrideRes.body && planOverrideRes.body.is_manual_override === true);

    // Remove override
    const removeOverrideCsrf = await getCsrf(token);
    const removeOverrideRes = await req('DELETE', `/api/admin/therapists/${targetTherapist.id}/plan-override`, null, {
      Authorization: `Bearer ${token}`,
      'X-CSRF-Token': removeOverrideCsrf
    });
    assert('Remove plan override → 200', removeOverrideRes.status === 200, `got ${removeOverrideRes.status}`);
    assert('After removing override, plan is trial', removeOverrideRes.body && removeOverrideRes.body.plan === 'trial');
    assert('is_manual_override is false after removal', removeOverrideRes.body && removeOverrideRes.body.is_manual_override === false);

    // Block therapist
    const blockCsrf = await getCsrf(token);
    const blockRes = await req('PUT', `/api/admin/therapists/${targetTherapist.id}/block`, null, {
      Authorization: `Bearer ${token}`,
      'X-CSRF-Token': blockCsrf
    });
    assert('Block therapist → 200 (or 400 if already blocked)', blockRes.status === 200 || blockRes.status === 400);

    if (blockRes.status === 200) {
      const unblockCsrf = await getCsrf(token);
      const unblockRes = await req('PUT', `/api/admin/therapists/${targetTherapist.id}/unblock`, null, {
        Authorization: `Bearer ${token}`,
        'X-CSRF-Token': unblockCsrf
      });
      assert('Unblock therapist → 200', unblockRes.status === 200, `got ${unblockRes.status}`);
    }
  } else {
    console.log('  ⚠️  No audit therapist found in therapist list, skipping block/override tests');
  }

  // Platform settings update
  const updateSettingsCsrf = await getCsrf(token);
  const updateSettingsRes = await req('PUT', '/api/admin/settings', {
    settings: { trial_duration_days: 14, trial_client_limit: 3 }
  }, { Authorization: `Bearer ${token}`, 'X-CSRF-Token': updateSettingsCsrf });
  assert('PUT /api/admin/settings → 200', updateSettingsRes.status === 200);
  assert(
    'Settings update returns updated array',
    updateSettingsRes.body && Array.isArray(updateSettingsRes.body.updated)
  );
  assert(
    'trial_duration_days in updated list',
    updateSettingsRes.body && updateSettingsRes.body.updated.some(u => u.key === 'trial_duration_days')
  );

  // Bad setting key returns errors
  const badSettingCsrf = await getCsrf(token);
  const badSettingRes = await req('PUT', '/api/admin/settings', {
    settings: { nonexistent_key: 999 }
  }, { Authorization: `Bearer ${token}`, 'X-CSRF-Token': badSettingCsrf });
  assert('Unknown setting key → 200 with errors', badSettingRes.status === 200);
  assert(
    'Unknown setting key returns errors array',
    badSettingRes.body && Array.isArray(badSettingRes.body.errors) && badSettingRes.body.errors.length > 0
  );

  // AI spending limits
  const setLimitsCsrf = await getCsrf(token);
  const setLimitsRes = await req('PUT', '/api/admin/ai/limits', {
    limit_usd: 100,
    warning_percent: 80
  }, { Authorization: `Bearer ${token}`, 'X-CSRF-Token': setLimitsCsrf });
  assert('PUT /api/admin/ai/limits → 200', setLimitsRes.status === 200);
  assert('AI limits response has limit_usd', setLimitsRes.body && typeof setLimitsRes.body.limit_usd === 'number');
  assert('AI spending limit persisted as 100', setLimitsRes.body && setLimitsRes.body.limit_usd === 100);

  // ============================================================
  // RESULTS
  // ============================================================
  console.log('\n═══════════════════════════════════════');
  console.log('=== RESULTS ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failures.length > 0) {
    console.log('\nFailed assertions:');
    failures.forEach(f => console.log(`  ✗ ${f}`));
  }
  console.log(`\nTotal: ${passed + failed} assertions`);
  console.log('═══════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Uncaught error:', e);
  process.exit(1);
});
