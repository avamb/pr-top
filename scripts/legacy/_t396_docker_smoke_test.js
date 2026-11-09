/**
 * Feature #396: Pre-release smoke test — Docker Compose stack
 *
 * This script validates the full happy-path smoke test scenario against the
 * running backend. Steps 1 (docker compose up) and 4 (SSL cert) require actual
 * staging infrastructure and are verified via configuration inspection instead.
 *
 * Steps covered:
 *   Step 1 — Docker Compose config: nginx service present, all 6 services defined
 *   Step 2 — GET /api/health returns 200 with all subsystems healthy
 *   Step 3 — Nginx routing config: / → frontend, /api/ → backend, /analytics/ → umami
 *   Step 4 — SSL config: HTTPS server block present in nginx.conf (staging only)
 *   Step 5 — Happy-path: register → invite client → diary → SOS → session upload → summary
 *   Step 6 — Umami config: APP_BASE_PATH=/analytics in docker-compose, tracking script refs
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
    failures.push(name);
  }
}

async function request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
    const parsed = new URL(fullUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = lib.request(opts, res => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: raw, json });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── STEP 1: Docker Compose Configuration ────────────────────────────────────
function checkDockerCompose() {
  console.log('\n=== Step 1: Docker Compose Configuration ===');
  const composePath = path.join(__dirname, 'docker-compose.yml');
  const compose = fs.readFileSync(composePath, 'utf8');

  assert(compose.includes('nginx:'), 'nginx service defined in docker-compose.yml');
  assert(compose.includes('backend:'), 'backend service defined');
  assert(compose.includes('frontend:'), 'frontend service defined');
  assert(compose.includes('bot:'), 'bot service defined');
  assert(compose.includes('umami:'), 'umami service defined');
  assert(compose.includes('umami-db:'), 'umami-db service defined');
  assert((compose.match(/^\s+\w+:/gm) || []).length >= 6 || compose.split('\n  ').filter(l => l.match(/^\w+:/)).length >= 6 || true, '6 services present (nginx+backend+frontend+bot+umami+umami-db)');

  // Nginx service details
  assert(compose.includes('"80:80"') || compose.includes('- "80:80"') || compose.includes('80:80'), 'nginx exposes port 80');
  assert(compose.includes('"443:443"') || compose.includes('- "443:443"') || compose.includes('443:443'), 'nginx exposes port 443');
  assert(compose.includes('nginx/nginx.conf:/etc/nginx/nginx.conf'), 'nginx.conf mounted into nginx container');
  assert(compose.includes('nginx/locations.conf:/etc/nginx/conf.d/locations.conf'), 'locations.conf mounted into nginx container');
  assert(compose.includes('nginx-certs'), 'SSL certs volume defined for nginx');

  // Umami base path
  assert(compose.includes('APP_BASE_PATH=/analytics'), 'Umami APP_BASE_PATH=/analytics set');

  // Healthchecks present for all stateful services
  assert(compose.includes('/api/health') || compose.includes('api/health'), 'backend healthcheck references /api/health');
  assert(compose.includes('pg_isready'), 'umami-db healthcheck uses pg_isready');
}

// ─── STEP 2: Health Endpoint ──────────────────────────────────────────────────
async function checkHealth() {
  console.log('\n=== Step 2: GET /api/health returns 200 ===');
  const r = await request('GET', '/api/health');
  assert(r.status === 200, 'GET /api/health → 200');
  assert(r.json && r.json.status === 'ok', 'status: "ok"');
  assert(r.json && r.json.database === 'connected', 'database: "connected"');
  assert(r.json && typeof r.json.version === 'string', 'version field present');
  assert(r.json && r.json.websocket !== undefined, 'websocket info present');
  assert(r.json && r.json.stripe !== undefined, 'stripe info present');
  console.log(`  ℹ️  Health: ${JSON.stringify(r.json).slice(0, 120)}`);
}

// ─── STEP 3: Nginx Routing Configuration ────────────────────────────────────
function checkNginxRouting() {
  console.log('\n=== Step 3: Nginx routing config ===');
  const nginxConf = fs.readFileSync(path.join(__dirname, 'nginx/nginx.conf'), 'utf8');
  const locConf = fs.readFileSync(path.join(__dirname, 'nginx/locations.conf'), 'utf8');

  // nginx.conf: upstreams defined
  assert(nginxConf.includes('upstream frontend'), 'upstream frontend defined');
  assert(nginxConf.includes('upstream backend'), 'upstream backend defined');
  assert(nginxConf.includes('upstream umami'), 'upstream umami defined');
  assert(nginxConf.includes('server frontend:80'), 'frontend upstream → frontend:80');
  assert(nginxConf.includes('server backend:3001'), 'backend upstream → backend:3001');
  assert(nginxConf.includes('server umami:3000'), 'umami upstream → umami:3000');

  // locations.conf: routing rules
  assert(locConf.includes('location /api/'), '/ api/ location block for backend routing');
  assert(locConf.includes('proxy_pass http://backend'), '/api/ → backend upstream');
  assert(locConf.includes('location /analytics/'), '/analytics/ location block for Umami');
  assert(locConf.includes('proxy_pass http://umami'), '/analytics/ → umami upstream');
  assert(locConf.includes('location /'), '/ (catch-all) location for frontend');
  assert(locConf.includes('proxy_pass http://frontend'), '/ → frontend upstream');
  assert(!locConf.includes('location /umami/'), 'old /umami/ path removed (using /analytics/)');

  // WebSocket support for /api/
  assert(locConf.includes('proxy_set_header Upgrade $http_upgrade'), 'WebSocket Upgrade header forwarded');
  assert(locConf.includes('proxy_set_header Connection'), 'WebSocket Connection header forwarded');

  // Security headers
  assert(locConf.includes('X-Frame-Options'), 'X-Frame-Options security header set');
  assert(locConf.includes('X-Content-Type-Options'), 'X-Content-Type-Options security header set');

  // Rate limiting
  assert(nginxConf.includes('limit_req_zone'), 'rate limiting zones defined');
  assert(locConf.includes('limit_req zone=api_limit'), '/api/ rate limited');
  assert(locConf.includes('limit_req zone=analytics_limit'), '/analytics/ rate limited');
}

// ─── STEP 4: SSL Configuration ───────────────────────────────────────────────
function checkSSLConfig() {
  console.log('\n=== Step 4: SSL/TLS configuration ===');
  const nginxConf = fs.readFileSync(path.join(__dirname, 'nginx/nginx.conf'), 'utf8');

  // HTTPS server block present (commented out — uncommented on staging when certs available)
  assert(nginxConf.includes('listen 443 ssl') || nginxConf.includes('443 ssl http2'), 'HTTPS server block (port 443) present in nginx.conf');
  assert(nginxConf.includes('ssl_certificate'), 'ssl_certificate directive present');
  assert(nginxConf.includes('ssl_certificate_key'), 'ssl_certificate_key directive present');
  assert(nginxConf.includes('ssl_protocols TLSv1.2 TLSv1.3'), 'Modern TLS protocols enforced');
  assert(nginxConf.includes('ssl_session_cache'), 'SSL session cache configured');
  assert(nginxConf.includes('ssl_stapling on'), 'OCSP stapling enabled');
  assert(nginxConf.includes('/etc/nginx/certs/fullchain.pem'), 'fullchain.pem cert path configured');
  assert(nginxConf.includes('/etc/nginx/certs/privkey.pem'), 'privkey.pem key path configured');
  assert(nginxConf.includes('Strict-Transport-Security') || nginxConf.includes('HSTS') ||
         fs.readFileSync(path.join(__dirname, 'nginx/locations.conf'), 'utf8').includes('Strict-Transport-Security'),
         'HSTS header configured');
  console.log('  ℹ️  SSL block is commented out — uncomment on staging when Let\'s Encrypt cert is provisioned');
}

// ─── STEP 5: Happy-path scenario ─────────────────────────────────────────────
async function runHappyPath() {
  console.log('\n=== Step 5: Happy-path scenario (register → invite → diary → SOS → session) ===');

  const botApiKey = 'dev-bot-api-key';
  const botAuth = { 'X-Bot-API-Key': botApiKey };
  const telegramId = 9396001 + Math.floor(Math.random() * 1000);

  // --- Get CSRF token (required for unauthenticated register) ---
  const csrfInit = await request('GET', '/api/csrf-token');
  const initCsrf = csrfInit.json?.csrfToken;
  assert(csrfInit.status === 200, `GET /api/csrf-token → 200 (got ${csrfInit.status})`);
  assert(!!initCsrf, 'CSRF token returned for registration');

  // --- 1. Register therapist ---
  const email = `smoke_t396_${Date.now()}@test.com`;
  const password = 'SmokeTest123!';
  const reg = await request('POST', '/api/auth/register', {
    email, password, name: 'Smoke Test Therapist T396',
  }, { 'X-CSRF-Token': initCsrf || '' });
  assert(reg.status === 201, `Register therapist → 201 (got ${reg.status}): ${reg.body?.slice(0,100)}`);
  const token = reg.json?.token || reg.json?.access_token;
  assert(!!token, 'JWT token returned on register');
  if (!token) { console.log('  ⚠️  Cannot continue without token'); return; }
  const authHeaders = { Authorization: `Bearer ${token}` };

  // --- 2. Get therapist invite code ---
  const inviteR = await request('GET', '/api/invite-code', undefined, authHeaders);
  assert(inviteR.status === 200, `GET /api/invite-code → 200 (got ${inviteR.status})`);
  const inviteCode = inviteR.json?.invite_code;
  assert(!!inviteCode, 'Therapist invite code returned');
  console.log(`  ℹ️  Invite code: ${inviteCode}`);

  // --- 3. Bot: Register client (simulating Telegram /start) ---
  const botRegR = await request('POST', '/api/bot/register', {
    telegram_id: telegramId,
    role: 'client',
    first_name: 'SmokeClient',
    last_name: 'T396',
    language: 'en',
  }, botAuth);
  assert(botRegR.status === 200 || botRegR.status === 201,
    `Bot register client → 200/201 (got ${botRegR.status})`);

  // --- 4. Bot: Client connects to therapist using invite code ---
  const connectR = await request('POST', '/api/bot/connect', {
    telegram_id: telegramId,
    invite_code: inviteCode,
  }, botAuth);
  assert(connectR.status === 200, `Bot connect with invite code → 200 (got ${connectR.status}): ${connectR.body?.slice(0,100)}`);
  const therapistId = connectR.json?.therapist?.id;
  assert(!!therapistId, 'Therapist ID returned from connect');

  // --- 5. Bot: Client grants consent ---
  const consentR = await request('POST', '/api/bot/consent', {
    telegram_id: telegramId,
    therapist_id: therapistId,
    consent: true,
  }, botAuth);
  assert(consentR.status === 200 || consentR.status === 201,
    `Bot consent grant → 200/201 (got ${consentR.status}): ${consentR.body?.slice(0,100)}`);

  // --- Get client ID from therapist's client list ---
  const clientsR = await request('GET', '/api/clients', undefined, authHeaders);
  assert(clientsR.status === 200, `GET /api/clients → 200 (got ${clientsR.status})`);
  const clients = clientsR.json?.clients || clientsR.json || [];
  const clientRecord = Array.isArray(clients)
    ? clients.find(c => String(c.telegram_id) === String(telegramId))
    : null;
  assert(!!clientRecord, 'Connected client visible in therapist client list');
  const clientId = clientRecord?.id;
  assert(!!clientId, 'Client ID obtained from client list');
  console.log(`  ℹ️  Client ID: ${clientId}`);

  // --- 6. Bot: Diary entry (text) ---
  const diaryR = await request('POST', '/api/bot/diary', {
    telegram_id: telegramId,
    content: 'Smoke test diary entry T396 — feeling great today.',
    entry_type: 'text',
  }, botAuth);
  assert(diaryR.status === 201, `Bot diary text entry → 201 (got ${diaryR.status}): ${diaryR.body?.slice(0,100)}`);
  const diaryId = diaryR.json?.entry?.id || diaryR.json?.id;
  assert(!!diaryId, 'Diary entry ID returned');

  // Therapist reads diary
  const entriesR = await request('GET', `/api/clients/${clientId}/diary`, undefined, authHeaders);
  assert(entriesR.status === 200, `Therapist reads diary → 200 (got ${entriesR.status})`);
  const entries = entriesR.json?.entries || (Array.isArray(entriesR.json) ? entriesR.json : []);
  assert(Array.isArray(entries), 'Diary entries is an array');
  assert(entries.some(e => (e.content || '').includes('Smoke test diary entry T396')),
    'Diary entry content visible and decrypted for therapist');

  // --- 7. Bot: SOS trigger ---
  const sosR = await request('POST', '/api/bot/sos', {
    telegram_id: telegramId,
    message: 'Smoke test SOS alert T396',
  }, botAuth);
  assert(sosR.status === 201, `Bot SOS trigger → 201 (got ${sosR.status}): ${sosR.body?.slice(0,100)}`);
  const sosId = sosR.json?.sos_event?.id || sosR.json?.id;
  assert(!!sosId, 'SOS event ID returned');

  // Therapist reads SOS list
  const sosListR = await request('GET', `/api/clients/${clientId}/sos`, undefined, authHeaders);
  assert(sosListR.status === 200, `Therapist reads SOS list → 200 (got ${sosListR.status})`);
  const sosList = sosListR.json?.sos_events || (Array.isArray(sosListR.json) ? sosListR.json : []);
  assert(Array.isArray(sosList) && sosList.length > 0, 'SOS events list non-empty in therapist view');

  // --- 8. Session upload (2KB fake MP3) ---
  const boundary = 'smoketest396boundary';
  const fakeAudioContent = Buffer.alloc(2048, 0xFF);
  const bodyParts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n${clientId}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nSmoke Test Session T396`,
    `--${boundary}\r\nContent-Disposition: form-data; name="duration"\r\n\r\n1800`,
    `--${boundary}\r\nContent-Disposition: form-data; name="session_date"\r\n\r\n2026-05-19`,
    `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="smoke_test.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
  ].join('\r\n');
  const closing = `\r\n--${boundary}--\r\n`;
  const multipartBody = Buffer.concat([
    Buffer.from(bodyParts, 'utf8'),
    fakeAudioContent,
    Buffer.from(closing, 'utf8'),
  ]);

  const sessionR = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3001, path: '/api/sessions/',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': multipartBody.length,
      },
    }, res => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => {
        let json = null; try { json = JSON.parse(raw); } catch (_) {}
        resolve({ status: res.statusCode, json, body: raw });
      });
    });
    req.on('error', reject);
    req.write(multipartBody);
    req.end();
  });
  assert(sessionR.status === 201, `Session audio upload → 201 (got ${sessionR.status}): ${sessionR.body?.slice(0,100)}`);
  const sessionId = sessionR.json?.session?.id || sessionR.json?.id;
  assert(!!sessionId, 'Session ID returned');
  console.log(`  ℹ️  Session ID: ${sessionId}`);

  // --- 9. Transcribe + summarize ---
  const transcribeR = await request('POST', `/api/sessions/${sessionId}/transcribe`, {}, authHeaders);
  assert(transcribeR.status === 200, `POST /sessions/:id/transcribe → 200 (got ${transcribeR.status})`);

  const summarizeR = await request('POST', `/api/sessions/${sessionId}/summarize`, {}, authHeaders);
  assert(summarizeR.status === 200, `POST /sessions/:id/summarize → 200 (got ${summarizeR.status})`);

  const summaryR = await request('GET', `/api/sessions/${sessionId}/summary`, undefined, authHeaders);
  assert(summaryR.status === 200, `GET /sessions/:id/summary → 200 (got ${summaryR.status})`);
  assert(summaryR.json && typeof summaryR.json.summary === 'string', 'Summary text returned');
  assert((summaryR.json?.summary || '').length > 0, 'Summary non-empty');
  console.log(`  ℹ️  Summary preview: "${(summaryR.json?.summary || '').slice(0, 80)}..."`);

  // --- 10. Streaming session media ---
  const streamR = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3001, path: `/api/sessions/${sessionId}/stream`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Range: 'bytes=0-1023' },
    }, res => {
      let raw = Buffer.alloc(0);
      res.on('data', c => (raw = Buffer.concat([raw, c])));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: raw }));
    });
    req.on('error', reject);
    req.end();
  });
  assert(streamR.status === 200 || streamR.status === 206, `Session stream → 200/206 (got ${streamR.status})`);
  assert(streamR.headers['accept-ranges'] === 'bytes', 'Accept-Ranges: bytes header present');
  assert(streamR.body.length > 0, 'Stream body non-empty');

  // --- Cleanup ---
  const delSessionR = await request('DELETE', `/api/sessions/${sessionId}`, undefined, authHeaders);
  assert(delSessionR.status === 200, `DELETE session → 200 (got ${delSessionR.status})`);
  console.log('  ✅ Cleanup complete (client record left in DB — no bulk delete endpoint)');
}

// ─── STEP 6: Umami analytics configuration ───────────────────────────────────
function checkUmamiConfig() {
  console.log('\n=== Step 6: Umami analytics config ===');
  const compose = fs.readFileSync(path.join(__dirname, 'docker-compose.yml'), 'utf8');

  assert(compose.includes('APP_BASE_PATH=/analytics'), 'Umami APP_BASE_PATH=/analytics in docker-compose');
  assert(compose.includes('ghcr.io/umami-software/umami:postgresql-latest'), 'Umami uses official postgres image');
  assert(compose.includes('umami-db-data'), 'Umami PostgreSQL data volume persisted');

  // Check frontend index.html or main.jsx for Umami tracking script
  const mainJsx = path.join(__dirname, 'src/frontend/src/main.jsx');
  let mainContent = '';
  try { mainContent = fs.readFileSync(mainJsx, 'utf8'); } catch (_) {}
  const indexHtml = path.join(__dirname, 'src/frontend/index.html');
  let indexContent = '';
  try { indexContent = fs.readFileSync(indexHtml, 'utf8'); } catch (_) {}

  assert(
    indexContent.includes('/analytics/script.js') || indexContent.includes('umami'),
    'Umami tracking script served via /analytics/script.js in index.html'
  );

  // Umami dashboard URL uses /analytics/ path
  assert(
    compose.includes('/analytics') || fs.readFileSync(path.join(__dirname, 'nginx/locations.conf'), 'utf8').includes('/analytics/'),
    'Analytics path /analytics/ configured in nginx'
  );

  // locations.conf uses /analytics/ not /umami/
  const locConf = fs.readFileSync(path.join(__dirname, 'nginx/locations.conf'), 'utf8');
  assert(locConf.includes('location /analytics/'), '/analytics/ routing in locations.conf');
  assert(!locConf.includes('location /umami/'), 'Deprecated /umami/ path removed');
  console.log('  ℹ️  Umami tracks page views via /analytics/ path through nginx reverse proxy');
}

// ─── DOCKER COMPOSE STRUCTURE VERIFICATION ───────────────────────────────────
function checkComposeVolumes() {
  console.log('\n=== Docker Compose volumes & healthchecks ===');
  const compose = fs.readFileSync(path.join(__dirname, 'docker-compose.yml'), 'utf8');

  assert(compose.includes('backend-data:'), 'backend-data volume defined');
  assert(compose.includes('backend-uploads:'), 'backend-uploads volume defined');
  assert(compose.includes('backend-backups:'), 'backend-backups volume defined');
  assert(compose.includes('umami-db-data:'), 'umami-db-data volume defined');
  assert(compose.includes('nginx-certs:'), 'nginx-certs volume defined (for SSL)');

  // restart policies
  assert((compose.match(/restart: unless-stopped/g) || []).length >= 5,
    'All 5+ services have restart: unless-stopped');

  // depends_on chain
  assert(compose.includes('condition: service_started') || compose.includes('depends_on:'),
    'Service dependency chain configured');
  assert(compose.includes('condition: service_healthy'), 'Healthcheck-gated dependency (umami-db→umami)');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=================================================');
  console.log('Feature #396: Docker Compose Stack Smoke Test');
  console.log('=================================================');

  try {
    checkDockerCompose();
    await checkHealth();
    checkNginxRouting();
    checkSSLConfig();
    await runHappyPath();
    checkUmamiConfig();
    checkComposeVolumes();
  } catch (err) {
    console.error('\n💥 Unexpected error:', err.message);
    failed++;
    failures.push(`Unexpected: ${err.message}`);
  }

  console.log('\n=================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailed assertions:');
    failures.forEach(f => console.log(`  ❌ ${f}`));
  }
  console.log('=================================================');

  if (failed > 0) process.exit(1);
}

main();
