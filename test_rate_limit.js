const http = require('http');
const { execSync, spawn } = require('child_process');

function killBackend() {
  var result;
  try { result = execSync('netstat -ano | findstr :3001 | findstr LISTENING').toString().trim(); } catch(e) { console.log('No backend running'); return; }
  var pid = result.split(/\s+/).pop();
  try { execSync('taskkill /F /PID ' + pid); console.log('Killed PID', pid); } catch(e) {}
}

function startBackend(envOverrides) {
  return new Promise(function(resolve) {
    var env = Object.assign({}, process.env, envOverrides || {});
    var child = spawn('node', ['src/backend/src/index.js'], {
      env: env,
      stdio: 'ignore',
      detached: true
    });
    child.unref();
    console.log('Started backend with env:', JSON.stringify(envOverrides || {}));
    setTimeout(resolve, 4000);
  });
}

function sendRequest(path) {
  return new Promise(function(resolve) {
    var req = http.get('http://localhost:3001' + path, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', function(e) { resolve({ status: 0, error: e.message }); });
  });
}

async function runTest() {
  console.log('=== Rate Limiting Test ===\n');

  killBackend();
  await startBackend({ RATE_LIMIT_MAX: '15' });

  var health = await sendRequest('/api/health');
  if (health.status !== 200) {
    console.log('ERROR: Backend not ready, status:', health.status, health.error);
    return;
  }
  console.log('Backend is ready\n');

  console.log('Step 1: Send 20 rapid requests to /api/health...');
  var results = [];
  for (var i = 0; i < 20; i++) {
    var r = await sendRequest('/api/health');
    results.push(r);
    if (i < 3 || i >= 14) {
      console.log('  Request ' + (i + 1) + ': status=' + r.status);
    } else if (i === 3) {
      console.log('  ...');
    }
  }

  var okCount = results.filter(function(r) { return r.status === 200; }).length;
  var rateLimited = results.filter(function(r) { return r.status === 429; });
  console.log('\nResults: ' + okCount + ' OK, ' + rateLimited.length + ' rate-limited (429)');

  if (rateLimited.length > 0) {
    var body = JSON.parse(rateLimited[0].body);
    console.log('\nStep 2: Verify 429 response content');
    console.log('  Response body:', JSON.stringify(body));
    console.log('  Has retryAfter:', 'retryAfter' in body);
    console.log('  Has error message:', 'error' in body);

    var headers = rateLimited[0].headers;
    console.log('\n  Rate limit headers:');
    console.log('    ratelimit-limit:', headers['ratelimit-limit'] || 'not set');
    console.log('    ratelimit-remaining:', headers['ratelimit-remaining'] || 'not set');
    console.log('    ratelimit-reset:', headers['ratelimit-reset'] || 'not set');
    console.log('    retry-after:', headers['retry-after'] || 'not set');
  }

  var testPassed = rateLimited.length > 0
    && rateLimited[0].status === 429
    && JSON.parse(rateLimited[0].body).retryAfter;

  console.log('\n=== TEST ' + (testPassed ? 'PASSED' : 'FAILED') + ' ===');

  // Restart with normal limit
  console.log('\nRestarting backend with default rate limit...');
  killBackend();
  await startBackend({});
  var h2 = await sendRequest('/api/health');
  console.log('Backend restored, health:', h2.status);
}

runTest();
