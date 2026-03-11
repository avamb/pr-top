// Test script for subscription downgrade feature #171
const http = require('http');

const API = 'http://localhost:3001';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
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
  console.log('=== Test: Subscription Downgrade Effects ===\n');

  // Step 1: Register therapist
  const reg = await request('POST', '/api/auth/register', {
    email: 'downgrade_flow@test.com', password: 'TestPass123'
  });
  const therapistToken = reg.body.token;
  const therapistId = reg.body.user.id;
  console.log(`1. Registered therapist id=${therapistId}`);

  // Step 2: Upgrade to Pro
  const upgrade = await request('POST', '/api/subscription/change-plan',
    { plan: 'pro' }, therapistToken);
  console.log(`2. Upgraded to Pro: ${upgrade.body.message}`);

  // Step 3: Create 15 clients and link them
  const clientIds = [];
  for (let i = 1; i <= 15; i++) {
    const clientReg = await request('POST', '/api/auth/register', {
      email: `dgclient${i}_${Date.now()}@test.com`, password: 'TestPass123', role: 'client'
    });
    clientIds.push(clientReg.body.user.id);
    const link = await request('POST', '/api/clients/link',
      { client_id: clientReg.body.user.id }, therapistToken);
    if (i % 5 === 0) console.log(`3. Linked ${i}/15 clients...`);
  }
  console.log(`3. All 15 clients linked`);

  // Step 4: Verify client list shows 15
  const clientList = await request('GET', '/api/clients', null, therapistToken);
  console.log(`4. Client list: ${clientList.body.total} clients, limit=${clientList.body.limit}, can_add=${clientList.body.can_add}`);

  // Step 5: Downgrade to Basic (10 limit)
  const downgrade = await request('POST', '/api/subscription/change-plan',
    { plan: 'basic' }, therapistToken);
  console.log(`5. Downgraded to Basic: ${downgrade.body.message}`);
  if (downgrade.body.downgrade_warning) {
    console.log(`   WARNING: ${downgrade.body.downgrade_warning.message}`);
    console.log(`   Excess clients: ${downgrade.body.downgrade_warning.excess}`);
  }

  // Step 6: Verify existing 15 clients still linked
  const clientListAfter = await request('GET', '/api/clients', null, therapistToken);
  console.log(`6. After downgrade: ${clientListAfter.body.total} clients still linked (preserved!)`);
  console.log(`   Plan: ${clientListAfter.body.plan}, limit: ${clientListAfter.body.limit}, can_add: ${clientListAfter.body.can_add}`);

  // Step 7: Try to add a 16th client (should be blocked)
  const newClient = await request('POST', '/api/auth/register', {
    email: `dgclient_extra_${Date.now()}@test.com`, password: 'TestPass123', role: 'client'
  });
  const linkAttempt = await request('POST', '/api/clients/link',
    { client_id: newClient.body.user.id }, therapistToken);
  console.log(`7. Attempt to add 16th client: status=${linkAttempt.status}`);
  console.log(`   Response: ${linkAttempt.body.error || linkAttempt.body.message}`);

  // Step 8: Check limits endpoint
  const limits = await request('GET', '/api/subscription/limits', null, therapistToken);
  console.log(`8. Limits check: ${JSON.stringify(limits.body)}`);

  // Summary
  console.log('\n=== RESULTS ===');
  console.log(`Clients preserved after downgrade: ${clientListAfter.body.total === 15 ? 'PASS' : 'FAIL'}`);
  console.log(`Cannot add new clients over limit: ${linkAttempt.status === 403 ? 'PASS' : 'FAIL'}`);
  console.log(`Appropriate limit message: ${linkAttempt.body.message ? 'PASS' : 'FAIL'}`);
  console.log(`Downgrade warning provided: ${downgrade.body.downgrade_warning ? 'PASS' : 'FAIL'}`);
}

main().catch(console.error);
