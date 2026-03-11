const http = require('http');

function request(method, path, token, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        if (v !== undefined && v !== null) headers[k] = v;
      }
    }
    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request({ hostname: 'localhost', port: 3001, path, method, headers }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', e => { console.log('Connection error:', e.message); reject(e); });
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Check health first
  const health = await request('GET', '/api/health');
  console.log('Health:', health.status, health.body?.status);

  const csrfRes = await request('GET', '/api/csrf-token');
  console.log('CSRF:', csrfRes.status, csrfRes.body?.csrfToken ? 'got token' : 'no token');

  const login = await request('POST', '/api/auth/login', null,
    { email: 'admin@psylink.app', password: 'Admin123!' },
    { 'X-CSRF-Token': csrfRes.body?.csrfToken || 'dummy' }
  );
  console.log('Login:', login.status);
  const token = login.body?.token;
  if (!token) { console.log('Login failed:', JSON.stringify(login.body)); return; }

  const getRes = await request('GET', '/api/admin/settings', token);
  console.log('After restart, trial_duration_days:', getRes.body.settings?.trial_duration_days?.value);
  console.log('PERSIST TEST:', getRes.body.settings?.trial_duration_days?.value === '21' ? 'PASS' : 'FAIL (expected 21)');

  // Restore to 14
  await request('PUT', '/api/admin/settings', token, { settings: { trial_duration_days: '14' } });
  console.log('Restored to 14');
}

main().catch(e => console.error('Main error:', e.message));
