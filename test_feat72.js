const http = require('http');

function httpReq(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
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
  // Get CSRF token
  const csrfRes = await httpReq({ hostname: 'localhost', port: 3001, path: '/api/csrf-token', method: 'GET' });
  const csrfToken = JSON.parse(csrfRes.body).csrfToken;

  // Register therapists with different UTM params
  const utmUsers = [
    { email: 'utm_google1@test.com', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'spring_launch' },
    { email: 'utm_google2@test.com', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'spring_launch' },
    { email: 'utm_google3@test.com', utm_source: 'google', utm_medium: 'organic', utm_campaign: 'seo' },
    { email: 'utm_facebook1@test.com', utm_source: 'facebook', utm_medium: 'social', utm_campaign: 'awareness' },
    { email: 'utm_facebook2@test.com', utm_source: 'facebook', utm_medium: 'social', utm_campaign: 'awareness' },
    { email: 'utm_twitter1@test.com', utm_source: 'twitter', utm_medium: 'social', utm_campaign: 'beta_invite' },
    { email: 'utm_newsletter1@test.com', utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'weekly_digest' },
    { email: 'utm_newsletter2@test.com', utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'weekly_digest' },
    { email: 'utm_newsletter3@test.com', utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'promo_march' },
  ];

  for (const u of utmUsers) {
    const res = await httpReq({
      hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
    }, JSON.stringify({ email: u.email, password: 'Test123!', role: 'therapist', ...u }));
    console.log(`Register ${u.email}: ${res.status}`);
  }

  // Now test the UTM stats endpoint
  const loginRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
  }, JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' }));
  const token = JSON.parse(loginRes.body).token;

  const utmRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/admin/stats/utm', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\nUTM stats status:', utmRes.status);
  const utmData = JSON.parse(utmRes.body);
  console.log('Total therapists:', utmData.total_therapists);
  console.log('With UTM:', utmData.with_utm_tracking);
  console.log('Without UTM:', utmData.without_utm_tracking);
  console.log('Sources:', JSON.stringify(utmData.sources, null, 2));
  console.log('Campaigns:', JSON.stringify(utmData.campaigns, null, 2));
  console.log('Daily trends (last 3):', JSON.stringify(utmData.daily_trends?.slice(-3)));

  // Verify checks
  const checks = [
    ['sources present', utmData.sources && utmData.sources.length > 0],
    ['campaigns present', utmData.campaigns && utmData.campaigns.length > 0],
    ['daily_trends present', utmData.daily_trends && utmData.daily_trends.length > 0],
    ['google source found', utmData.sources?.some(s => s.source === 'google')],
    ['newsletter source found', utmData.sources?.some(s => s.source === 'newsletter')],
    ['spring_launch campaign', utmData.campaigns?.some(c => c.campaign === 'spring_launch')],
    ['with_utm > 0', utmData.with_utm_tracking > 0]
  ];

  let allPassed = true;
  for (const [name, pass] of checks) {
    console.log(`  ${pass ? '✅' : '❌'} ${name}`);
    if (!pass) allPassed = false;
  }

  console.log(allPassed ? '\n=== ALL UTM CHECKS PASSED ===' : '\n=== SOME CHECKS FAILED ===');
}

main().catch(e => console.error('Error:', e));
