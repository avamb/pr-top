// Test script for Feature #34: Therapist can upload session audio via API
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3002;
const BASE = `http://localhost:${PORT}`;

function request(method, urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: options.headers || {}
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      if (typeof options.body === 'string' || Buffer.isBuffer(options.body)) {
        req.write(options.body);
      }
    }
    req.end();
  });
}

function multipartUpload(urlPath, fields, fileField, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + crypto.randomBytes(8).toString('hex');
    const url = new URL(urlPath, BASE);

    let body = '';

    // Add text fields
    for (const [key, value] of Object.entries(fields)) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      body += `${value}\r\n`;
    }

    // Add file field
    if (fileField) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\n`;
      body += `Content-Type: ${fileField.contentType}\r\n\r\n`;
    }

    const bodyStart = Buffer.from(body, 'utf-8');
    const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    const fileData = fileField ? fileField.data : Buffer.alloc(0);
    const fullBody = Buffer.concat([bodyStart, fileData, bodyEnd]);

    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

async function runTests() {
  console.log('=== Feature #34: Therapist can upload session audio via API ===\n');

  // Step 1: Login as therapist
  console.log('Step 1: Login as therapist...');
  const loginRes = await request('POST', '/api/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'session_test@test.com', password: 'TestPass123' })
  });

  if (loginRes.status !== 200) {
    // Register first
    console.log('  Registering therapist first...');
    const regRes = await request('POST', '/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'session_test@test.com', password: 'TestPass123', confirmPassword: 'TestPass123' })
    });
    if (regRes.status !== 201 && regRes.status !== 200) {
      console.log('  FAIL: Could not register/login. Status:', regRes.status, regRes.body);
      return;
    }
    var TOKEN = regRes.body.token;
    var THERAPIST_ID = regRes.body.user.id;
  } else {
    var TOKEN = loginRes.body.token;
    var THERAPIST_ID = loginRes.body.user.id;
  }
  console.log(`  OK: Logged in as therapist ID ${THERAPIST_ID}\n`);

  // Find a linked client
  console.log('Step 1b: Find linked client...');
  const clientsRes = await request('GET', '/api/clients', {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });

  let CLIENT_ID;
  if (clientsRes.status === 200 && clientsRes.body.clients && clientsRes.body.clients.length > 0) {
    CLIENT_ID = clientsRes.body.clients[0].id;
    console.log(`  OK: Found linked client ID ${CLIENT_ID}\n`);
  } else {
    // Create a client via bot API
    console.log('  No linked clients found. Creating one via bot API...');
    const botReg = await request('POST', '/api/bot/register', {
      headers: { 'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key' },
      body: JSON.stringify({ telegram_id: 'test_client_for_session_34', role: 'client', language: 'en' })
    });
    CLIENT_ID = botReg.body.user.id;

    // Get therapist invite code
    const invRes = await request('GET', '/api/invite-code', {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const inviteCode = invRes.body.invite_code;

    // Connect and consent
    await request('POST', '/api/bot/connect', {
      headers: { 'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key' },
      body: JSON.stringify({ telegram_id: 'test_client_for_session_34', invite_code: inviteCode })
    });
    await request('POST', '/api/bot/consent', {
      headers: { 'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key' },
      body: JSON.stringify({ telegram_id: 'test_client_for_session_34', therapist_id: THERAPIST_ID, consent: true })
    });
    console.log(`  OK: Created and linked client ID ${CLIENT_ID}\n`);
  }

  // Step 2: POST /api/sessions with audio file and client_id
  console.log('Step 2: Upload session audio...');
  const fakeAudioData = Buffer.from('RIFF' + 'x'.repeat(100) + 'FAKE_AUDIO_SESSION_TEST_34');
  const uploadRes = await multipartUpload('/api/sessions', { client_id: String(CLIENT_ID) }, {
    name: 'audio',
    filename: 'session_recording.mp3',
    contentType: 'audio/mpeg',
    data: fakeAudioData
  }, TOKEN);

  console.log(`  Upload response status: ${uploadRes.status}`);
  console.log(`  Upload response body:`, JSON.stringify(uploadRes.body, null, 2));

  // Step 3: Verify 201 response with session ID
  if (uploadRes.status === 201) {
    console.log('  PASS: Got 201 response');
  } else {
    console.log(`  FAIL: Expected 201, got ${uploadRes.status}`);
    return;
  }

  const sessionId = uploadRes.body.id;
  if (sessionId) {
    console.log(`  PASS: Session ID returned: ${sessionId}`);
  } else {
    console.log('  FAIL: No session ID in response');
    return;
  }
  console.log('');

  // Step 4: Verify session record in database via GET
  console.log('Step 3: Verify session record via GET /api/sessions/:id ...');
  const getRes = await request('GET', `/api/sessions/${sessionId}`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  console.log(`  GET response status: ${getRes.status}`);
  console.log(`  Session details:`, JSON.stringify(getRes.body, null, 2));

  if (getRes.status === 200 && getRes.body.id === sessionId) {
    console.log('  PASS: Session record exists in database');
  } else {
    console.log('  FAIL: Could not retrieve session record');
    return;
  }
  console.log('');

  // Step 5: Verify audio_ref is set
  console.log('Step 4: Verify audio_ref is set...');
  if (getRes.body.audio_ref) {
    console.log(`  PASS: audio_ref = ${getRes.body.audio_ref}`);
  } else {
    console.log('  FAIL: audio_ref is not set');
    return;
  }
  console.log('');

  // Step 6: Verify file is stored encrypted
  console.log('Step 5: Verify file is stored encrypted (not publicly accessible)...');
  const audioRef = getRes.body.audio_ref;

  // Check the file exists on disk and is encrypted (.enc extension)
  if (audioRef.endsWith('.enc')) {
    console.log('  PASS: File has .enc extension (encrypted)');
  } else {
    console.log(`  WARNING: File ref ${audioRef} - checking if encrypted content`);
  }

  // Try to access the file via a direct public URL (should fail - 404)
  const publicRes = await request('GET', `/sessions/${audioRef}`);
  if (publicRes.status === 404) {
    console.log('  PASS: File is NOT publicly accessible (404)');
  } else {
    console.log(`  Status when accessing directly: ${publicRes.status} (should be 404)`);
  }

  // Also try under /data/sessions
  const publicRes2 = await request('GET', `/data/sessions/${audioRef}`);
  if (publicRes2.status === 404) {
    console.log('  PASS: File is NOT accessible via /data/sessions/ (404)');
  } else {
    console.log(`  Status: ${publicRes2.status}`);
  }

  // Verify the encrypted file exists on disk
  const sessionsDir = path.resolve(__dirname, 'src/backend/data/sessions');
  const encFilePath = path.join(sessionsDir, audioRef);
  if (fs.existsSync(encFilePath)) {
    const fileContent = fs.readFileSync(encFilePath, 'utf-8');
    // Encrypted data format: version:iv:authTag:ciphertext
    const parts = fileContent.split(':');
    if (parts.length === 4 && !isNaN(parseInt(parts[0]))) {
      console.log('  PASS: File on disk is in encrypted format (version:iv:authTag:ciphertext)');
    } else {
      console.log('  WARNING: File exists but may not be in expected encrypted format');
      console.log('  Content preview:', fileContent.substring(0, 80));
    }
  } else {
    console.log(`  File path checked: ${encFilePath}`);
    // List sessions directory
    if (fs.existsSync(sessionsDir)) {
      console.log('  Files in sessions dir:', fs.readdirSync(sessionsDir));
    } else {
      console.log('  Sessions directory does not exist yet');
    }
  }

  // Test: upload without auth should fail
  console.log('\nStep 6: Verify auth required...');
  const noAuthRes = await multipartUpload('/api/sessions', { client_id: String(CLIENT_ID) }, {
    name: 'audio',
    filename: 'test.mp3',
    contentType: 'audio/mpeg',
    data: Buffer.from('test')
  }, 'invalid-token');
  if (noAuthRes.status === 401) {
    console.log('  PASS: Upload rejected without valid auth (401)');
  } else {
    console.log(`  Status: ${noAuthRes.status} (expected 401)`);
  }

  console.log('\n=== All checks complete ===');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
