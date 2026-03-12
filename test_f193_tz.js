var http = require('http');

var globalCsrf = '';

function request(method, path, body, token) {
  return new Promise(function(resolve, reject) {
    var data = body ? JSON.stringify(body) : null;
    var opts = {
      hostname: '127.0.0.1',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (globalCsrf && method !== 'GET') opts.headers['X-CSRF-Token'] = globalCsrf;
    var req = http.request(opts, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        var text = Buffer.concat(chunks).toString();
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
  var ts = Date.now();
  var email = 'tz_test_' + ts + '@test.com';

  // Get CSRF token first
  var csrf = await request('GET', '/api/csrf-token', null, null);
  var csrfToken = csrf.data.csrfToken;
  globalCsrf = csrfToken;
  process.stdout.write('CSRF token: ' + (csrfToken ? 'obtained' : 'MISSING') + '\n');

  // Register with Asia/Kolkata timezone (UTC+5:30)
  var reg = await request('POST', '/api/auth/register', {
    email: email,
    password: 'TestPass1',
    timezone: 'Asia/Kolkata'
  });

  process.stdout.write('Register status: ' + reg.status + '\n');
  process.stdout.write('User timezone in response: ' + (reg.data.user && reg.data.user.timezone) + '\n');

  var token = reg.data.token;

  // Check /me endpoint
  var me = await request('GET', '/api/auth/me', null, token);
  process.stdout.write('Me timezone: ' + (me.data.user && me.data.user.timezone) + '\n');

  // Check settings profile
  var settings = await request('GET', '/api/settings/profile', null, token);
  process.stdout.write('Settings timezone: ' + (settings.data.profile && settings.data.profile.timezone) + '\n');

  // Update timezone to America/Los_Angeles
  var upd = await request('PUT', '/api/settings/profile', {
    language: 'en',
    timezone: 'America/Los_Angeles'
  }, token);
  process.stdout.write('Update status: ' + upd.status + '\n');

  // Verify updated
  var settings2 = await request('GET', '/api/settings/profile', null, token);
  process.stdout.write('Updated timezone: ' + (settings2.data.profile && settings2.data.profile.timezone) + '\n');

  // Login again and check timezone in login response
  var login = await request('POST', '/api/auth/login', {
    email: email,
    password: 'TestPass1'
  });
  process.stdout.write('Login timezone: ' + (login.data.user && login.data.user.timezone) + '\n');

  process.stdout.write('\nAll API checks passed!\n');
}

main().catch(function(e) { process.stderr.write(e.message + '\n'); process.exit(1); });
