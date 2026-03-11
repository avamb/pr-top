const http = require('http');

let csrfToken = null;
let allCookies = {};

function fetch(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001,
      path, method,
      headers: { 'Content-Type': 'application/json', 'Connection': 'close' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (csrfToken) opts.headers['x-csrf-token'] = csrfToken;
    // Send cookies
    const cookieStr = Object.entries(allCookies).map(([k,v]) => k + '=' + v).join('; ');
    if (cookieStr) opts.headers['Cookie'] = cookieStr;

    const req = http.request(opts, res => {
      let data = '';
      // Parse set-cookie headers
      const setCookies = res.headers['set-cookie'] || [];
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data || '{}'), headers: res.headers, setCookies }); }
        catch(e) { resolve({ status: res.statusCode, body: { raw: data }, headers: res.headers, setCookies }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function parseCookie(setCookieHeader) {
  const result = {};
  const parts = setCookieHeader.split(';').map(p => p.trim());
  // First part is name=value
  const [nameVal, ...attrs] = parts;
  const eqIdx = nameVal.indexOf('=');
  result.name = nameVal.substring(0, eqIdx);
  result.value = nameVal.substring(eqIdx + 1);

  for (const attr of attrs) {
    const lower = attr.toLowerCase();
    if (lower === 'httponly') result.httpOnly = true;
    else if (lower.startsWith('samesite=')) result.sameSite = attr.split('=')[1];
    else if (lower === 'secure') result.secure = true;
    else if (lower.startsWith('max-age=')) result.maxAge = parseInt(attr.split('=')[1]);
    else if (lower.startsWith('path=')) result.path = attr.split('=')[1];
    else if (lower.startsWith('expires=')) result.expires = attr.split('=')[1];
  }
  return result;
}

async function run() {
  const checks = [];

  // Get CSRF token
  let r = await fetch('GET', '/api/csrf-token');
  csrfToken = r.body.csrfToken || r.body.token;
  // Parse CSRF cookie
  if (r.setCookies) {
    for (const sc of r.setCookies) {
      const parsed = parseCookie(sc);
      allCookies[parsed.name] = parsed.value;
    }
  }
  console.log('CSRF token obtained');

  // Step 1: Login and inspect session cookie
  r = await fetch('POST', '/api/auth/login', { email: 'admin@psylink.app', password: 'Admin123!' });
  console.log('Login status:', r.status);
  const jwtToken = r.body.token;

  // Parse all set-cookie headers from login response
  let sessionCookie = null;
  for (const sc of r.setCookies) {
    const parsed = parseCookie(sc);
    allCookies[parsed.name] = parsed.value;
    if (parsed.name === 'session_token') {
      sessionCookie = parsed;
    }
  }

  console.log('\n=== SESSION COOKIE INSPECTION ===');
  if (sessionCookie) {
    console.log('Cookie name:', sessionCookie.name);
    console.log('HttpOnly:', sessionCookie.httpOnly ? 'YES' : 'NO');
    console.log('SameSite:', sessionCookie.sameSite || 'NOT SET');
    console.log('Secure:', sessionCookie.secure ? 'YES' : 'NO (expected in dev mode)');
    console.log('MaxAge:', sessionCookie.maxAge);
    console.log('Path:', sessionCookie.path);
    console.log('Has value:', !!sessionCookie.value);
  } else {
    console.log('NO session_token cookie found!');
    console.log('Set-Cookie headers:', r.setCookies);
  }

  // CHECK 1: Session cookie exists
  const c1 = !!sessionCookie;
  checks.push(c1);
  console.log('\nCHECK 1 - Session cookie set on login:', c1 ? 'PASS' : 'FAIL');

  // CHECK 2: HttpOnly flag set
  const c2 = sessionCookie && sessionCookie.httpOnly === true;
  checks.push(c2);
  console.log('CHECK 2 - HttpOnly flag set:', c2 ? 'PASS' : 'FAIL');

  // CHECK 3: SameSite attribute set
  const c3 = sessionCookie && sessionCookie.sameSite && sessionCookie.sameSite.toLowerCase() === 'strict';
  checks.push(c3);
  console.log('CHECK 3 - SameSite=Strict set:', c3 ? 'PASS' : 'FAIL');

  // CHECK 4: Token has expiry (maxAge or expires)
  const c4 = sessionCookie && (sessionCookie.maxAge > 0 || sessionCookie.expires);
  checks.push(c4);
  console.log('CHECK 4 - Token expires after timeout:', c4 ? 'PASS' : 'FAIL', sessionCookie ? ('maxAge=' + sessionCookie.maxAge) : '');

  // CHECK 5: MaxAge matches 24 hours (86400000 ms or 86400 s)
  const expectedMaxAge = 24 * 60 * 60; // 86400 seconds (Express sends in seconds)
  const c5 = sessionCookie && (sessionCookie.maxAge === expectedMaxAge || sessionCookie.maxAge === expectedMaxAge * 1000);
  checks.push(c5);
  console.log('CHECK 5 - MaxAge is 24 hours:', c5 ? 'PASS' : 'FAIL', '(got:', sessionCookie && sessionCookie.maxAge, ')');

  // CHECK 6: JWT token is valid and has expiry
  // Decode JWT manually (base64 decode the payload)
  function decodeJwt(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  }
  const decoded = decodeJwt(jwtToken);
  const c6 = decoded && decoded.exp && decoded.exp > Date.now() / 1000;
  checks.push(c6);
  console.log('CHECK 6 - JWT has valid expiry:', c6 ? 'PASS' : 'FAIL', decoded ? ('exp=' + new Date(decoded.exp * 1000).toISOString()) : '');

  // CHECK 7: JWT expires in ~24 hours
  const expiresIn = decoded ? (decoded.exp - decoded.iat) : 0;
  const c7 = expiresIn === 86400;
  checks.push(c7);
  console.log('CHECK 7 - JWT expires in 24h:', c7 ? 'PASS' : 'FAIL', '(expiresIn=' + expiresIn + 's)');

  // Step 5: Verify /api/auth/me works with token
  r = await fetch('GET', '/api/auth/me', null, jwtToken);
  const c8 = r.status === 200 && r.body.user && r.body.user.role === 'superadmin';
  checks.push(c8);
  console.log('CHECK 8 - Auth/me works with token:', c8 ? 'PASS' : 'FAIL');

  // Step 6: Logout and verify token/cookie cleared
  r = await fetch('POST', '/api/auth/logout', null, jwtToken);
  console.log('\nLogout status:', r.status);

  // Check if session_token cookie was cleared
  let logoutCookie = null;
  for (const sc of r.setCookies) {
    const parsed = parseCookie(sc);
    if (parsed.name === 'session_token') {
      logoutCookie = parsed;
    }
  }

  // Cookie should be cleared (empty value or maxAge=0 or expires in past)
  const cookieCleared = logoutCookie && (
    logoutCookie.value === '' ||
    logoutCookie.maxAge === 0 ||
    (logoutCookie.expires && new Date(logoutCookie.expires) < new Date())
  );
  const c9 = !!cookieCleared;
  checks.push(c9);
  console.log('CHECK 9 - Logout clears session cookie:', c9 ? 'PASS' : 'FAIL');
  if (logoutCookie) {
    console.log('  Logout cookie value:', logoutCookie.value ? '(has value)' : '(empty)');
    console.log('  Logout cookie expires:', logoutCookie.expires || 'not set');
    console.log('  Logout cookie maxAge:', logoutCookie.maxAge);
  }

  // CHECK 10: After logout, cookie-based auth should fail
  // Clear our stored token but keep expired cookie
  allCookies['session_token'] = '';
  r = await fetch('GET', '/api/auth/me');
  const c10 = r.status === 401;
  checks.push(c10);
  console.log('CHECK 10 - After logout, auth fails:', c10 ? 'PASS' : 'FAIL', '(status=' + r.status + ')');

  // Summary
  const allPassed = checks.every(c => c);
  console.log('\n=== SUMMARY ===');
  console.log(allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
  console.log(checks.filter(c => c).length + '/' + checks.length + ' passed');
  process.exit(allPassed ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
