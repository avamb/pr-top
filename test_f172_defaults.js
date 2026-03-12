const http = require('http');

const BACKEND = 'http://localhost:3001';

let csrfToken = null;
let cookies = '';

async function getCsrf() {
  const res = await request('GET', '/api/csrf-token');
  csrfToken = res.data.csrfToken;
  return csrfToken;
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BACKEND);
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    if (cookies) headers['Cookie'] = cookies;

    const req = http.request(url, { method, headers }, (res) => {
      // Capture set-cookie headers
      const setCookies = res.headers['set-cookie'];
      if (setCookies) {
        cookies = setCookies.map(c => c.split(';')[0]).join('; ');
      }
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }); }
        catch(e) { resolve({ status: res.statusCode, data: text }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  await getCsrf();
  const ts = Date.now();
  const email = `test_f172_${ts}@example.com`;

  // Test 1: Register with language and timezone
  const reg = await request('POST', '/api/auth/register', {
    email,
    password: 'TestPass123',
    role: 'therapist',
    language: 'ru',
    timezone: 'Europe/Moscow'
  });

  if (reg.status !== 201) {
    process.stdout.write('FAIL: Registration failed: ' + JSON.stringify(reg.data) + '\n');
    process.exit(1);
  }
  process.stdout.write('PASS: Registration succeeded\n');

  const token = reg.data.token;

  // Test 2: Check profile has the saved language/timezone
  const profile = await request('GET', '/api/settings/profile', null, token);
  if (profile.status !== 200) {
    process.stdout.write('FAIL: Could not fetch profile: ' + profile.status + '\n');
    process.exit(1);
  }

  const p = profile.data.profile;
  process.stdout.write('Profile language: ' + p.language + '\n');
  process.stdout.write('Profile timezone: ' + p.timezone + '\n');

  if (p.language === 'ru') {
    process.stdout.write('PASS: Language saved correctly (ru)\n');
  } else {
    process.stdout.write('FAIL: Expected language ru, got ' + p.language + '\n');
  }

  if (p.timezone === 'Europe/Moscow') {
    process.stdout.write('PASS: Timezone saved correctly (Europe/Moscow)\n');
  } else {
    process.stdout.write('FAIL: Expected timezone Europe/Moscow, got ' + p.timezone + '\n');
  }

  // Test 3: Register without language/timezone - should use defaults
  const email2 = `test_f172_def_${ts}@example.com`;
  const reg2 = await request('POST', '/api/auth/register', {
    email: email2,
    password: 'TestPass123',
    role: 'therapist'
  });

  if (reg2.status !== 201) {
    process.stdout.write('FAIL: Default registration failed\n');
    process.exit(1);
  }

  const token2 = reg2.data.token;
  const profile2 = await request('GET', '/api/settings/profile', null, token2);
  const p2 = profile2.data.profile;

  process.stdout.write('Default language: ' + p2.language + '\n');
  process.stdout.write('Default timezone: ' + p2.timezone + '\n');

  if (p2.language === 'en') {
    process.stdout.write('PASS: Default language is en\n');
  } else {
    process.stdout.write('FAIL: Expected default language en, got ' + p2.language + '\n');
  }

  if (p2.timezone === 'UTC') {
    process.stdout.write('PASS: Default timezone is UTC\n');
  } else {
    process.stdout.write('FAIL: Expected default timezone UTC, got ' + p2.timezone + '\n');
  }

  process.stdout.write('\nAll tests completed!\n');
}

main().catch(e => { process.stdout.write('ERROR: ' + e.message + '\n'); process.exit(1); });
