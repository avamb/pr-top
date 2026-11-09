'use strict';
// Helper: register a therapist and get their credentials for browser testing
const http = require('http');

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: { 'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0, ...headers }
    };
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  const ts = Date.now();
  const email = `t393_browser_${ts}@test.com`;
  const pass = 'Test12345!';
  const csrf = (await req('GET', '/api/csrf-token')).body.csrfToken;
  const r = await req('POST', '/api/auth/register',
    { email, password: pass, role: 'therapist' }, { 'X-CSRF-Token': csrf });
  if (r.status !== 201) { console.error('Register failed:', r.body); process.exit(1); }
  const userId = r.body.user?.id;
  // Upgrade to pro so search routes are accessible
  await req('POST', '/api/dev/set-subscription', { therapist_id: userId, plan: 'pro', status: 'active' });
  console.log(`email=${email}`);
  console.log(`password=${pass}`);
  console.log(`userId=${userId}`);
}

main().catch(e => { console.error(e); process.exit(1); });
