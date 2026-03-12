// Create a diary entry for browser deletion test
const http = require('http');
const BASE = 'http://localhost:3001';

function request(method, path, body, token, extraHeaders) {
  return new Promise(function(resolve, reject) {
    var url = new URL(path, BASE);
    var options = {
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: method, headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;
    if (extraHeaders) Object.keys(extraHeaders).forEach(function(k) { options.headers[k] = extraHeaders[k]; });
    var req = http.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  var botHeaders = { 'X-Bot-API-Key': 'dev-bot-api-key' };

  // Login as the test user
  var csrfRes = await request('GET', '/api/csrf-token');
  var loginRes = await request('POST', '/api/auth/login', {
    email: 'f198_test_1773322933358@test.com',
    password: 'StrongPwd1'
  }, null, { 'X-CSRF-Token': csrfRes.body.csrfToken });
  var token = loginRes.body.token;

  // Create diary entry for deletion test
  await request('POST', '/api/bot/diary', {
    telegram_id: 'f198_client_1773322933358',
    content: 'BROWSER_DELETE_TEST_198'
  }, null, botHeaders);

  // Get the entry ID
  var diaryRes = await request('GET', '/api/clients/701/diary', null, token);
  var entries = diaryRes.body.entries || [];
  console.log('Diary entries:', entries.length);
  if (entries.length > 0) {
    console.log('Entry ID:', entries[0].id);
    console.log('Content:', entries[0].content);
  }
}

main().catch(function(e) { console.error(e); process.exit(1); });
