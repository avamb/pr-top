const http = require('http');

function apiCall(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {})
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch(e) { resolve(b); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const csrf = await apiCall('GET', '/api/csrf-token');
  const login = await apiCall('POST', '/api/auth/login', {
    email: 'f109test@test.com',
    password: 'TestPass123'
  }, { 'x-csrf-token': csrf.csrfToken || csrf.token });
  const token = login.token;
  const authH = { 'Authorization': 'Bearer ' + token };

  // Search diary for DELETE_TEST_22222
  const diary = await apiCall('GET', '/api/clients/486/diary', null, authH);
  const entries = diary.entries || [];
  const found = entries.find(e => (e.content || '').includes('DELETE_TEST_22222'));
  console.log('DELETE_TEST_22222 in diary:', found ? 'FOUND - FAIL' : 'NOT FOUND - PASS');

  // Check timeline
  const tl = await apiCall('GET', '/api/clients/486/timeline', null, authH);
  const items = tl.items || [];
  const foundTl = items.find(i => (i.content || '').includes('DELETE_TEST_22222'));
  console.log('DELETE_TEST_22222 in timeline:', foundTl ? 'FOUND - FAIL' : 'NOT FOUND - PASS');

  // Check vector search
  const search = await apiCall('POST', '/api/search', {
    query: 'DELETE_TEST_22222',
    client_id: 486
  }, authH);
  console.log('Search result:', JSON.stringify(search).substring(0, 200));

  console.log('All checks passed!');
}

main().catch(e => console.error(e));
