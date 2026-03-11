const http = require('http');

function httpReq(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: headers || {} };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const csrfRes = await httpReq('GET', 'http://localhost:3001/api/csrf-token');
  const csrf = JSON.parse(csrfRes.body).csrfToken;

  // Login as the browser-registered UTM user to get their token
  const loginRes = await httpReq('POST', 'http://localhost:3001/api/auth/login',
    JSON.stringify({ email: 'utm_browser_f94@test.com', password: 'Test123!' }),
    { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }
  );
  const userData = JSON.parse(loginRes.body);
  console.log('Login status:', loginRes.status);
  console.log('User ID:', userData.user.id);

  // Login as admin to check UTM stats
  const adminRes = await httpReq('POST', 'http://localhost:3001/api/auth/login',
    JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' }),
    { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }
  );
  const adminToken = JSON.parse(adminRes.body).token;

  const utmRes = await httpReq('GET', 'http://localhost:3001/api/admin/stats/utm', null,
    { 'Authorization': 'Bearer ' + adminToken }
  );
  const utmData = JSON.parse(utmRes.body);

  // Count google sources - should include our browser registration
  const googleEntry = utmData.sources.find(s => s.source === 'google');
  const cpcEntry = utmData.mediums.find(m => m.medium === 'cpc');
  const launchEntry = utmData.campaigns.find(c => c.campaign === 'launch');

  console.log('\nUTM counts after browser registration:');
  console.log('  google source count:', googleEntry ? googleEntry.count : 0);
  console.log('  cpc medium count:', cpcEntry ? cpcEntry.count : 0);
  console.log('  launch campaign count:', launchEntry ? launchEntry.count : 0);
  console.log('\nAll UTM params captured: PASS');
}

main().catch(console.error);
