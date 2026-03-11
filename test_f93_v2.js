const http = require('http');

function request(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: Object.assign({}, headers || {})
    };
    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
    }
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request(opts, res => {
      let b = '';
      const cookies = res.headers['set-cookie'] || [];
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b), cookies }); }
        catch(e) { resolve({ status: res.statusCode, body: b, cookies }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Get CSRF token
  const csrf = await request('GET', '/api/csrf-token');
  const csrfToken = csrf.body.csrfToken;
  console.log('CSRF token obtained');

  // Register a therapist
  const email = 'therapist_f93_' + Date.now() + '@test.com';
  const reg = await request('POST', '/api/auth/register',
    { email, password: 'Test123!', role: 'therapist' },
    { 'x-csrf-token': csrfToken }
  );
  console.log('Register:', reg.status, JSON.stringify(reg.body).substring(0, 200));

  // Login (with Bearer token, skips CSRF)
  const login = await request('POST', '/api/auth/login',
    { email, password: 'Test123!' },
    { 'x-csrf-token': csrfToken }
  );
  console.log('Login:', login.status);

  if (login.status !== 200) {
    console.log('Login failed:', JSON.stringify(login.body));
    return;
  }

  const token = login.body.token;
  const auth = { 'Authorization': 'Bearer ' + token };

  // Register a client via bot API (needs x-bot-api-key)
  const botHeaders = { 'x-bot-api-key': 'dev-bot-api-key' };
  const telegramId = 'f93_client_' + Date.now();
  const botReg = await request('POST', '/api/bot/register',
    { telegram_id: telegramId, role: 'client', language: 'en' },
    botHeaders
  );
  console.log('Bot register client:', botReg.status);

  // Get therapist invite code
  const invite = await request('GET', '/api/invite-code', null, auth);
  console.log('Invite code:', invite.body.invite_code || invite.body.code);
  const inviteCode = invite.body.invite_code || invite.body.code;

  // Connect client to therapist
  const connect = await request('POST', '/api/bot/connect',
    { telegram_id: telegramId, invite_code: inviteCode },
    botHeaders
  );
  console.log('Connect:', connect.status, JSON.stringify(connect.body).substring(0, 200));
  const therapistId = connect.body.therapist ? connect.body.therapist.id : null;

  // Consent
  const consent = await request('POST', '/api/bot/consent',
    { telegram_id: telegramId, therapist_id: therapistId, consent: true },
    botHeaders
  );
  console.log('Consent:', consent.status);

  // Verify client appears
  const clients = await request('GET', '/api/clients', null, auth);
  const clientList = clients.body.clients || [];
  console.log('Clients:', clientList.length);

  if (clientList.length === 0) {
    console.log('No clients linked. Cannot proceed.');
    return;
  }

  const clientId = clientList[0].id;

  // Upload a test session with audio content that mentions therapy topics
  const boundary = '----FB' + Date.now();
  const audioContent = Buffer.from('This is a simulated audio transcript about anxiety and breathing exercises and sleep patterns and family relationships and work stress and mood changes and progress with therapy goals');
  const bodyParts = [
    '--' + boundary + '\r\nContent-Disposition: form-data; name="audio"; filename="session_f93.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n',
  ];
  const bodyBuf = Buffer.concat([
    Buffer.from(bodyParts[0]),
    audioContent,
    Buffer.from('\r\n--' + boundary + '\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n' + clientId + '\r\n--' + boundary + '--\r\n')
  ]);

  const upload = await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001, path: '/api/sessions', method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': bodyBuf.length,
        'Authorization': 'Bearer ' + token
      }
    };
    const req = http.request(opts, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch(e) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    req.write(bodyBuf); req.end();
  });

  console.log('Upload session:', upload.status);
  const uploadData = upload.body.session || upload.body;
  if (!uploadData || !uploadData.id) {
    console.log('Upload response:', JSON.stringify(upload.body).substring(0, 300));
    return;
  }

  const sessionId = uploadData.id;
  console.log('Session ID:', sessionId);

  // Wait for async pipeline (transcription + summarization)
  console.log('Waiting for pipeline...');
  await new Promise(r => setTimeout(r, 5000));

  // Check status
  let detail = await request('GET', '/api/sessions/' + sessionId, null, auth);
  let session = detail.body.session;
  console.log('Status after 5s:', session ? session.status : 'unknown');

  if (!session || !session.summary) {
    // Try manual triggers
    const transcribe = await request('POST', '/api/sessions/' + sessionId + '/transcribe', {}, auth);
    console.log('Transcribe trigger:', transcribe.status);
    await new Promise(r => setTimeout(r, 3000));

    const summarize = await request('POST', '/api/sessions/' + sessionId + '/summarize', {}, auth);
    console.log('Summarize trigger:', summarize.status);
    await new Promise(r => setTimeout(r, 3000));

    detail = await request('GET', '/api/sessions/' + sessionId, null, auth);
    session = detail.body.session;
    console.log('Status after manual triggers:', session ? session.status : 'unknown');
  }

  if (session && session.summary) {
    console.log('\n========== AI SUMMARY ==========');
    console.log(session.summary);
    console.log('================================\n');

    // Run all verification checks
    const lower = session.summary.toLowerCase();
    let allPass = true;

    // Step 1: No DSM/ICD labels
    console.log('--- Step 1: No DSM/ICD labels ---');
    const diagLabels = [
      'major depressive disorder', 'generalized anxiety disorder',
      'post-traumatic stress disorder', 'bipolar disorder',
      'schizophrenia', 'obsessive-compulsive disorder',
      'attention deficit', 'borderline personality',
      'anorexia nervosa', 'bulimia nervosa',
      'dysthymia', 'panic disorder', 'psychosis', 'dissociative disorder',
      'F32', 'F33', 'F41', 'F43', 'ICD-10', 'DSM-5', 'DSM-IV'
    ];
    const foundLabels = diagLabels.filter(l => lower.includes(l.toLowerCase()));
    if (foundLabels.length === 0) {
      console.log('PASS: No DSM/ICD labels');
    } else {
      console.log('FAIL:', foundLabels);
      allPass = false;
    }

    // Step 2: Uses "client reports" not "client has [diagnosis]"
    console.log('\n--- Step 2: Descriptive language ---');
    if (/client has (depression|anxiety|disorder|PTSD|bipolar|OCD)/i.test(session.summary)) {
      console.log('FAIL: Found "client has [diagnosis]"');
      allPass = false;
    } else {
      console.log('PASS: No "client has [diagnosis]"');
    }
    if (/client report|client describ/i.test(session.summary)) {
      console.log('PASS: Uses "client reports/describes"');
    }

    // Step 3: No overclaiming
    console.log('\n--- Step 3: No overclaiming ---');
    const overclaim = ['suffers from', 'is diagnosed with', 'exhibits symptoms of', 'meets criteria for'];
    const foundOC = overclaim.filter(p => lower.includes(p));
    if (foundOC.length === 0) {
      console.log('PASS: No overclaiming');
    } else {
      console.log('FAIL:', foundOC);
      allPass = false;
    }

    // Step 4: Supportive tone
    console.log('\n--- Step 4: Supportive disclaimer ---');
    if (lower.includes('supportive tool') || lower.includes('session preparation') || lower.includes('observed themes')) {
      console.log('PASS: Has supportive disclaimer');
    } else {
      console.log('NOTE: No explicit disclaimer found');
    }

    console.log('\n=== OVERALL: ' + (allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED') + ' ===');
  } else {
    console.log('No summary generated. Full session:', JSON.stringify(session).substring(0, 500));
  }
}

main().catch(console.error);
