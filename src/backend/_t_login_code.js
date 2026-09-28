/**
 * Track 2E — tests for login-by-email-code
 * (src/backend/src/routes/loginCode.js, src/backend/src/utils/loginCodes.js).
 *
 * Follows the plain-node-script convention of _t_antibot.js: fetch against
 * `baseUrl`, PASS/FAIL lines, non-zero exit on any failure, CSRF via
 * GET /api/csrf-token + X-CSRF-Token header + forwarded Set-Cookie.
 *
 * Spec: docs/security/SPEC_ANTIBOT_WAVES.md §0 (A7, A8, A12) and §3 "Трек 2E".
 *
 * Server under test must be started with AUTH_DEV_ECHO=true and
 * NODE_ENV!=='production' so POST /request echoes dev_code/dev_link_token
 * (A12). ANTIBOT_ENABLED may be left default; the /request route only runs
 * the Turnstile leg (honeypot:false) and TURNSTILE_SECRET is expected empty
 * (=off) for this run.
 */

const baseUrl = process.env.BASE_URL || 'http://localhost:3999';

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
  return `logincode_${Date.now()}_${tag}_${Math.floor(Math.random() * 1e6)}@example.com`;
}

const PASSWORD = 'Passw0rdX1';

// --- CSRF + generic helpers (mirrors _t_antibot.js) -------------------------
async function getCsrf(url) {
  const r = await fetch(`${url}/api/csrf-token`);
  const data = await r.json();
  const cookie = r.headers.get('set-cookie') || '';
  return { csrf: data.csrfToken, cookie };
}

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

async function registerRaw(url, body) {
  return postRaw(url, '/api/auth/register', body);
}

async function requestCode(url, email) {
  return postRaw(url, '/api/auth/login-code/request', { email });
}

async function verifyCode(url, email, code) {
  return postRaw(url, '/api/auth/login-code/verify', { email, code });
}

async function getLink(url, token) {
  return fetch(`${url}/api/auth/login-code/link?token=${encodeURIComponent(token)}`, { redirect: 'manual' });
}

function registerBody(email) {
  return {
    email,
    password: PASSWORD,
    role: 'therapist',
    form_started_at: Date.now() - 5000,
    website: ''
  };
}

// --- Case 1: unknown email -----------------------------------------------
async function case1() {
  console.log('\n=== Case 1: /request for a non-existent email -> 200, no dev_code, elapsed >= 500ms ===');
  const started = Date.now();
  const { res, data } = await requestCode(baseUrl, uniqueEmail('nosuchuser'));
  const elapsed = Date.now() - started;
  ok('status 200', res.status === 200, `got ${res.status} ${JSON.stringify(data)}`);
  ok('no dev_code in body', !(data && 'dev_code' in data), JSON.stringify(data));
  ok('elapsed >= 500ms', elapsed >= 500, `elapsed=${elapsed}ms`);
}

// --- Case 2: register + request -> dev_code / dev_link_token --------------
async function case2() {
  console.log('\n=== Case 2: register then /request -> 200 with dev_code + dev_link_token ===');
  const email = uniqueEmail('main');
  const reg = await registerRaw(baseUrl, registerBody(email));
  ok('register -> 201', reg.res.status === 201, `got ${reg.res.status} ${JSON.stringify(reg.data)}`);

  const { res, data } = await requestCode(baseUrl, email);
  ok('request -> 200', res.status === 200, `got ${res.status} ${JSON.stringify(data)}`);
  ok('dev_code is 6 digits', !!(data && /^\d{6}$/.test(data.dev_code)), JSON.stringify(data));
  ok('dev_link_token is 64 hex chars', !!(data && /^[0-9a-f]{64}$/i.test(data.dev_link_token)), JSON.stringify(data));

  return { email, code: data && data.dev_code, linkToken: data && data.dev_link_token };
}

// --- Case 3: malformed code -------------------------------------------------
async function case3(email) {
  console.log('\n=== Case 3: /verify with malformed code -> 400 CODE_INVALID ===');
  const { res, data } = await verifyCode(baseUrl, email, 'abc');
  ok('status 400', res.status === 400, `got ${res.status} ${JSON.stringify(data)}`);
  ok('code === CODE_INVALID', !!(data && data.code === 'CODE_INVALID'), JSON.stringify(data));
}

// --- Case 4: wrong code x6 -> always 401 CODE_INVALID (no lock oracle); correct code then rejected
function wrongCodeFor(correctCode, offset) {
  return String((Number(correctCode) + offset) % 1000000).padStart(6, '0');
}

async function case4(email, correctCode) {
  console.log('\n=== Case 4: wrong code x6 -> every attempt 401 CODE_INVALID (never CODE_LOCKED); correct code then rejected ===');
  for (let i = 1; i <= 6; i++) {
    // wrong code must be well-formed (6 digits) but not equal to the real one
    const wrong = wrongCodeFor(correctCode, i);
    const { res, data } = await verifyCode(baseUrl, email, wrong);
    ok(`attempt ${i} -> 401 CODE_INVALID`, res.status === 401 && !!(data && data.code === 'CODE_INVALID'), `got ${res.status} ${JSON.stringify(data)}`);
  }

  const { res: res2, data: data2 } = await verifyCode(baseUrl, email, correctCode);
  ok('correct code now rejected (401 CODE_INVALID)', res2.status === 401 && !!(data2 && data2.code === 'CODE_INVALID'), `got ${res2.status} ${JSON.stringify(data2)}`);
}

// --- Case 5: fresh request + verify -> session, /me email_verified --------
async function case5(email) {
  console.log('\n=== Case 5: /request again -> new code; /verify correct -> 200 session; /me email_verified=true ===');
  const { res: reqRes, data: reqData } = await requestCode(baseUrl, email);
  ok('request -> 200 with new dev_code', reqRes.status === 200 && !!(reqData && /^\d{6}$/.test(reqData.dev_code)), JSON.stringify(reqData));
  const code = reqData && reqData.dev_code;

  const { res, data } = await verifyCode(baseUrl, email, code);
  ok('verify -> 200', res.status === 200, `got ${res.status} ${JSON.stringify(data)}`);
  ok('body has message', !!(data && typeof data.message === 'string'), JSON.stringify(data));
  ok(
    'body has user.{id,email,role,timezone}',
    !!(data && data.user && data.user.id && data.user.email === email && data.user.role && data.user.timezone),
    JSON.stringify(data && data.user)
  );
  ok('body has token', !!(data && typeof data.token === 'string' && data.token.length > 0), JSON.stringify(data));

  const setCookie = res.headers.get('set-cookie') || '';
  ok('Set-Cookie contains session_token', /session_token=/.test(setCookie), setCookie);

  const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${data && data.token}` } });
  let meData;
  try { meData = await meRes.json(); } catch (e) { meData = null; }
  ok('GET /me -> 200', meRes.status === 200, `got ${meRes.status} ${JSON.stringify(meData)}`);
  ok(
    '/me user.email_verified === true',
    !!(meData && meData.user && meData.user.email_verified === true),
    JSON.stringify(meData && meData.user)
  );

  return code;
}

// --- Case 6: replay same code -> 401 ---------------------------------------
async function case6(email, code) {
  console.log('\n=== Case 6: replay the same (already-consumed) code -> 401 ===');
  const { res, data } = await verifyCode(baseUrl, email, code);
  ok('status 401', res.status === 401, `got ${res.status} ${JSON.stringify(data)}`);
}

// --- Case 7: per-email limit (dedicated fresh user, deterministic count) --
async function case7() {
  console.log('\n=== Case 7: /request per-email limit -> 4th request in the same window returns 200 without dev_code ===');
  const email = uniqueEmail('ratelimited');
  const reg = await registerRaw(baseUrl, registerBody(email));
  ok('register -> 201', reg.res.status === 201, `got ${reg.res.status} ${JSON.stringify(reg.data)}`);

  const results = [];
  for (let i = 1; i <= 4; i++) {
    const { res, data } = await requestCode(baseUrl, email);
    results.push({ i, status: res.status, hasDevCode: !!(data && 'dev_code' in data) });
  }

  ok('request 1 -> 200 with dev_code', results[0].status === 200 && results[0].hasDevCode, JSON.stringify(results[0]));
  ok('request 2 -> 200 with dev_code', results[1].status === 200 && results[1].hasDevCode, JSON.stringify(results[1]));
  ok('request 3 -> 200 with dev_code', results[2].status === 200 && results[2].hasDevCode, JSON.stringify(results[2]));
  ok('request 4 -> 200 WITHOUT dev_code (per-email limit hit)', results[3].status === 200 && !results[3].hasDevCode, JSON.stringify(results[3]));
}

// --- Case 8: magic link -----------------------------------------------------
async function case8(email) {
  console.log('\n=== Case 8: GET /link -> 302 /dashboard + Set-Cookie; reused -> 302 /login?code_error=expired; garbage -> same ===');
  const { data: reqData } = await requestCode(baseUrl, email);
  const linkToken = reqData && reqData.dev_link_token;
  ok('have a fresh dev_link_token to test with', !!(linkToken && /^[0-9a-f]{64}$/i.test(linkToken)), JSON.stringify(reqData));

  const first = await getLink(baseUrl, linkToken);
  const firstLocation = first.headers.get('location') || '';
  ok('first use -> 302', first.status === 302, `got ${first.status}`);
  ok('Location ends with /dashboard', firstLocation.endsWith('/dashboard'), firstLocation);
  ok('Set-Cookie present', !!(first.headers.get('set-cookie')), 'no set-cookie header');

  const reused = await getLink(baseUrl, linkToken);
  const reusedLocation = reused.headers.get('location') || '';
  ok('reused link -> 302', reused.status === 302, `got ${reused.status}`);
  ok('Location -> /login?code_error=expired', reusedLocation.endsWith('/login?code_error=expired'), reusedLocation);

  const garbage = await getLink(baseUrl, 'not-a-real-token');
  const garbageLocation = garbage.headers.get('location') || '';
  ok('garbage token -> 302', garbage.status === 302, `got ${garbage.status}`);
  ok('garbage token Location -> /login?code_error=expired', garbageLocation.endsWith('/login?code_error=expired'), garbageLocation);
}

// --- Case 10: per-email failure budget (10 failed verifies / 1h) ------------
// 10a: budget exhausted -> even the CORRECT, still-active code is rejected.
//      Failures are spread over 3 codes (5 + 4 + 1) so the 3rd code stays
//      active (attempts=1) when the lock kicks in; the issuance limit (3 per
//      15 min) allows exactly 3 requests.
// 10b: budget exhausted (5 + 5) -> /request answers 200 WITHOUT dev_code
//      although the issuance limit (2 of 3 used) would still allow a code.
async function failNTimes(email, correctCode, n) {
  let allInvalid = true;
  for (let i = 1; i <= n; i++) {
    const { res, data } = await verifyCode(baseUrl, email, wrongCodeFor(correctCode, i));
    if (!(res.status === 401 && data && data.code === 'CODE_INVALID')) allInvalid = false;
  }
  return allInvalid;
}

async function case10() {
  console.log('\n=== Case 10a: 10 failed verifies across 3 codes -> correct 3rd code rejected 401 CODE_INVALID (email locked) ===');
  {
    const email = uniqueEmail('emaillock_verify');
    const reg = await registerRaw(baseUrl, registerBody(email));
    ok('register -> 201', reg.res.status === 201, `got ${reg.res.status} ${JSON.stringify(reg.data)}`);

    const r1 = await requestCode(baseUrl, email);
    ok('code 1 issued', !!(r1.data && r1.data.dev_code), JSON.stringify(r1.data));
    ok('code 1: 5 wrong -> all 401 CODE_INVALID', await failNTimes(email, r1.data.dev_code, 5));

    const r2 = await requestCode(baseUrl, email);
    ok('code 2 issued', !!(r2.data && r2.data.dev_code), JSON.stringify(r2.data));
    ok('code 2: 4 wrong -> all 401 CODE_INVALID', await failNTimes(email, r2.data.dev_code, 4));

    const r3 = await requestCode(baseUrl, email);
    ok('code 3 issued (9 failures so far, budget not yet exhausted)', !!(r3.data && r3.data.dev_code), JSON.stringify(r3.data));
    ok('code 3: 1 wrong -> 401 CODE_INVALID (10th failure)', await failNTimes(email, r3.data.dev_code, 1));

    const { res, data } = await verifyCode(baseUrl, email, r3.data.dev_code);
    ok('CORRECT code 3 -> 401 CODE_INVALID (email locked)', res.status === 401 && !!(data && data.code === 'CODE_INVALID'), `got ${res.status} ${JSON.stringify(data)}`);
    ok('no session cookie issued', !/session_token=/.test(res.headers.get('set-cookie') || ''), res.headers.get('set-cookie'));
  }

  console.log('\n=== Case 10b: 10 failed verifies across 2 codes -> /request returns 200 WITHOUT dev_code (email locked) ===');
  {
    const email = uniqueEmail('emaillock_request');
    const reg = await registerRaw(baseUrl, registerBody(email));
    ok('register -> 201', reg.res.status === 201, `got ${reg.res.status} ${JSON.stringify(reg.data)}`);

    const r1 = await requestCode(baseUrl, email);
    ok('code 1 issued', !!(r1.data && r1.data.dev_code), JSON.stringify(r1.data));
    ok('code 1: 5 wrong -> all 401 CODE_INVALID', await failNTimes(email, r1.data.dev_code, 5));

    const r2 = await requestCode(baseUrl, email);
    ok('code 2 issued', !!(r2.data && r2.data.dev_code), JSON.stringify(r2.data));
    ok('code 2: 5 wrong -> all 401 CODE_INVALID', await failNTimes(email, r2.data.dev_code, 5));

    const started = Date.now();
    const r3 = await requestCode(baseUrl, email);
    const elapsed = Date.now() - started;
    ok('3rd /request -> 200', r3.res.status === 200, `got ${r3.res.status} ${JSON.stringify(r3.data)}`);
    ok('3rd /request has NO dev_code (email locked, issuance limit not yet hit)', !(r3.data && 'dev_code' in r3.data), JSON.stringify(r3.data));
    ok('3rd /request elapsed >= 500ms', elapsed >= 500, `elapsed=${elapsed}ms`);
  }
}

// --- Case 11: /verify timing floor for an unknown email ---------------------
async function case11() {
  console.log('\n=== Case 11: /verify for an unknown email -> 401 CODE_INVALID, elapsed >= 500ms ===');
  const started = Date.now();
  const { res, data } = await verifyCode(baseUrl, uniqueEmail('nosuchuser'), '123456');
  const elapsed = Date.now() - started;
  ok('status 401 CODE_INVALID', res.status === 401 && !!(data && data.code === 'CODE_INVALID'), `got ${res.status} ${JSON.stringify(data)}`);
  ok('elapsed >= 500ms', elapsed >= 500, `elapsed=${elapsed}ms`);
}

async function run() {
  console.log(`\nTesting login-code against ${baseUrl}`);

  await case1();
  const { email, code, linkToken } = await case2();
  await case3(email);
  await case4(email, code);
  const secondCode = await case5(email);
  await case6(email, secondCode);
  await case7();
  await case8(email);
  await case10();
  await case11();
  // linkToken from case2 is intentionally unused past this point (case5's
  // /verify already consumed the code issued alongside it; case8 issues and
  // consumes its own fresh link).
  void linkToken;

  console.log(`\nPASSED ${passed} / FAILED ${failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
