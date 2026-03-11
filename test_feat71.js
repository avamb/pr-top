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

  // Login as superadmin
  const loginRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }
  }, JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' }));
  const token = JSON.parse(loginRes.body).token;
  console.log('Admin login:', token ? 'success' : 'failed');

  // Test subscription stats endpoint
  const subRes = await httpReq({
    hostname: 'localhost', port: 3001, path: '/api/admin/stats/subscriptions', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\nSubscription stats status:', subRes.status);
  const subData = JSON.parse(subRes.body);
  console.log('Plan distribution:', JSON.stringify(subData.plan_distribution, null, 2));
  console.log('Totals:', JSON.stringify(subData.totals));
  console.log('Revenue:', JSON.stringify(subData.revenue));
  console.log('Recent payments count:', subData.recent_payments?.length ?? 0);
  console.log('Trials expiring soon:', subData.trials_expiring_soon);

  // Verify required fields exist
  const checks = [
    ['plan_distribution', !!subData.plan_distribution],
    ['revenue metrics', !!subData.revenue],
    ['totals', !!subData.totals],
    ['success_rate', subData.revenue?.success_rate !== undefined],
    ['mrr_formatted', !!subData.revenue?.mrr_formatted],
    ['total_revenue_formatted', !!subData.revenue?.total_revenue_formatted],
    ['failed_payments', subData.revenue?.failed_payments !== undefined],
    ['recent_payments array', Array.isArray(subData.recent_payments)]
  ];

  let allPassed = true;
  for (const [name, pass] of checks) {
    console.log(`  ${pass ? '✅' : '❌'} ${name}`);
    if (!pass) allPassed = false;
  }

  console.log(allPassed ? '\n=== ALL API CHECKS PASSED ===' : '\n=== SOME CHECKS FAILED ===');
}

main().catch(e => console.error('Error:', e));
