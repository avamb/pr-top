/**
 * Track 2E — tests for email verification
 * (src/backend/src/routes/emailVerification.js, the requireVerifiedEmail /
 * gateMutations gate in src/backend/src/middleware/auth.js, and its mounts
 * in src/backend/src/index.js).
 *
 * Follows the plain-node-script convention of _t_antibot.js: fetch against
 * `baseUrl`, PASS/FAIL lines, non-zero exit on any failure, CSRF via
 * GET /api/csrf-token + X-CSRF-Token header for pre-auth requests. Requests
 * that carry a Bearer Authorization header are CSRF-exempt by design
 * (middleware/csrf.js), so authenticated calls below skip the CSRF dance.
 *
 * Spec: docs/security/SPEC_ANTIBOT_WAVES.md §0 (A2, A3, A12) and §3 "Трек 2E".
 *
 * Server under test must be started with AUTH_DEV_ECHO=true and
 * NODE_ENV!=='production' so /register and /resend-verification echo
 * dev_verification_token (A12).
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
  return `emailverify_${Date.now()}_${tag}_${Math.floor(Math.random() * 1e6)}@example.com`;
}

const PASSWORD = 'Passw0rdX1';

// --- CSRF helper (pre-auth requests only; mirrors _t_antibot.js) -----------
async function getCsrf(url) {
  const r = await fetch(`${url}/api/csrf-token`);
  const data = await r.json();
  const cookie = r.headers.get('set-cookie') || '';
  return { csrf: data.csrfToken, cookie };
}

async function registerRaw(url, body) {
  const { csrf, cookie } = await getCsrf(url);
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Cookie': cookie };
  const r = await fetch(`${url}/api/auth/register`, { method: 'POST', headers, body: JSON.stringify(body) });
  let data;
  try { data = await r.json(); } catch (e) { data = null; }
  return { res: r, data };
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

// Bearer-authenticated GET/POST — CSRF-exempt (Authorization header present).
async function authGet(url, path, token) {
  const r = await fetch(`${url}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  let data;
  try { data = await r.json(); } catch (e) { data = null; }
  return { res: r, data };
}

async function authPost(url, path, token, body) {
  const r = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body || {})
  });
  let data;
  try { data = await r.json(); } catch (e) { data = null; }
  return { res: r, data };
}

async function verifyEmail(url, token) {
  return fetch(`${url}/api/auth/verify-email?token=${encodeURIComponent(token)}`, { redirect: 'manual' });
}

async function me(url, token) {
  return authGet(url, '/api/auth/me', token);
}

// --- Case 1: register -------------------------------------------------------
async function case1() {
  console.log('\n=== Case 1: register -> 201 with dev_verification_token; /me email_verified=false ===');
  const email = uniqueEmail('first');
  const { res, data } = await registerRaw(baseUrl, registerBody(email));
  ok('register -> 201', res.status === 201, `got ${res.status} ${JSON.stringify(data)}`);
  ok('dev_verification_token is 64 hex chars', !!(data && /^[0-9a-f]{64}$/i.test(data.dev_verification_token)), JSON.stringify(data));

  const token = data && data.token;
  const { res: meRes, data: meData } = await me(baseUrl, token);
  ok('GET /me -> 200', meRes.status === 200, `got ${meRes.status} ${JSON.stringify(meData)}`);
  ok('user.email_verified === false', !!(meData && meData.user && meData.user.email_verified === false), JSON.stringify(meData && meData.user));

  return { email, token, verificationToken: data && data.dev_verification_token };
}

// --- Case 2: gate blocks mutations, not reads -------------------------------
async function case2(userToken) {
  console.log('\n=== Case 2: gate blocks POST /clients/solo, GET /invite-code/link; allows GET /clients, GET /invite-code/ ===');
  const { res: soloRes, data: soloData } = await authPost(baseUrl, '/api/clients/solo', userToken, { first_name: 'Test' });
  ok('POST /clients/solo -> 403', soloRes.status === 403, `got ${soloRes.status} ${JSON.stringify(soloData)}`);
  ok('code === EMAIL_NOT_VERIFIED', !!(soloData && soloData.code === 'EMAIL_NOT_VERIFIED'), JSON.stringify(soloData));

  const { res: clientsRes } = await authGet(baseUrl, '/api/clients', userToken);
  ok('GET /clients -> 200', clientsRes.status === 200, `got ${clientsRes.status}`);

  const { res: inviteListRes } = await authGet(baseUrl, '/api/invite-code/', userToken);
  ok('GET /invite-code/ -> 200', inviteListRes.status === 200, `got ${inviteListRes.status}`);

  const { res: inviteLinkRes, data: inviteLinkData } = await authGet(baseUrl, '/api/invite-code/link', userToken);
  ok('GET /invite-code/link -> 403', inviteLinkRes.status === 403, `got ${inviteLinkRes.status} ${JSON.stringify(inviteLinkData)}`);
  ok('code === EMAIL_NOT_VERIFIED', !!(inviteLinkData && inviteLinkData.code === 'EMAIL_NOT_VERIFIED'), JSON.stringify(inviteLinkData));
}

// --- Case 3: verify-email redirects -----------------------------------------
async function case3(verificationToken) {
  console.log('\n=== Case 3: GET /verify-email bad token -> status=error; real token -> dashboard?verified=1; reuse -> status=error ===');
  const bad = await verifyEmail(baseUrl, 'not-a-real-token-0000000000000000000000000000000000000000000');
  const badLocation = bad.headers.get('location') || '';
  ok('bad token -> 302', bad.status === 302, `got ${bad.status}`);
  ok('Location contains /verify-email?status=error', badLocation.includes('/verify-email?status=error'), badLocation);

  const real = await verifyEmail(baseUrl, verificationToken);
  const realLocation = real.headers.get('location') || '';
  ok('real token -> 302', real.status === 302, `got ${real.status}`);
  ok('Location contains /dashboard?verified=1', realLocation.includes('/dashboard?verified=1'), realLocation);
  ok('Set-Cookie contains session_token', /session_token=/.test(real.headers.get('set-cookie') || ''), real.headers.get('set-cookie') || '');

  const reused = await verifyEmail(baseUrl, verificationToken);
  const reusedLocation = reused.headers.get('location') || '';
  ok('reused token -> 302', reused.status === 302, `got ${reused.status}`);
  ok('Location contains /verify-email?status=error', reusedLocation.includes('/verify-email?status=error'), reusedLocation);
}

// --- Case 4: post-verification state ---------------------------------------
async function case4(userToken) {
  console.log('\n=== Case 4: /me email_verified=true; POST /clients/solo no longer 403 ===');
  const { res: meRes, data: meData } = await me(baseUrl, userToken);
  ok('GET /me -> 200', meRes.status === 200, `got ${meRes.status} ${JSON.stringify(meData)}`);
  ok('user.email_verified === true', !!(meData && meData.user && meData.user.email_verified === true), JSON.stringify(meData && meData.user));

  const { res: soloRes, data: soloData } = await authPost(baseUrl, '/api/clients/solo', userToken, { first_name: 'Test Client' });
  ok('POST /clients/solo status !== 403', soloRes.status !== 403, `got ${soloRes.status} ${JSON.stringify(soloData)}`);
}

// --- Case 5: resend-verification rate limit ---------------------------------
async function case5() {
  console.log('\n=== Case 5: second user — POST /resend-verification x3 -> 200 (token changes), 4th -> 429 ===');
  const email = uniqueEmail('second');
  const { res: regRes, data: regData } = await registerRaw(baseUrl, registerBody(email));
  ok('register -> 201', regRes.status === 201, `got ${regRes.status} ${JSON.stringify(regData)}`);
  const token = regData && regData.token;
  const firstVerificationToken = regData && regData.dev_verification_token;

  const seenTokens = [firstVerificationToken];
  let allTwoHundred = true;
  for (let i = 1; i <= 3; i++) {
    const { res, data } = await authPost(baseUrl, '/api/auth/resend-verification', token);
    if (res.status !== 200) allTwoHundred = false;
    ok(`resend ${i} -> 200`, res.status === 200, `got ${res.status} ${JSON.stringify(data)}`);
    ok(`resend ${i} dev_verification_token is 64 hex chars`, !!(data && /^[0-9a-f]{64}$/i.test(data.dev_verification_token)), JSON.stringify(data));
    seenTokens.push(data && data.dev_verification_token);
  }
  const uniqueTokens = new Set(seenTokens.filter(Boolean));
  ok('every resend produced a different token', uniqueTokens.size === seenTokens.filter(Boolean).length, JSON.stringify(seenTokens));

  const { res: fourthRes, data: fourthData } = await authPost(baseUrl, '/api/auth/resend-verification', token);
  ok('4th resend -> 429', fourthRes.status === 429, `got ${fourthRes.status} ${JSON.stringify(fourthData)}`);

  return { email, token };
}

// --- Case 6: change-unverified-email ----------------------------------------
// Uses a FRESH third user rather than the second user from case5: resend and
// change-unverified-email share one 3/h budget per user (see
// routes/emailVerification.js RESEND_COUNTED_ACTIONS), and case5 already
// spent the second user's whole budget on successful resends. Reusing it
// here would make every call below hit 429 before reaching the
// password/email checks this case is meant to exercise.
async function case6(firstUserEmail, firstUserToken) {
  console.log('\n=== Case 6: POST /change-unverified-email — missing password, wrong password, email conflict, already-verified user ===');
  const thirdEmail = uniqueEmail('third');
  const { res: regRes, data: regData } = await registerRaw(baseUrl, registerBody(thirdEmail));
  ok('third user register -> 201', regRes.status === 201, `got ${regRes.status} ${JSON.stringify(regData)}`);
  const thirdToken = regData && regData.token;

  const newEmail = uniqueEmail('changed');

  const { res: noPwRes, data: noPwData } = await authPost(baseUrl, '/api/auth/change-unverified-email', thirdToken, { email: newEmail });
  ok('no password -> 400', noPwRes.status === 400, `got ${noPwRes.status} ${JSON.stringify(noPwData)}`);

  const { res: wrongPwRes, data: wrongPwData } = await authPost(baseUrl, '/api/auth/change-unverified-email', thirdToken, {
    email: newEmail,
    password: 'DefinitelyWrongPassw0rd'
  });
  ok('wrong password -> 401', wrongPwRes.status === 401, `got ${wrongPwRes.status} ${JSON.stringify(wrongPwData)}`);

  const { res: conflictRes, data: conflictData } = await authPost(baseUrl, '/api/auth/change-unverified-email', thirdToken, {
    email: firstUserEmail,
    password: PASSWORD
  });
  ok('to first (verified) user email -> 409', conflictRes.status === 409, `got ${conflictRes.status} ${JSON.stringify(conflictData)}`);

  const { res: onVerifiedRes, data: onVerifiedData } = await authPost(baseUrl, '/api/auth/change-unverified-email', firstUserToken, {
    email: uniqueEmail('irrelevant'),
    password: PASSWORD
  });
  ok('on the (already verified) first user -> 400', onVerifiedRes.status === 400, `got ${onVerifiedRes.status} ${JSON.stringify(onVerifiedData)}`);
}

// --- Case 7: resend on already-verified user --------------------------------
async function case7(firstUserToken) {
  console.log('\n=== Case 7: POST /resend-verification on the verified (first) user -> 200 already_verified=true ===');
  const { res, data } = await authPost(baseUrl, '/api/auth/resend-verification', firstUserToken);
  ok('status 200', res.status === 200, `got ${res.status} ${JSON.stringify(data)}`);
  ok('already_verified === true', !!(data && data.already_verified === true), JSON.stringify(data));
}

// --- Case 8: login-CSRF guard on GET /verify-email --------------------------
// The browser already holds a VALID session_token cookie of another user
// (the verified first user). Clicking a fresh user's link must still confirm
// the fresh user's email (the token proves mailbox ownership) but must NOT
// swap the browser session: no Set-Cookie, redirect to /login?verified=1.
async function case8(otherUserSessionToken) {
  console.log('\n=== Case 8: verify-email with another user\'s session_token cookie -> /login?verified=1, no Set-Cookie, owner verified ===');
  const email = uniqueEmail('fourth');
  const { res: regRes, data: regData } = await registerRaw(baseUrl, registerBody(email));
  ok('fourth user register -> 201', regRes.status === 201, `got ${regRes.status} ${JSON.stringify(regData)}`);
  const ownerToken = regData && regData.token;
  const verificationToken = regData && regData.dev_verification_token;

  const r = await fetch(`${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(verificationToken)}`, {
    redirect: 'manual',
    headers: { Cookie: `session_token=${otherUserSessionToken}` }
  });
  const location = r.headers.get('location') || '';
  ok('-> 302', r.status === 302, `got ${r.status}`);
  ok('Location contains /login?verified=1 (not /dashboard)', location.includes('/login?verified=1') && !location.includes('/dashboard'), location);
  ok('no Set-Cookie (other user\'s session untouched)', !r.headers.get('set-cookie'), r.headers.get('set-cookie') || '');

  const { res: meRes, data: meData } = await me(baseUrl, ownerToken);
  ok('owner /me -> 200', meRes.status === 200, `got ${meRes.status}`);
  ok('owner user.email_verified === true', !!(meData && meData.user && meData.user.email_verified === true), JSON.stringify(meData && meData.user));

  const reused = await verifyEmail(baseUrl, verificationToken);
  ok('token consumed (reuse -> status=error)', (reused.headers.get('location') || '').includes('/verify-email?status=error'), reused.headers.get('location') || '');

  // Same user's own cookie must still get the normal path.
  const email2 = uniqueEmail('fifth');
  const { data: reg2 } = await registerRaw(baseUrl, registerBody(email2));
  const r2 = await fetch(`${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(reg2.dev_verification_token)}`, {
    redirect: 'manual',
    headers: { Cookie: `session_token=${reg2.token}` }
  });
  ok('own cookie -> /dashboard?verified=1 with Set-Cookie', (r2.headers.get('location') || '').includes('/dashboard?verified=1') && /session_token=/.test(r2.headers.get('set-cookie') || ''), `${r2.headers.get('location')} ${r2.headers.get('set-cookie') || ''}`);
}

async function run() {
  console.log(`\nTesting email verification against ${baseUrl}`);

  const first = await case1();
  await case2(first.token);
  await case3(first.verificationToken);
  await case4(first.token);
  await case5();
  await case6(first.email, first.token);
  await case7(first.token);
  await case8(first.token);

  console.log(`\nPASSED ${passed} / FAILED ${failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
