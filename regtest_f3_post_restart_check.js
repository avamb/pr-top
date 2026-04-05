// Feature 3 regression test: verify data persists after restart
var http = require('http');

function request(method, path, body, cookies) {
  return new Promise(function(resolve, reject) {
    var options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (cookies) options.headers['Cookie'] = cookies;
    if (body && body.csrfToken) options.headers['x-csrf-token'] = body.csrfToken;

    var req = http.request(options, function(res) {
      var data = '';
      var setCookies = res.headers['set-cookie'] || [];
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        resolve({ status: res.statusCode, body: data, cookies: setCookies });
      });
    });
    req.on('error', reject);
    if (body && body.payload) req.write(JSON.stringify(body.payload));
    req.end();
  });
}

async function main() {
  try {
    // Step 1: Health check
    console.log('Step 1: Health check...');
    var health = await request('GET', '/api/health');
    console.log('Health status:', health.status, health.body.substring(0, 100));

    // Step 2: Get CSRF token
    console.log('\nStep 2: Getting CSRF token...');
    var csrfResp = await request('GET', '/api/csrf-token');
    var csrfData = JSON.parse(csrfResp.body);
    var csrfToken = csrfData.csrfToken;
    var sessionCookie = csrfResp.cookies.map(function(c) { return c.split(';')[0]; }).join('; ');
    console.log('CSRF token obtained:', csrfToken.substring(0, 16) + '...');
    console.log('Session cookie:', sessionCookie.substring(0, 40) + '...');

    // Step 3: Login with pre-restart user
    console.log('\nStep 3: Login with pre-restart user (regtest_f345_1775380007@test.com)...');
    var loginResp = await request('POST', '/api/auth/login', {
      csrfToken: csrfToken,
      payload: { email: 'regtest_f345_1775380007@test.com', password: 'TestPass123!' }
    }, sessionCookie);
    console.log('Login status:', loginResp.status);
    console.log('Login response:', loginResp.body.substring(0, 200));

    if (loginResp.status === 200) {
      var loginData = JSON.parse(loginResp.body);
      var authCookies = loginResp.cookies.map(function(c) { return c.split(';')[0]; }).join('; ');
      var allCookies = sessionCookie + '; ' + authCookies;

      // Step 4: Get user profile
      console.log('\nStep 4: Verify user profile via /api/auth/me...');
      var meResp = await request('GET', '/api/auth/me', null, allCookies);
      console.log('Profile status:', meResp.status);
      console.log('Profile response:', meResp.body.substring(0, 200));

      if (meResp.status === 200) {
        var profile = JSON.parse(meResp.body);
        if (profile.user && profile.user.email === 'regtest_f345_1775380007@test.com') {
          console.log('\n=== FEATURE 3 PASSES: Data persisted across server restart ===');
          process.exit(0);
        } else {
          console.log('\n=== FEATURE 3 FAILS: User profile does not match ===');
          process.exit(1);
        }
      } else {
        console.log('\n=== FEATURE 3 FAILS: Could not get user profile after restart ===');
        process.exit(1);
      }
    } else {
      console.log('\n=== FEATURE 3 FAILS: Login failed after restart - data not persisted ===');
      process.exit(1);
    }
  } catch (err) {
    console.log('ERROR:', err.message);
    process.exit(1);
  }
}

main();
