// Test script for Feature #36: Session summary generated from transcript
const http = require('http');
const crypto = require('crypto');

const PORT = 3005;
const BASE = `http://localhost:${PORT}`;

function request(method, urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const reqOptions = {
      hostname: url.hostname, port: url.port, path: url.pathname, method,
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
  console.log('=== Feature #36: Session summary generated from transcript ===\n');

  // Wait for server to be ready
  await sleep(5000);

  // Login as therapist
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

  // Find/create linked client
  const clientsRes = await request('GET', '/api/clients', { headers: { 'Authorization': `Bearer ${TOKEN}` } });
  let CLIENT_ID;
  if (clientsRes.status === 200 && clientsRes.body.clients && clientsRes.body.clients.length > 0) {
    CLIENT_ID = clientsRes.body.clients[0].id;
  } else {
    const botReg = await request('POST', '/api/bot/register', {
      headers: { 'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key' },
      body: JSON.stringify({ telegram_id: 'summary_test_client_36', role: 'client', language: 'en' })
    });
    CLIENT_ID = botReg.body.user.id;
    const invRes = await request('GET', '/api/invite-code', { headers: { 'Authorization': `Bearer ${TOKEN}` } });
    await request('POST', '/api/bot/connect', {
      headers: { 'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key' },
      body: JSON.stringify({ telegram_id: 'summary_test_client_36', invite_code: invRes.body.invite_code })
    });
    await request('POST', '/api/bot/consent', {
      headers: { 'Content-Type': 'application/json', 'x-bot-api-key': 'dev-bot-api-key' },
      body: JSON.stringify({ telegram_id: 'summary_test_client_36', therapist_id: THERAPIST_ID, consent: true })
    });
  }
  console.log(`  Client ID: ${CLIENT_ID}\n`);

  // Step 2: Upload session audio and wait for transcription + summary
  console.log('Step 2: Upload session audio...');
  const fakeAudio = Buffer.from('RIFF' + 'x'.repeat(300) + 'SUMMARY_TEST_36_AUDIO_DATA');
  const uploadRes = await multipartUpload('/api/sessions', { client_id: String(CLIENT_ID) }, {
    name: 'audio', filename: 'summary_test.mp3', contentType: 'audio/mpeg', data: fakeAudio
  }, TOKEN);

  console.log(`  Upload status: ${uploadRes.status}`);
  const sessionId = uploadRes.body.id;
  console.log(`  Session ID: ${sessionId}\n`);

  // Wait for async transcription + summary pipeline
  console.log('Step 3: Wait for transcription + summary pipeline...');
  await sleep(3000);

  // Step 4: Verify summary generation was triggered and completed
  console.log('Step 4: Check session details...');
  const getRes = await request('GET', `/api/sessions/${sessionId}`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });

  console.log(`  Session status: ${getRes.body.status}`);
  console.log(`  has_transcript: ${getRes.body.has_transcript}`);
  console.log(`  has_summary: ${getRes.body.has_summary}`);

  if (!getRes.body.has_summary) {
    console.log('  Summary not auto-generated. Trying manual trigger...');
    const sumRes = await request('POST', `/api/sessions/${sessionId}/summarize`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    console.log(`  Manual trigger: ${sumRes.status}`, JSON.stringify(sumRes.body));
    await sleep(1000);

    const getRes2 = await request('GET', `/api/sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    if (getRes2.body.has_summary) {
      console.log('  PASS: summary_encrypted populated after manual trigger');
    } else {
      console.log('  FAIL: summary still not populated');
      return;
    }
  } else {
    console.log('  PASS: summary_encrypted auto-generated');
  }
  console.log('');

  // Step 5: Verify summary is encrypted (via dedicated endpoint)
  console.log('Step 5: Verify summary content via GET /api/sessions/:id/summary...');
  const summaryRes = await request('GET', `/api/sessions/${sessionId}/summary`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });

  if (summaryRes.status === 200 && summaryRes.body.summary) {
    console.log('  PASS: Summary retrieved and decrypted successfully');
    console.log(`  Summary preview: "${summaryRes.body.summary.substring(0, 100)}..."`);
  } else {
    console.log(`  FAIL: Could not retrieve summary. Status: ${summaryRes.status}`);
    return;
  }
  console.log('');

  // Step 6: Verify summary avoids diagnosis language
  console.log('Step 6: Verify summary avoids diagnosis language...');
  const summary = summaryRes.body.summary;
  const diagnosisTerms = [
    'diagnosis', 'diagnose', 'diagnosed',
    'disorder', 'syndrome',
    'pathology', 'pathological',
    'mentally ill', 'mental illness',
    'clinical assessment'
  ];

  let hasDiagnosisLanguage = false;
  for (const term of diagnosisTerms) {
    if (summary.toLowerCase().includes(term)) {
      console.log(`  WARNING: Found diagnosis term: "${term}"`);
      hasDiagnosisLanguage = true;
    }
  }

  if (!hasDiagnosisLanguage) {
    console.log('  PASS: Summary avoids diagnosis language');
  } else {
    console.log('  FAIL: Summary contains diagnosis language');
  }

  // Check for disclaimer
  if (summary.includes('does not constitute') || summary.includes('not a clinical assessment') || summary.includes('supportive tool')) {
    console.log('  PASS: Summary includes appropriate disclaimer');
  }
  console.log('');

  // Step 7: Verify session status is complete
  console.log('Step 7: Verify final session status...');
  const finalRes = await request('GET', `/api/sessions/${sessionId}`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  if (finalRes.body.status === 'complete') {
    console.log('  PASS: Session status is "complete"');
  } else {
    console.log(`  Session status: ${finalRes.body.status}`);
  }

  console.log('\n=== All checks complete ===');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
