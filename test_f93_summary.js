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
  // Login as existing therapist
  let token;
  const login = await post('/api/auth/login', { email: 'therapist@test.com', password: 'Test123!' });
  if (login.status === 200) {
    token = login.body.token;
    console.log('Logged in as therapist@test.com');
  } else {
    console.log('Login failed, trying to register...');
    await post('/api/auth/register', { email: 'therapist_f93@test.com', password: 'Test123!', role: 'therapist' });
    const l2 = await post('/api/auth/login', { email: 'therapist_f93@test.com', password: 'Test123!' });
    token = l2.body.token;
    console.log('Registered and logged in as therapist_f93@test.com');
  }

  // Get clients
  const clients = await get('/api/clients', token);
  const clientList = clients.body.clients || [];
  console.log('Clients count:', clientList.length);

  // Find a session with a summary
  for (const client of clientList.slice(0, 5)) {
    const sessions = await get('/api/clients/' + client.id + '/sessions', token);
    const sessList = sessions.body.sessions || [];
    for (const sess of sessList.slice(0, 3)) {
      const detail = await get('/api/sessions/' + sess.id, token);
      const s = detail.body.session;
      if (s && s.summary) {
        console.log('\n=== SESSION #' + s.id + ' SUMMARY ===');
        console.log(s.summary);
        console.log('\n=== CHECKING FOR DIAGNOSIS LANGUAGE ===');

        // DSM/ICD labels to check for
        const diagnosisTerms = [
          'depression', 'depressive disorder', 'major depressive',
          'anxiety disorder', 'generalized anxiety disorder', 'GAD',
          'PTSD', 'post-traumatic stress disorder',
          'bipolar', 'schizophrenia', 'OCD', 'obsessive-compulsive',
          'ADHD', 'attention deficit', 'borderline personality',
          'anorexia', 'bulimia', 'eating disorder',
          'dysthymia', 'agoraphobia', 'social anxiety disorder',
          'panic disorder', 'psychosis', 'dissociative',
          'diagnosis', 'diagnosed with', 'suffers from',
          'patient has', 'client has depression', 'client has anxiety',
          'disorder', 'syndrome', 'pathology'
        ];

        const summaryLower = s.summary.toLowerCase();
        let issues = [];

        for (const term of diagnosisTerms) {
          if (summaryLower.includes(term.toLowerCase())) {
            issues.push('Found diagnosis term: "' + term + '"');
          }
        }

        // Check for overclaiming language
        const overclaimTerms = [
          'client has ', 'patient has ', 'suffers from', 'is diagnosed',
          'exhibits symptoms of', 'presents with', 'meets criteria'
        ];
        for (const term of overclaimTerms) {
          if (summaryLower.includes(term.toLowerCase())) {
            issues.push('Found overclaiming language: "' + term + '"');
          }
        }

        // Check for correct descriptive language
        const goodTerms = [
          'client report', 'client describ', 'observed', 'discussed',
          'supportive tool', 'session preparation'
        ];
        let goodFound = [];
        for (const term of goodTerms) {
          if (summaryLower.includes(term.toLowerCase())) {
            goodFound.push(term);
          }
        }

        if (issues.length === 0) {
          console.log('✅ No diagnosis language found');
        } else {
          console.log('❌ Issues found:', issues);
        }
        console.log('✅ Good descriptive terms found:', goodFound);
        return; // Found a summary, done
      }
    }
  }

  console.log('No sessions with summaries found. Creating a test session...');

  // Upload a test session to generate summary
  if (clientList.length > 0) {
    const clientId = clientList[0].id;
    // Create session via multipart upload
    const boundary = '----FormBoundary' + Date.now();
    const audioContent = Buffer.from('fake audio content for testing summary generation');
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="test_f93.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`),
      audioContent,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n${clientId}\r\n--${boundary}--\r\n`)
    ]);

    const uploadResult = await new Promise((resolve, reject) => {
      const opts = {
        hostname: 'localhost', port: 3001, path: '/api/sessions', method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
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
    console.log('Upload result:', uploadResult.status, JSON.stringify(uploadResult.body).substring(0, 200));

    if (uploadResult.body.session) {
      // Wait for async pipeline
      await new Promise(r => setTimeout(r, 3000));
      const detail = await get('/api/sessions/' + uploadResult.body.session.id, token);
      const s = detail.body.session;
      if (s && s.summary) {
        console.log('\n=== GENERATED SUMMARY ===');
        console.log(s.summary);
      } else {
        console.log('Summary not yet generated, status:', s ? s.status : 'unknown');
        // Try triggering manually
        const trigger = await post('/api/sessions/' + uploadResult.body.session.id + '/summarize', {}, token);
        console.log('Manual trigger:', trigger.status);
        await new Promise(r => setTimeout(r, 2000));
        const detail2 = await get('/api/sessions/' + uploadResult.body.session.id, token);
        if (detail2.body.session && detail2.body.session.summary) {
          console.log('\n=== GENERATED SUMMARY (after manual trigger) ===');
          console.log(detail2.body.session.summary);
        }
      }
    }
  }
}

main().catch(console.error);
