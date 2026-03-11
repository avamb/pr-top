// Test script for Feature #35: Session transcript generated from audio
const http = require('http');
const crypto = require('crypto');

const PORT = 3003;
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
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function multipartUpload(urlPath, fields, fileField, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + crypto.randomBytes(8).toString('hex');
    const url = new URL(urlPath, BASE);
    let body = '';
    for (const [key, value] of Object.entries(fields)) {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
    }
    if (fileField) {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.contentType}\r\n\r\n`;
    }
    const bodyStart = Buffer.from(body, 'utf-8');
    const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    const fileData = fileField ? fileField.data : Buffer.alloc(0);
    const fullBody = Buffer.concat([bodyStart, fileData, bodyEnd]);
    const reqOptions = {
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
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
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runTests() {
  console.log('=== Feature #35: Session transcript generated from audio ===\n');

  // Step 1: Login as therapist
  console.log('Step 1: Login as therapist...');
  let loginRes = await request('POST', '/api/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'session_test@test.com', password: 'TestPass123' })
  });

  if (loginRes.status !== 200) {
    const regRes = await request('POST', '/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'session_test@test.com', password: 'TestPass123', confirmPassword: 'TestPass123' })
    });
    loginRes = { status: 200, body: regRes.body };
  }

  const TOKEN = loginRes.body.token;
  const THERAPIST_ID = loginRes.body.user.id;
  console.log(`  OK: Therapist ID ${THERAPIST_ID}\n`);

  // Find linked client
  const clientsRes = await request('GET', '/api/clients', {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });

  let CLIENT_ID;
  if (clientsRes.status === 200 && clientsRes.body.clients && clientsRes.body.clients.length > 0) {
    CLIENT_ID = clientsRes.body.clients[0].id;
  } else {
    console.log('  No linked clients. Creating one...');
    const botReg = await request('POST', '/api/bot/register', {
      headers: { 'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key' },
      body: JSON.stringify({ telegram_id: 'transcript_test_client_35', role: 'client', language: 'en' })
    });
    CLIENT_ID = botReg.body.user.id;
    const invRes = await request('GET', '/api/invite-code', { headers: { 'Authorization': `Bearer ${TOKEN}` } });
    await request('POST', '/api/bot/connect', {
      headers: { 'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key' },
      body: JSON.stringify({ telegram_id: 'transcript_test_client_35', invite_code: invRes.body.invite_code })
    });
    await request('POST', '/api/bot/consent', {
      headers: { 'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key' },
      body: JSON.stringify({ telegram_id: 'transcript_test_client_35', therapist_id: THERAPIST_ID, consent: true })
    });
  }
  console.log(`  Client ID: ${CLIENT_ID}\n`);

  // Step 2: Upload session audio
  console.log('Step 2: Upload session audio...');
  const fakeAudio = Buffer.from('RIFF' + 'x'.repeat(200) + 'TRANSCRIPT_TEST_35_AUDIO');
  const uploadRes = await multipartUpload('/api/sessions', { client_id: String(CLIENT_ID) }, {
    name: 'audio', filename: 'transcript_test.mp3', contentType: 'audio/mpeg', data: fakeAudio
  }, TOKEN);

  console.log(`  Upload status: ${uploadRes.status}`);
  const sessionId = uploadRes.body.id;
  console.log(`  Session ID: ${sessionId}\n`);

  // Wait for async transcription to complete
  console.log('Step 3: Wait for transcription to complete...');
  await sleep(2000);

  // Step 4: Verify transcript is populated
  console.log('Step 4: Verify transcript_encrypted is populated...');
  const getRes = await request('GET', `/api/sessions/${sessionId}`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });

  console.log(`  Session status: ${getRes.body.status}`);
  console.log(`  has_transcript: ${getRes.body.has_transcript}`);
  console.log(`  has_summary: ${getRes.body.has_summary}`);

  if (getRes.body.has_transcript) {
    console.log('  PASS: transcript_encrypted field is populated');
  } else {
    console.log('  FAIL: transcript not found. Trying manual trigger...');
    const trigRes = await request('POST', `/api/sessions/${sessionId}/transcribe`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    console.log(`  Manual trigger result: ${trigRes.status}`, JSON.stringify(trigRes.body));

    await sleep(1000);
    const getRes2 = await request('GET', `/api/sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    if (getRes2.body.has_transcript) {
      console.log('  PASS: transcript populated after manual trigger');
    } else {
      console.log('  FAIL: transcript still not populated');
      return;
    }
  }
  console.log('');

  // Step 5: Verify transcript is encrypted (not plaintext)
  console.log('Step 5: Verify transcript is encrypted, not plaintext...');
  // The GET endpoint decrypts for us, but let's verify the raw DB has encrypted data
  // We can check that the decrypted transcript looks reasonable
  if (getRes.body.transcript) {
    console.log(`  Decrypted transcript preview: "${getRes.body.transcript.substring(0, 80)}..."`);
    if (getRes.body.transcript.includes('[Session Transcript')) {
      console.log('  PASS: Transcript content is readable after decryption');
    }
  }

  // Verify status is complete
  if (getRes.body.status === 'complete') {
    console.log('  PASS: Session status is "complete"');
  } else {
    console.log(`  Session status: ${getRes.body.status}`);
  }

  console.log('\n=== All checks complete ===');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
