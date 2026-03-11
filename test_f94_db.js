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

  const loginRes = await httpReq('POST', 'http://localhost:3001/api/auth/login',
    JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' }),
    { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }
  );
  const adminToken = JSON.parse(loginRes.body).token;

  const utmRes = await httpReq('GET', 'http://localhost:3001/api/admin/stats/utm', null,
    { 'Authorization': 'Bearer ' + adminToken }
  );
  console.log('UTM Stats:', utmRes.status);
  const utmData = JSON.parse(utmRes.body);

  console.log('Sources:', JSON.stringify(utmData.sources, null, 2));
  console.log('Mediums:', JSON.stringify(utmData.mediums, null, 2));
  console.log('Campaigns:', JSON.stringify(utmData.campaigns, null, 2));

  const hasGoogle = utmData.sources && utmData.sources.some(s => s.source === 'google');
  const hasCpc = utmData.mediums && utmData.mediums.some(m => m.medium === 'cpc');
  const hasLaunch = utmData.campaigns && utmData.campaigns.some(c => c.campaign === 'launch');

  console.log('\nVerification:');
  console.log('  utm_source=google:', hasGoogle ? 'PASS' : 'FAIL');
  console.log('  utm_medium=cpc:', hasCpc ? 'PASS' : 'FAIL');
  console.log('  utm_campaign=launch:', hasLaunch ? 'PASS' : 'FAIL');
  console.log('  ALL:', hasGoogle && hasCpc && hasLaunch ? 'PASS' : 'FAIL');
}

main().catch(console.error);
