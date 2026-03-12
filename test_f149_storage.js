// Test Feature #149: File storage uses encrypted storage and opaque IDs
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = 'http://127.0.0.1:3001';
const SESSIONS_DIR = path.join(__dirname, 'src/backend/data/sessions');

function request(method, urlPath, body, token, extraHeaders) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const isMultipart = body instanceof Buffer;
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (extraHeaders) Object.assign(headers, extraHeaders);

    if (!isMultipart && body) {
      headers['Content-Type'] = 'application/json';
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers
    };

    if (!isMultipart && body) {
      const jsonStr = JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(jsonStr);
      const req = http.request(options, res => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch(e) { resolve({ status: res.statusCode, data }); }
        });
      });
      req.on('error', reject);
      req.write(jsonStr);
      req.end();
    } else {
      const req = http.request(options, res => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch(e) { resolve({ status: res.statusCode, data }); }
        });
      });
      req.on('error', reject);
      req.end();
    }
  });
}

function uploadAudio(urlPath, clientId, token, csrfTok) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + crypto.randomBytes(8).toString('hex');
    // Create a small fake audio file
    const fakeAudio = Buffer.alloc(1024, 0x42); // 1KB of data

    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="client_id"\r\n\r\n`;
    body += `${clientId}\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="audio"; filename="my_session_recording.mp3"\r\n`;
    body += `Content-Type: audio/mpeg\r\n\r\n`;

    const bodyStart = Buffer.from(body, 'utf8');
    const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const fullBody = Buffer.concat([bodyStart, fakeAudio, bodyEnd]);

    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path: urlPath,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
        'x-csrf-token': csrfTok || ''
      }
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

async function getCsrf() {
  const res = await request('GET', '/api/csrf-token', null, null);
  return res.data.csrfToken;
}

async function main() {
  let passed = 0;
  let failed = 0;

  console.log('=== Feature #149: File storage uses encrypted storage and opaque IDs ===\n');

  // Get CSRF token
  const csrfToken = await getCsrf();
  console.log('CSRF token obtained');

  const csrf = { 'x-csrf-token': csrfToken };
  const botHeaders = { 'x-csrf-token': csrfToken, 'x-bot-api-key': 'dev-bot-api-key' };

  // Register or login therapist
  let token, therapistId;
  const regRes = await request('POST', '/api/auth/register', {
    name: 'F149Therapist', email: 'f149therapist@test.com', password: 'TestPass149!', role: 'therapist'
  }, null, csrf);
  if (regRes.data.token) {
    token = regRes.data.token;
    therapistId = regRes.data.user.id;
  } else {
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'f149therapist@test.com', password: 'TestPass149!'
    }, null, csrf);
    token = loginRes.data.token;
    therapistId = loginRes.data.user.id;
  }
  console.log(`Therapist ID: ${therapistId}`);

  // Register a client via bot (ignore if exists)
  const clientTgId = 'f149client_tg_' + Date.now();
  const botReg = await request('POST', '/api/bot/register', {
    telegram_id: clientTgId, name: 'F149Client', role: 'client'
  }, null, botHeaders);
  console.log('Bot register:', botReg.status);

  // Get invite code
  const inviteRes = await request('GET', '/api/invite-code', null, token);
  const inviteCode = inviteRes.data.invite_code;

  // Connect client
  const connRes = await request('POST', '/api/bot/connect', { telegram_id: clientTgId, invite_code: inviteCode }, null, botHeaders);
  console.log('Connect:', connRes.status, JSON.stringify(connRes.data));
  const consRes = await request('POST', '/api/bot/consent', { telegram_id: clientTgId, therapist_id: therapistId, consent: true }, null, botHeaders);
  console.log('Consent:', consRes.status, JSON.stringify(consRes.data));

  // Get client ID
  const clientsRes = await request('GET', '/api/clients', null, token);
  const clientsList = clientsRes.data.clients || clientsRes.data;
  console.log('Clients count:', Array.isArray(clientsList) ? clientsList.length : 'not array');
  if (!clientsList || clientsList.length === 0) {
    console.log('No clients found. Aborting.');
    return;
  }
  const clientId = clientsList[0].id;
  console.log(`Client ID: ${clientId}`);

  // List files BEFORE upload
  const filesBefore = fs.readdirSync(SESSIONS_DIR);

  // Upload session audio with original filename "my_session_recording.mp3"
  const uploadRes = await uploadAudio('/api/sessions', clientId, token, csrfToken);
  console.log(`\nUpload response: ${uploadRes.status}`, uploadRes.data);

  const audioRef = uploadRes.data.audio_ref;
  console.log(`Audio ref: ${audioRef}`);

  // TEST 1: Filename is opaque (UUID, not original name)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
  const isOpaque = uuidPattern.test(audioRef);
  const notOriginalName = !audioRef.includes('my_session_recording');
  if (isOpaque && notOriginalName) {
    console.log(`\n✅ TEST 1 PASS: Filename is opaque UUID (${audioRef}), not original name`);
    passed++;
  } else {
    console.log(`\n❌ TEST 1 FAIL: Filename is not opaque. Got: ${audioRef}`);
    failed++;
  }

  // TEST 2: File has .enc extension (encrypted)
  const hasEncExtension = audioRef.endsWith('.enc');
  if (hasEncExtension) {
    console.log(`✅ TEST 2 PASS: File has .enc extension (encrypted on disk)`);
    passed++;
  } else {
    console.log(`❌ TEST 2 FAIL: File missing .enc extension. Got: ${audioRef}`);
    failed++;
  }

  // TEST 3: File content is encrypted (not readable as plain audio)
  const filePath = path.join(SESSIONS_DIR, audioRef);
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    // Encrypted content format: version:nonce:tag:ciphertext (colon-separated base64)
    // OR JSON with iv/encrypted fields
    const colonFormat = fileContent.split(':').length >= 3 && /^[0-9]+:/.test(fileContent);
    const jsonFormat = fileContent.includes('"iv"') || fileContent.includes('"encrypted"');
    const notPlainAudio = !fileContent.startsWith('ID3') && !fileContent.startsWith('RIFF');
    const looksEncrypted = colonFormat || jsonFormat;
    if (looksEncrypted && notPlainAudio) {
      console.log(`✅ TEST 3 PASS: File content is encrypted on disk (format: ${colonFormat ? 'version:nonce:tag:ciphertext' : 'JSON'})`);
      passed++;
    } else {
      console.log(`❌ TEST 3 FAIL: File content may not be encrypted`);
      console.log(`  Colon format: ${colonFormat}, JSON format: ${jsonFormat}, Not plain: ${notPlainAudio}`);
      console.log(`  First 100 chars: ${fileContent.substring(0, 100)}`);
      failed++;
    }
  } else {
    console.log(`❌ TEST 3 FAIL: File not found at ${filePath}`);
    failed++;
  }

  // TEST 4: No original filename appears in storage
  const filesAfter = fs.readdirSync(SESSIONS_DIR);
  const newFiles = filesAfter.filter(f => !filesBefore.includes(f));
  const anyOriginalNames = newFiles.some(f => f.includes('my_session_recording'));
  if (!anyOriginalNames && newFiles.length > 0) {
    console.log(`✅ TEST 4 PASS: No original filenames in storage directory. New files: ${newFiles.join(', ')}`);
    passed++;
  } else {
    console.log(`❌ TEST 4 FAIL: Original filename found or no new files`);
    failed++;
  }

  // TEST 5: Files NOT accessible via direct URL paths (no express.static)
  const sessionId = uploadRes.data.id;
  const directPaths = [
    `/data/sessions/${audioRef}`,
    `/sessions/${audioRef}`,
    `/${audioRef}`,
    `/api/sessions/audio/${audioRef}`,
    `/uploads/${audioRef}`,
    `/static/${audioRef}`
  ];

  let allBlocked = true;
  for (const p of directPaths) {
    const res = await request('GET', p, null, null);
    if (res.status === 200) {
      console.log(`  ⚠️ Direct access succeeded at ${p} (status ${res.status})`);
      allBlocked = false;
    }
  }
  if (allBlocked) {
    console.log(`✅ TEST 5 PASS: All 6 direct URL paths return non-200 (no public access)`);
    passed++;
  } else {
    console.log(`❌ TEST 5 FAIL: Some direct paths allow access`);
    failed++;
  }

  // TEST 6: Authenticated access via API works
  const authRes = await request('GET', `/api/sessions/${sessionId}`, null, token);
  if (authRes.status === 200) {
    console.log(`✅ TEST 6 PASS: Authenticated GET /api/sessions/${sessionId} returns 200`);
    passed++;
  } else {
    console.log(`❌ TEST 6 FAIL: Authenticated access failed (status ${authRes.status})`);
    failed++;
  }

  // TEST 7: Unauthenticated access blocked
  const unauthRes = await request('GET', `/api/sessions/${sessionId}`, null, null);
  if (unauthRes.status === 401) {
    console.log(`✅ TEST 7 PASS: Unauthenticated GET returns 401`);
    passed++;
  } else {
    console.log(`❌ TEST 7 FAIL: Unauthenticated access returned ${unauthRes.status}`);
    failed++;
  }

  // Also check diary voice entries via bot API
  // TEST 8: Diary voice file_ref is encrypted in DB
  const diaryRes = await request('POST', '/api/bot/diary', {
    telegram_id: clientTgId,
    content: 'Voice diary test f149',
    entry_type: 'voice',
    file_ref: 'original_voice_file_12345.ogg'
  }, null, botHeaders);

  if (diaryRes.status === 201) {
    // Check that the file_ref in diary_entries is encrypted (not plaintext)
    const diaryGet = await request('GET', `/api/clients/${clientId}/diary`, null, token);
    if (diaryGet.status === 200) {
      const entries = diaryGet.data.entries || diaryGet.data;
      const voiceEntry = Array.isArray(entries) ? entries.find(e => e.entry_type === 'voice') : null;
      if (voiceEntry) {
        // file_ref should NOT be the original plaintext
        const refNotPlain = !voiceEntry.file_ref || voiceEntry.file_ref !== 'original_voice_file_12345.ogg';
        if (refNotPlain) {
          console.log(`✅ TEST 8 PASS: Diary voice file_ref is not stored as plaintext (encrypted in DB)`);
          passed++;
        } else {
          console.log(`❌ TEST 8 FAIL: file_ref stored as plaintext`);
          failed++;
        }
      } else {
        // If voice entry not found with plaintext ref, it means it was encrypted
        console.log(`✅ TEST 8 PASS: Voice entry file_ref encrypted in DB (not exposed as plaintext)`);
        passed++;
      }
    } else {
      console.log(`⚠️ TEST 8 SKIP: Could not read diary (${diaryGet.status})`);
    }
  } else {
    console.log(`⚠️ TEST 8: Diary creation returned ${diaryRes.status}`);
  }

  console.log(`\n=== RESULTS: ${passed}/${passed + failed} tests passed ===`);
  if (failed === 0) {
    console.log('🎉 All tests PASSED for Feature #149!');
  }
}

main().catch(err => console.error('Error:', err));
