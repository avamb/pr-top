/**
 * Track 1D — tests for the anti-bot registration middleware
 * (src/backend/src/middleware/antibot.js) and the plumbing it depends on
 * (utils/clientIp.js, utils/session.js, per-route limiters in index.js).
 *
 * Follows the plain-node-script convention of test_403_ratelimit.js /
 * test_api_regression.js: fetch against `baseUrl`, PASS/FAIL lines, non-zero
 * exit on any failure.
 *
 * Server under test must be started with ANTIBOT_ENABLED unset/true and an
 * EMPTY TURNSTILE_SECRET for cases 1, 2, 3, 5, 6 (see docs/security/
 * SPEC_ANTIBOT_WAVES.md, "Трек 1D").
 *
 * Case 4 (Turnstile) needs a SECOND server instance started with
 * TURNSTILE_SECRET=2x0000000000000000000000000000000AA (Cloudflare's
 * "always fail" dev secret). Point this script at it via
 * ANTIBOT_TEST_TURNSTILE_URL=http://localhost:<port>; otherwise case 4 is
 * skipped and this script prints the command to start such a server.
 */

const baseUrl = process.env.BASE_URL || 'http://localhost:3999';
const turnstileUrl = process.env.ANTIBOT_TEST_TURNSTILE_URL || '';

let passed = 0;
let failed = 0;

function ok(label, cond, extra) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${extra ? ': ' + extra : ''}`);
    failed++;
  }
}

function uniqueEmail(tag) {
  return `antibot_${Date.now()}_${tag}_${Math.floor(Math.random() * 1e6)}@example.com`;
}

const PASSWORD = 'Passw0rdX1';

// --- CSRF helper -----------------------------------------------------------
// Mirrors test_403_ratelimit.js: GET /api/csrf-token, send the token back via
// X-CSRF-Token header and replay the Set-Cookie it returned (csrf.js keeps
// tokens in an in-memory Map keyed by the token value itself, not tied to the
// cookie, but existing tests always forward the cookie too — do the same).
async function getCsrf(url) {
  const r = await fetch(`${url}/api/csrf-token`);
  const data = await r.json();
  const cookie = r.headers.get('set-cookie') || '';
  return { csrf: data.csrfToken, cookie };
}

async function registerRaw(url, body, extraHeaders) {
  const { csrf, cookie } = await getCsrf(url);
  const headers = Object.assign(
    { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Cookie': cookie },
    extraHeaders || {}
  );
  const r = await fetch(`${url}/api/auth/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  let data;
  try { data = await r.json(); } catch (e) { data = null; }
  return { res: r, data };
}

// Generic CSRF-wrapped POST for the non-register routes (case 7, 9).
async function postRaw(url, path, body, extraHeaders) {
  const { csrf, cookie } = await getCsrf(url);
  const headers = Object.assign(
    { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Cookie': cookie },
    extraHeaders || {}
  );
  const r = await fetch(`${url}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  let data;
  try { data = await r.json(); } catch (e) { data = null; }
  return { res: r, data };
}

async function loginRaw(url, email, password) {
  const { csrf, cookie } = await getCsrf(url);
  const r = await fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Cookie': cookie },
    body: JSON.stringify({ email, password })
  });
  let data;
  try { data = await r.json(); } catch (e) { data = null; }
  return { res: r, data };
}

// --- Case 2: honeypot -------------------------------------------------------
async function case2() {
  console.log('\n=== Case 2: honeypot filled (website) -> fake success ===');
  const email = uniqueEmail('honeypot');
  const body = {
    email,
    password: PASSWORD,
    role: 'therapist',
    form_started_at: Date.now() - 5000,
    website: 'http://spam'
  };
  const { res, data } = await registerRaw(baseUrl, body);
  ok('register -> 201 (fake success)', res.status === 201, `got ${res.status} ${JSON.stringify(data)}`);
  ok('user.id === 0 (no real user created)', !!(data && data.user && data.user.id === 0), JSON.stringify(data && data.user));

  const { res: loginRes } = await loginRaw(baseUrl, email, PASSWORD);
  ok('login with those creds -> 401 (user never created)', loginRes.status === 401, `got ${loginRes.status}`);
}

// --- Case 3: timing ----------------------------------------------------------
// Timing is an honest 400 (not a fake success): password-manager autofill can
// legitimately submit under ANTIBOT_MIN_FORM_MS, and a retry passes because
// form_started_at comes from page mount.
async function case3() {
  console.log('\n=== Case 3: form submitted too fast (form_started_at = now) -> 400 FORM_TOO_FAST, retry succeeds ===');
  const email = uniqueEmail('timing');
  const body = {
    email,
    password: PASSWORD,
    role: 'therapist',
    form_started_at: Date.now(),
    website: ''
  };
  const { res, data } = await registerRaw(baseUrl, body);
  ok('register -> 400', res.status === 400, `got ${res.status} ${JSON.stringify(data)}`);
  ok('code === FORM_TOO_FAST', !!(data && data.code === 'FORM_TOO_FAST'), JSON.stringify(data));
  ok('error text present', !!(data && typeof data.error === 'string' && data.error.length > 0), JSON.stringify(data));

  const { res: loginRes } = await loginRaw(baseUrl, email, PASSWORD);
  ok('login with those creds -> 401 (user not created by the rejected attempt)', loginRes.status === 401, `got ${loginRes.status}`);

  const retry = await registerRaw(baseUrl, Object.assign({}, body, { form_started_at: Date.now() - 5000 }));
  ok('retry with form_started_at = now-5000 -> 201', retry.res.status === 201, `got ${retry.res.status} ${JSON.stringify(retry.data)}`);
  ok('retry created a real user (id > 0)', !!(retry.data && retry.data.user && retry.data.user.id > 0), JSON.stringify(retry.data && retry.data.user));
}

// --- Case 7: honeypot on /forgot-password mirrors that route's success -------
async function case7() {
  console.log('\n=== Case 7: /forgot-password with honeypot -> 200 { message } (no user/token) ===');
  const { res, data } = await postRaw(baseUrl, '/api/auth/forgot-password', {
    email: uniqueEmail('forgot'),
    form_started_at: Date.now() - 5000,
    website: 'http://spam'
  });
  ok('forgot-password -> 200', res.status === 200, `got ${res.status} ${JSON.stringify(data)}`);
  ok('body has message', !!(data && typeof data.message === 'string'), JSON.stringify(data));
  ok('body has no user/token keys', !!(data && !('user' in data) && !('token' in data)), JSON.stringify(data));
  ok('response keys are exactly [message]', !!(data && JSON.stringify(Object.keys(data)) === '["message"]'), JSON.stringify(data && Object.keys(data)));
}

// --- Case 8: IPv6 /64 bucket -------------------------------------------------
async function case8() {
  console.log('\n=== Case 8: IPv6 addresses in one /64 share a limiter bucket; another /64 is independent ===');
  async function remainingFrom(ip, tag) {
    const { res } = await registerRaw(baseUrl, {
      email: uniqueEmail(tag),
      password: PASSWORD,
      role: 'therapist',
      form_started_at: Date.now() - 5000,
      website: ''
    }, { 'CF-Connecting-IP': ip });
    const remaining = res.headers.get('ratelimit-remaining');
    return remaining === null ? null : Number(remaining);
  }
  const a1 = await remainingFrom('2001:db8:1:2:aaaa::1', 'v6a1');
  const a2 = await remainingFrom('2001:db8:1:2:bbbb::2', 'v6a2');
  const b1 = await remainingFrom('2001:db8:9:9::1', 'v6b1');
  ok('same /64 second address remaining is one less than first', a1 !== null && a2 !== null && a2 === a1 - 1, `a1=${a1} a2=${a2}`);
  ok('different /64 is independent (remaining equals first call of the other prefix)', b1 !== null && b1 === a1, `a1=${a1} b1=${b1}`);
}

// --- Case 9: fake path latency ----------------------------------------------
async function case9() {
  console.log('\n=== Case 9: honeypot fake path takes >= 250 ms (bcrypt-like latency) ===');
  if (!turnstileUrl) {
    console.log('  SKIP: runs only when ANTIBOT_TEST_TURNSTILE_URL is set');
    return;
  }
  const started = Date.now();
  const { res, data } = await registerRaw(turnstileUrl, {
    email: uniqueEmail('slow'),
    password: PASSWORD,
    role: 'therapist',
    form_started_at: Date.now() - 5000,
    website: 'http://spam',
    turnstile_token: 'x'
  });
  const elapsed = Date.now() - started;
  ok('honeypot wins over Turnstile -> 201 fake success', res.status === 201 && !!(data && data.user && data.user.id === 0), `got ${res.status} ${JSON.stringify(data)}`);
  ok('fake path took >= 250 ms', elapsed >= 250, `elapsed=${elapsed}ms`);
}

// --- Case 4: Turnstile -------------------------------------------------------
async function case4() {
  console.log('\n=== Case 4: Turnstile always-fail dev secret -> 403 TURNSTILE_FAILED ===');
  if (!turnstileUrl) {
    console.log('  SKIP: set ANTIBOT_TEST_TURNSTILE_URL to a second server instance started with:');
    console.log('    TURNSTILE_SECRET=2x0000000000000000000000000000000AA NODE_ENV=development PORT=<port> JWT_SECRET=devsecret DATABASE_URL=sqlite:<scratch file> node src/index.js');
    console.log('  then re-run with: ANTIBOT_TEST_TURNSTILE_URL=http://localhost:<port> node test_antibot.js');
    return;
  }
  const email = uniqueEmail('turnstile');
  const body = {
    email,
    password: PASSWORD,
    role: 'therapist',
    form_started_at: Date.now() - 5000,
    website: '',
    turnstile_token: 'x'
  };
  const { res, data } = await registerRaw(turnstileUrl, body);
  ok('register -> 403', res.status === 403, `got ${res.status} ${JSON.stringify(data)}`);
  ok('code === TURNSTILE_FAILED', !!(data && data.code === 'TURNSTILE_FAILED'), JSON.stringify(data));
}

// --- Case 5: per-IP limiter isolation ---------------------------------------
async function case5() {
  console.log('\n=== Case 5: per-IP limiter isolation (CF-Connecting-IP) ===');

  async function registerFromIp(ip, tag) {
    const email = uniqueEmail(tag);
    const body = {
      email,
      password: PASSWORD,
      role: 'therapist',
      form_started_at: Date.now() - 5000,
      website: ''
    };
    const { res } = await registerRaw(baseUrl, body, { 'CF-Connecting-IP': ip });
    const remaining = res.headers.get('ratelimit-remaining');
    return { status: res.status, remaining: remaining === null ? null : Number(remaining) };
  }

  const ipA1 = await registerFromIp('1.2.3.4', 'ipA1');
  const ipB1 = await registerFromIp('5.6.7.8', 'ipB1');

  ok('IP A first call has RateLimit-Remaining header', ipA1.remaining !== null, JSON.stringify(ipA1));
  ok('IP B first call has RateLimit-Remaining header', ipB1.remaining !== null, JSON.stringify(ipB1));
  ok(
    'IP A and IP B first-call remaining are equal (independent counters)',
    ipA1.remaining === ipB1.remaining,
    `A=${ipA1.remaining} B=${ipB1.remaining}`
  );

  const ipA2 = await registerFromIp('1.2.3.4', 'ipA2');
  ok(
    'IP A second call remaining is one less than IP A first call (B did not share the budget)',
    ipA1.remaining !== null && ipA2.remaining !== null && ipA2.remaining === ipA1.remaining - 1,
    `A1=${ipA1.remaining} A2=${ipA2.remaining}`
  );
}

// --- Case 6: /me email_verified ----------------------------------------------
async function case6(bearerToken) {
  console.log('\n=== Case 6: GET /api/auth/me exposes email_verified boolean ===');
  if (!bearerToken) {
    ok('have a bearer token from case 1 to call /me with', false, 'case 1 did not yield a token');
    return;
  }
  const r = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${bearerToken}` }
  });
  let data;
  try { data = await r.json(); } catch (e) { data = null; }
  ok('GET /api/auth/me -> 200', r.status === 200, `got ${r.status} ${JSON.stringify(data)}`);
  ok(
    'user.email_verified === false (boolean)',
    !!(data && data.user && data.user.email_verified === false),
    JSON.stringify(data && data.user)
  );
}

// --- Case 1: legit register + login ------------------------------------
// Returns the register token so case6 can call /me with it.
async function case1AndReturnToken() {
  console.log('\n=== Case 1: legit registration (honeypot empty, timing OK) ===');
  const email = uniqueEmail('legit');
  const body = {
    email,
    password: PASSWORD,
    role: 'therapist',
    form_started_at: Date.now() - 5000,
    website: ''
  };
  const { res, data } = await registerRaw(baseUrl, body);
  ok('register -> 201', res.status === 201, `got ${res.status} ${JSON.stringify(data)}`);
  ok('user.id > 0', !!(data && data.user && data.user.id > 0), JSON.stringify(data && data.user));

  const keys = data ? Object.keys(data) : [];
  const expectedOrder = ['message', 'user', 'token'];
  const gotPrefix = keys.slice(0, 3);
  ok(
    'response key order is message,user,token',
    JSON.stringify(gotPrefix) === JSON.stringify(expectedOrder),
    `got ${JSON.stringify(keys)}`
  );

  const setCookie = res.headers.get('set-cookie') || '';
  ok(
    'Set-Cookie contains HttpOnly session_token',
    /session_token=/.test(setCookie) && /HttpOnly/i.test(setCookie),
    setCookie
  );

  const { res: loginRes, data: loginData } = await loginRaw(baseUrl, email, PASSWORD);
  ok('login with same creds -> 200', loginRes.status === 200, `got ${loginRes.status} ${JSON.stringify(loginData)}`);
  ok(
    'login response has user.email',
    !!(loginData && loginData.user && loginData.user.email === email),
    JSON.stringify(loginData)
  );

  return data && data.token;
}

async function run() {
  console.log(`\nTesting antibot against ${baseUrl}`);
  if (turnstileUrl) console.log(`Turnstile instance: ${turnstileUrl}`);

  const case1Token = await case1AndReturnToken();
  await case2();
  await case3();
  await case4();
  await case5();
  await case6(case1Token);
  await case7();
  await case8();
  await case9();

  console.log(`\nPASSED ${passed} / FAILED ${failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
