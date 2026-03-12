const http = require('http');

const TS = Date.now();

const makeReq = (method, path, body, headers) => new Promise((resolve, reject) => {
  const opts = {
    hostname: 'localhost', port: 3001,
    path, method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {})
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

async function run() {
  // Step 1: Get CSRF token
  const csrfRes = await makeReq('GET', '/api/csrf-token');
  const csrfToken = csrfRes.body.csrfToken;
  process.stdout.write('CSRF: ' + csrfToken + '\n');

  // Step 2: Register with invalid email using CSRF token
  const r1 = await makeReq('POST', '/api/auth/register',
    { email: 'noemail_' + TS, password: 'Test1234!' },
    { 'X-CSRF-Token': csrfToken }
  );
  process.stdout.write('Result: status=' + r1.status + ' body=' + JSON.stringify(r1.body) + '\n');

  // Test: does the regex even work?
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  process.stdout.write('Regex test "noemail": ' + regex.test('noemail_' + TS) + '\n');
  process.stdout.write('Regex test "a@b.c": ' + regex.test('a@b.c') + '\n');
}

run().catch(e => process.stderr.write(e.toString() + '\n'));
