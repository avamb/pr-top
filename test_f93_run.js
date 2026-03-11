const http = require('http');

function request(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: headers || {}
    };
    const req = http.request(opts, res => {
      let b = '';
      // Capture cookies
      const cookies = res.headers['set-cookie'] || [];
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(b), cookies }); }
        catch(e) { resolve({ status: res.statusCode, body: b, cookies }); }
      });
    });
    req.on('error', reject);
    if (body) {
      const data = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(data);
    }
    req.end();
  });
}

async function main() {
  // 1. Get CSRF token
  const csrf = await request('GET', '/api/csrf-token');
  console.log('CSRF response:', JSON.stringify(csrf.body));
  const csrfToken = csrf.body.csrfToken || csrf.body.token;
  const csrfCookie = csrf.cookies.find(c => c.includes('csrf')) || '';
  console.log('CSRF token:', csrfToken);
  console.log('CSRF cookie:', csrfCookie.split(';')[0]);

  const cookieHeader = csrfCookie.split(';')[0];

  // 2. Login as admin
  const login = await request('POST', '/api/auth/login',
    JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' }),
    {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      'Cookie': cookieHeader
    }
  );
  console.log('Admin login:', login.status, login.body.user ? login.body.user.role : 'failed');

  if (login.status !== 200) {
    console.log('Login details:', JSON.stringify(login.body));
    return;
  }

  const adminToken = login.body.token;
  const authCookies = login.cookies.filter(c => c.includes('session')).map(c => c.split(';')[0]).join('; ');
  const allCookies = [cookieHeader, authCookies].filter(Boolean).join('; ');

  // 3. Get therapist list
  const therapists = await request('GET', '/api/admin/therapists', null, {
    'Authorization': 'Bearer ' + adminToken,
    'Cookie': allCookies
  });
  console.log('Therapists:', therapists.status);

  if (therapists.body && Array.isArray(therapists.body)) {
    console.log('Therapist emails:', therapists.body.map(t => t.email).join(', '));
    // Login as first therapist
    for (const t of therapists.body) {
      const tLogin = await request('POST', '/api/auth/login',
        JSON.stringify({ email: t.email, password: 'Test123!' }),
        {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          'Cookie': cookieHeader
        }
      );
      if (tLogin.status === 200) {
        console.log('Logged in as therapist:', t.email);
        const thToken = tLogin.body.token;
        const thCookies = [cookieHeader, ...tLogin.cookies.filter(c => c.includes('session')).map(c => c.split(';')[0])].join('; ');

        // Get clients
        const clients = await request('GET', '/api/clients', null, {
          'Authorization': 'Bearer ' + thToken,
          'Cookie': thCookies
        });
        const clientList = clients.body.clients || [];
        console.log('Clients:', clientList.length);

        // Find sessions with summaries
        for (const client of clientList.slice(0, 10)) {
          const sessions = await request('GET', '/api/clients/' + client.id + '/sessions', null, {
            'Authorization': 'Bearer ' + thToken,
            'Cookie': thCookies
          });
          const sessList = sessions.body.sessions || [];
          for (const sess of sessList) {
            const detail = await request('GET', '/api/sessions/' + sess.id, null, {
              'Authorization': 'Bearer ' + thToken,
              'Cookie': thCookies
            });
            const s = detail.body.session;
            if (s && s.summary) {
              console.log('\n=== SESSION #' + s.id + ' SUMMARY ===');
              console.log(s.summary);
              checkSummary(s.summary);
              return;
            }
          }
        }

        // No summaries found - upload a test session
        console.log('\nNo summaries found. Uploading test session...');
        if (clientList.length > 0) {
          const cid = clientList[0].id;
          const boundary = '----FB' + Date.now();
          const audio = Buffer.from('test audio about anxiety breathing sleep relationships family mood stress');
          const parts = [
            '--' + boundary + '\r\nContent-Disposition: form-data; name="audio"; filename="test93.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n',
            '--' + boundary + '\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n' + cid + '\r\n--' + boundary + '--\r\n'
          ];
          const bodyBuf = Buffer.concat([Buffer.from(parts[0]), audio, Buffer.from('\r\n' + parts[1])]);

          const upload = await new Promise((resolve, reject) => {
            const opts = {
              hostname: 'localhost', port: 3001, path: '/api/sessions', method: 'POST',
              headers: {
                'Content-Type': 'multipart/form-data; boundary=' + boundary,
                'Content-Length': bodyBuf.length,
                'Authorization': 'Bearer ' + thToken,
                'Cookie': thCookies,
                'x-csrf-token': csrfToken
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

          console.log('Upload:', upload.status);
          if (upload.body && upload.body.session) {
            const sid = upload.body.session.id;
            await new Promise(r => setTimeout(r, 5000));
            const d = await request('GET', '/api/sessions/' + sid, null, {
              'Authorization': 'Bearer ' + thToken,
              'Cookie': thCookies
            });
            if (d.body.session && d.body.session.summary) {
              console.log('\n=== GENERATED SUMMARY ===');
              console.log(d.body.session.summary);
              checkSummary(d.body.session.summary);
            } else {
              console.log('Status:', d.body.session ? d.body.session.status : 'unknown');
              // Try manual trigger
              await request('POST', '/api/sessions/' + sid + '/summarize', '{}', {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + thToken,
                'Cookie': thCookies,
                'x-csrf-token': csrfToken
              });
              await new Promise(r => setTimeout(r, 3000));
              const d2 = await request('GET', '/api/sessions/' + sid, null, {
                'Authorization': 'Bearer ' + thToken,
                'Cookie': thCookies
              });
              if (d2.body.session && d2.body.session.summary) {
                console.log('\n=== GENERATED SUMMARY (manual trigger) ===');
                console.log(d2.body.session.summary);
                checkSummary(d2.body.session.summary);
              } else {
                console.log('Still no summary. Status:', d2.body.session ? d2.body.session.status : 'unknown');
              }
            }
          }
        }
        return;
      }
    }
  }

  console.log('Could not login as any therapist');
}

function checkSummary(summary) {
  const lower = summary.toLowerCase();
  let allPass = true;

  console.log('\n--- Step 1: No DSM/ICD labels ---');
  const diagLabels = [
    'major depressive disorder', 'generalized anxiety disorder',
    'post-traumatic stress disorder', 'bipolar disorder',
    'schizophrenia', 'obsessive-compulsive disorder',
    'attention deficit', 'borderline personality',
    'anorexia nervosa', 'bulimia nervosa',
    'dysthymia', 'panic disorder', 'psychosis', 'dissociative disorder',
    'F32', 'F33', 'F41', 'F43', 'ICD-10', 'DSM-5', 'DSM-IV'
  ];
  const found = diagLabels.filter(l => lower.includes(l.toLowerCase()));
  if (found.length === 0) console.log('PASS: No DSM/ICD labels');
  else { console.log('FAIL:', found); allPass = false; }

  console.log('\n--- Step 2: Uses "client reports" not "client has" ---');
  if (/client has (depression|anxiety|disorder|diagnosis)/i.test(summary)) {
    console.log('FAIL: Found "client has [diagnosis]"'); allPass = false;
  } else console.log('PASS: No "client has [diagnosis]"');

  if (/client report|client describ/i.test(summary)) {
    console.log('PASS: Uses descriptive language');
  } else console.log('NOTE: Other descriptive terms used');

  console.log('\n--- Step 3: No overclaiming ---');
  const overclaim = ['suffers from', 'is diagnosed with', 'exhibits symptoms of', 'meets criteria for', 'clearly has'];
  const foundOC = overclaim.filter(p => lower.includes(p));
  if (foundOC.length === 0) console.log('PASS: No overclaiming');
  else { console.log('FAIL:', foundOC); allPass = false; }

  console.log('\n--- Step 4: Supportive tone ---');
  const good = ['supportive tool', 'session preparation', 'observed', 'discussed', 'reported'];
  const foundG = good.filter(t => lower.includes(t));
  console.log('Supportive terms:', foundG.length > 0 ? foundG.join(', ') : 'none');

  console.log('\n=== OVERALL: ' + (allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED') + ' ===');
}

main().catch(console.error);
