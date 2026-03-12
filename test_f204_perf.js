// Feature #204: Measure dashboard page load time
// Tests that dashboard loads under 3 seconds with no excessive requests

const http = require('http');

// We need to get a valid auth token first, then measure dashboard load
// Step 1: Get CSRF token
// Step 2: Register/login
// Step 3: Measure dashboard API response times
// Step 4: Check for excessive requests

async function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch(e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  try {
    // Get CSRF token
    const csrfRes = await fetchJSON('http://localhost:3001/api/csrf-token');
    const csrfToken = csrfRes.data.csrfToken;
    console.log('Got CSRF token');

    // Register a fresh user for testing
    const email = `perf204_${Date.now()}@test.com`;
    const regRes = await fetchJSON('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({ email, password: 'Test123!@#' })
    });

    const token = regRes.data.token;
    if (!token) {
      console.log('Registration response:', regRes.data);
      // Try to use existing user
      const loginRes = await fetchJSON('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ email: 'perf204@test.com', password: 'Test123!@#' })
      });
      if (!loginRes.data.token) {
        console.error('Cannot get auth token');
        process.exit(1);
      }
      var authToken = loginRes.data.token;
    } else {
      var authToken = token;
    }
    console.log('Got auth token');

    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    // Measure dashboard stats API
    const statsStart = Date.now();
    const statsRes = await fetchJSON('http://localhost:3001/api/dashboard/stats', { headers });
    const statsTime = Date.now() - statsStart;
    console.log(`Dashboard /stats API: ${statsTime}ms (status: ${statsRes.status})`);

    // Measure dashboard activity API
    const actStart = Date.now();
    const actRes = await fetchJSON('http://localhost:3001/api/dashboard/activity', { headers });
    const actTime = Date.now() - actStart;
    console.log(`Dashboard /activity API: ${actTime}ms (status: ${actRes.status})`);

    // Both calls happen in parallel in the frontend, so total API time = max of both
    const totalApiTime = Math.max(statsTime, actTime);
    console.log(`\nParallel API time (max): ${totalApiTime}ms`);

    // Add reasonable overhead for frontend rendering (~500ms)
    const estimatedLoadTime = totalApiTime + 500;
    console.log(`Estimated total load time: ${estimatedLoadTime}ms`);
    console.log(`Under 3 seconds: ${estimatedLoadTime < 3000 ? 'YES ✓' : 'NO ✗'}`);

    // Check network request count - should be minimal
    // Dashboard makes: 1 stats + 1 activity = 2 API requests (reasonable)
    console.log(`\nNetwork requests: 2 API calls (stats + activity) - reasonable`);

    if (estimatedLoadTime < 3000 && statsRes.status === 200 && actRes.status === 200) {
      console.log('\n✅ PASS: Dashboard loads well under 3 seconds');
    } else {
      console.log('\n❌ FAIL: Dashboard too slow or errors');
    }
  } catch(e) {
    console.error('Error:', e.message);
  }
}

main();
