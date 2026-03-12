const http = require('http');

const TS = Date.now();
let csrfToken = '';
let cookies = '';

const makeReq = (method, path, body) => new Promise((resolve, reject) => {
  const opts = {
    hostname: 'localhost', port: 3001,
    path, method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (csrfToken) opts.headers['X-CSRF-Token'] = csrfToken;
  if (cookies) opts.headers['Cookie'] = cookies;
  const r = http.request(opts, res => {
    let d = '';
    const sc = res.headers['set-cookie'];
    if (sc) {
      const parts = sc.map(c => c.split(';')[0]);
      cookies = parts.join('; ');
    }
    res.on('data', c => d += c);
    res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d || '{}') }));
  });
  r.on('error', reject);
  if (body) r.write(JSON.stringify(body));
  r.end();
});

async function run() {
  const csrf = await makeReq('GET', '/api/csrf-token');
  csrfToken = csrf.body.csrfToken;

  const r1 = await makeReq('POST', '/api/auth/register', {
    email: 'invalid_' + TS, password: 'Test1234!'
  });
  process.stdout.write('Invalid email: ' + r1.status + ' ' + (r1.body.error || r1.body.message) + '\n');

  const r2 = await makeReq('POST', '/api/auth/register', {
    email: 'valid_' + TS + '@test.com', password: 'Test1234!'
  });
  process.stdout.write('Valid email: ' + r2.status + ' ' + (r2.body.error || r2.body.message) + '\n');

  process.stdout.write('\nBackend validates: ' + (r1.status === 400 ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('Valid still works: ' + (r2.status === 201 ? 'PASS' : 'FAIL') + '\n');
}

run().catch(e => process.stderr.write(e.toString() + '\n'));
