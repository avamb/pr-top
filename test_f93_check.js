const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: 'localhost', port: 3001, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const req = http.request(opts, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch(e) { resolve({ status: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3001, path, headers: {} };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    http.get(opts, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b) }); }
        catch(e) { resolve({ status: res.statusCode, body: b }); }
      });
    }).on('error', reject);
  });
}

async function main() {
  // Try various known test accounts
  const accounts = [
    { email: 'therapist@test.com', password: 'Test123!' },
    { email: 'test@therapist.com', password: 'Test123!' },
    { email: 'admin@psylink.app', password: 'Admin123!' },
  ];

  let token = null;
  let role = null;
  for (const acc of accounts) {
    const login = await post('/api/auth/login', acc);
    if (login.status === 200) {
      token = login.body.token;
      role = login.body.user ? login.body.user.role : 'unknown';
      console.log('Logged in as', acc.email, 'role:', role);
      break;
    }
  }

  if (!token) {
    console.log('No existing accounts work. Registering new therapist...');
    const reg = await post('/api/auth/register', { email: 'therapist_sum@test.com', password: 'Test123!', role: 'therapist' });
    console.log('Register:', reg.status);
    const l = await post('/api/auth/login', { email: 'therapist_sum@test.com', password: 'Test123!' });
    token = l.body.token;
    role = 'therapist';
  }

  // If admin, list users to find a therapist
  if (role === 'superadmin') {
    const stats = await get('/api/admin/stats/users', token);
    console.log('Admin stats:', JSON.stringify(stats.body).substring(0, 300));

    // Try to find therapist accounts
    const therapists = await get('/api/admin/therapists', token);
    if (therapists.body && therapists.body.length > 0) {
      console.log('Found therapists:', therapists.body.map(t => t.email).join(', '));
      // Login as first therapist
      for (const t of therapists.body) {
        const tLogin = await post('/api/auth/login', { email: t.email, password: 'Test123!' });
        if (tLogin.status === 200) {
          token = tLogin.body.token;
          console.log('Switched to therapist:', t.email);
          break;
        }
      }
    }
  }

  // Get clients list
  const clients = await get('/api/clients', token);
  const clientList = clients.body.clients || [];
  console.log('Total clients:', clientList.length);

  // Search for sessions with summaries
  let foundSummary = false;
  for (const client of clientList.slice(0, 10)) {
    const sessions = await get('/api/clients/' + client.id + '/sessions', token);
    const sessList = sessions.body.sessions || [];
    if (sessList.length > 0) {
      console.log('Client', client.id, 'has', sessList.length, 'sessions');
    }
    for (const sess of sessList) {
      if (sess.status === 'complete' || sess.summary) {
        const detail = await get('/api/sessions/' + sess.id, token);
        const s = detail.body.session;
        if (s && s.summary) {
          console.log('\n=== SESSION #' + s.id + ' SUMMARY ===');
          console.log(s.summary);
          foundSummary = true;

          // Run verification checks
          checkSummary(s.summary);
          break;
        }
      }
    }
    if (foundSummary) break;
  }

  if (!foundSummary) {
    console.log('\nNo existing summaries found. Testing generateSummary directly...');
    // Test the summary generation function directly by calling summarize on an existing session
    // or by checking the code logic
    console.log('Will verify via code review and manual summary generation test');

    // If we have a client, upload a session
    if (clientList.length > 0) {
      const clientId = clientList[0].id;
      const boundary = '----FormBoundary' + Date.now();
      const audioContent = Buffer.from('fake audio about anxiety and sleep and breathing exercises and family relationships');
      const body = Buffer.concat([
        Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="audio"; filename="test_f93.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'),
        audioContent,
        Buffer.from('\r\n--' + boundary + '\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n' + clientId + '\r\n--' + boundary + '--\r\n')
      ]);

      const upload = await new Promise((resolve, reject) => {
        const opts = {
          hostname: 'localhost', port: 3001, path: '/api/sessions', method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data; boundary=' + boundary,
            'Content-Length': body.length,
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
        req.write(body); req.end();
      });

      console.log('Upload:', upload.status);
      if (upload.body.session) {
        const sid = upload.body.session.id;
        // Wait for pipeline
        await new Promise(r => setTimeout(r, 4000));
        const detail = await get('/api/sessions/' + sid, token);
        const s = detail.body.session;
        console.log('Session status:', s ? s.status : 'unknown');
        if (s && s.summary) {
          console.log('\n=== GENERATED SUMMARY ===');
          console.log(s.summary);
          checkSummary(s.summary);
        } else {
          // Trigger manually
          const trig = await post('/api/sessions/' + sid + '/summarize', {}, token);
          console.log('Manual summarize trigger:', trig.status, JSON.stringify(trig.body).substring(0, 200));
          await new Promise(r => setTimeout(r, 3000));
          const detail2 = await get('/api/sessions/' + sid, token);
          if (detail2.body.session && detail2.body.session.summary) {
            console.log('\n=== GENERATED SUMMARY (manual) ===');
            console.log(detail2.body.session.summary);
            checkSummary(detail2.body.session.summary);
          } else {
            console.log('Still no summary. Status:', detail2.body.session ? detail2.body.session.status : 'unknown');
          }
        }
      }
    }
  }
}

function checkSummary(summary) {
  const lower = summary.toLowerCase();
  let pass = true;

  // 1. Check no DSM/ICD labels
  const diagLabels = [
    'major depressive disorder', 'generalized anxiety disorder', 'GAD',
    'PTSD', 'post-traumatic stress disorder', 'bipolar disorder',
    'schizophrenia', 'OCD', 'obsessive-compulsive disorder',
    'ADHD', 'attention deficit', 'borderline personality',
    'anorexia nervosa', 'bulimia nervosa', 'eating disorder',
    'dysthymia', 'panic disorder', 'psychosis', 'dissociative disorder',
    'F32', 'F33', 'F41', 'F43', 'ICD-10', 'DSM-5', 'DSM-IV'
  ];

  console.log('\n--- Verification Step 1: No DSM/ICD labels ---');
  const foundLabels = diagLabels.filter(l => lower.includes(l.toLowerCase()));
  if (foundLabels.length === 0) {
    console.log('✅ PASS: No DSM/ICD diagnostic labels found');
  } else {
    console.log('❌ FAIL: Found diagnostic labels:', foundLabels);
    pass = false;
  }

  // 2. Check uses "client reports" not "client has"
  console.log('\n--- Verification Step 2: Uses "client reports" not "client has" ---');
  const hasClientHas = /client has (depression|anxiety|disorder|diagnosis|PTSD|bipolar)/i.test(summary);
  const hasClientReports = /client report/i.test(summary) || /client describ/i.test(summary);
  if (!hasClientHas) {
    console.log('✅ PASS: No "client has [diagnosis]" language');
  } else {
    console.log('❌ FAIL: Found "client has [diagnosis]" language');
    pass = false;
  }
  if (hasClientReports) {
    console.log('✅ PASS: Uses descriptive "client reports/describes" language');
  } else {
    console.log('⚠️  NOTE: No explicit "client reports" found (may use other descriptive terms)');
  }

  // 3. Check no overclaiming
  console.log('\n--- Verification Step 3: No overclaiming language ---');
  const overclaimPatterns = [
    'suffers from', 'is diagnosed with', 'exhibits symptoms of',
    'meets criteria for', 'patient presents with', 'clearly has',
    'definitely', 'certainly suffering'
  ];
  const foundOverclaim = overclaimPatterns.filter(p => lower.includes(p));
  if (foundOverclaim.length === 0) {
    console.log('✅ PASS: No overclaiming language found');
  } else {
    console.log('❌ FAIL: Found overclaiming:', foundOverclaim);
    pass = false;
  }

  // 4. Check it's supportive/descriptive
  console.log('\n--- Verification Step 4: Supportive/descriptive tone ---');
  const supportiveTerms = ['supportive tool', 'session preparation', 'observed', 'discussed', 'reported'];
  const foundSupportive = supportiveTerms.filter(t => lower.includes(t));
  console.log('Supportive terms found:', foundSupportive.length > 0 ? foundSupportive : 'none');

  console.log('\n=== OVERALL: ' + (pass ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED') + ' ===');
}

main().catch(console.error);
