const http = require('http');

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001,
      path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  let passes = 0;
  let total = 0;

  const endpoints = [
    { method: 'GET', path: '/api/clients', name: 'GET /api/clients' },
    { method: 'GET', path: '/api/clients/1', name: 'GET /api/clients/:id' },
    { method: 'GET', path: '/api/clients/1/diary', name: 'GET /api/clients/:id/diary' },
    { method: 'GET', path: '/api/clients/1/notes', name: 'GET /api/clients/:id/notes' },
    { method: 'GET', path: '/api/clients/1/timeline', name: 'GET /api/clients/:id/timeline' },
    { method: 'GET', path: '/api/auth/me', name: 'GET /api/auth/me' },
    { method: 'GET', path: '/api/sessions/1', name: 'GET /api/sessions/:id' },
    { method: 'GET', path: '/api/dashboard', name: 'GET /api/dashboard' },
    { method: 'GET', path: '/api/dashboard/notifications', name: 'GET /api/dashboard/notifications' },
    { method: 'GET', path: '/api/dashboard/analytics', name: 'GET /api/dashboard/analytics' },
    { method: 'GET', path: '/api/invite-code', name: 'GET /api/invite-code' },
    { method: 'GET', path: '/api/exercises', name: 'GET /api/exercises' },
    { method: 'GET', path: '/api/settings/profile', name: 'GET /api/settings/profile' },
    { method: 'GET', path: '/api/search/stats', name: 'GET /api/search/stats' },
    { method: 'GET', path: '/api/admin/therapists', name: 'GET /api/admin/therapists' },
  ];

  for (const ep of endpoints) {
    total++;
    const res = await req(ep.method, ep.path);
    const pass = res.status === 401;
    if (pass) passes++;
    console.log(pass ? 'PASS' : 'FAIL', '|', ep.name, '| Status:', res.status, '| Expected: 401');
  }

  // Also test with an invalid token
  total++;
  const invalidReq = await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001,
      path: '/api/clients', method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer invalid-token-xyz' }
    };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    r.end();
  });
  const invalidPass = invalidReq.status === 401;
  if (invalidPass) passes++;
  console.log(invalidPass ? 'PASS' : 'FAIL', '| GET /api/clients (invalid token) | Status:', invalidReq.status, '| Expected: 401');

  console.log('\n=== SUMMARY: ' + passes + '/' + total + ' tests passed ===');
  if (passes === total) {
    console.log('ALL AUTH PROTECTION TESTS PASS');
  } else {
    console.log('SOME TESTS FAILED');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
