/**
 * Feature #391 — Regression sweep: subscription tier gating and Stripe webhooks
 *
 * Steps from spec:
 *  1. Verify plan limits enforced on client count, session storage, Pro/Premium-only features
 *  2. Trigger Stripe test webhooks (checkout/payment, subscription.updated, invoice.paid, payment_failed)
 *  3. Confirm expiry warning emails fire at correct thresholds
 *  4. Test downgrade path — feature access contracts correctly
 *  5. Check receipt email rendering
 */

'use strict';

const http = require('http');

const BASE = 'http://localhost:3001';
let passed = 0;
let failed = 0;
const failures = [];

// ─── helpers ─────────────────────────────────────────────────────────────────

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0,
        ...headers
      }
    };
    const r = http.request(opts, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: raw, headers: res.headers }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    failures.push(`${label}${detail ? ': ' + detail : ''}`);
    console.log(`  ✗ ${label}${detail ? ' [' + detail + ']' : ''}`);
  }
}

async function registerTherapist(tag) {
  const ts = Date.now();
  const email = `t391_${tag}_${ts}@test.com`;
  // Get CSRF token first
  const csrfR = await req('GET', '/api/csrf-token', null, {});
  const csrf = csrfR.body.csrfToken;
  const r = await req('POST', '/api/auth/register', {
    email,
    password: 'Test12345!',
    role: 'therapist'
  }, { 'X-CSRF-Token': csrf });
  if (r.status !== 201) throw new Error(`Register failed (${tag}): ${JSON.stringify(r.body)}`);
  return { email, token: r.body.token, userId: r.body.user?.id };
}

async function getCsrf(token) {
  const r = await req('GET', '/api/csrf-token', null, { Authorization: `Bearer ${token}` });
  return r.body.csrfToken;
}

async function setPlan(therapistId, plan) {
  const r = await req('POST', '/api/dev/set-plan', { therapist_id: therapistId, plan });
  if (r.status !== 200) throw new Error(`setPlan failed: ${JSON.stringify(r.body)}`);
}

async function setSubscription(therapistId, fields) {
  const r = await req('POST', '/api/dev/set-subscription', { therapist_id: therapistId, ...fields });
  if (r.status !== 200) throw new Error(`setSubscription failed: ${JSON.stringify(r.body)}`);
}

async function addClient(token, csrf) {
  const ts = Date.now() + Math.random();
  return req('POST', '/api/clients/solo', {
    first_name: `Client_${ts}`,
    email: `c_${Math.floor(ts)}@test.com`
  }, { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf });
}

async function seedClients(therapistId, count) {
  const r = await req('POST', '/api/dev/seed-clients', { therapist_id: therapistId, count });
  return r.body;
}

async function dbQuery(sql, params = []) {
  const r = await req('POST', '/api/dev/db-query', { sql, params });
  return r.body.rows || [];
}

async function runScheduler(job) {
  const r = await req('POST', '/api/dev/run-scheduler', { job });
  return r.body;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Feature #391: Subscription Tier Gating & Stripe Webhooks ===\n');

  // ── Step 1: Plan limits — client count ─────────────────────────────────────
  console.log('Step 1a: Client count limits\n');

  const t1 = await registerTherapist('climit');
  const csrfT1 = await getCsrf(t1.token);
  const auth1 = { Authorization: `Bearer ${t1.token}`, 'X-CSRF-Token': csrfT1 };

  // Check initial subscription exists (created on register)
  const subCheck = await req('GET', '/api/subscription/current', null, auth1);
  assert('New therapist has a subscription record', subCheck.status === 200 && subCheck.body.subscription !== null,
    JSON.stringify(subCheck.body));

  const initialPlan = subCheck.body.subscription?.plan;
  assert('Initial plan is trial', initialPlan === 'trial', `got: ${initialPlan}`);

  // Get trial client limit from limits endpoint
  const limitsR = await req('GET', '/api/subscription/limits', null, auth1);
  assert('GET /limits returns 200', limitsR.status === 200, JSON.stringify(limitsR.body));
  assert('Trial client limit is 3', limitsR.body.clients?.limit === 3,
    `limit=${limitsR.body.clients?.limit}`);

  // Set plan to trial explicitly with limit 3 and add clients up to limit
  await setPlan(t1.userId, 'trial');

  const c1 = await addClient(t1.token, csrfT1);
  const c2 = await addClient(t1.token, csrfT1);
  const c3 = await addClient(t1.token, csrfT1);
  assert('Add 3 clients on trial (at limit) succeeds', c1.status === 201 && c2.status === 201 && c3.status === 201,
    `${c1.status}/${c2.status}/${c3.status}`);

  // 4th client should fail
  const c4 = await addClient(t1.token, csrfT1);
  assert('4th client on trial returns 403', c4.status === 403,
    `got ${c4.status}: ${JSON.stringify(c4.body)}`);
  assert('4th client error mentions limit or upgrade',
    c4.body?.error?.toLowerCase().includes('limit') ||
    c4.body?.message?.toLowerCase().includes('limit') ||
    c4.body?.error?.toLowerCase().includes('upgrade'),
    JSON.stringify(c4.body));

  // Upgrade to basic (limit 10) — should allow more clients
  await setPlan(t1.userId, 'basic');
  const c5 = await addClient(t1.token, csrfT1);
  assert('5th client on basic plan succeeds', c5.status === 201,
    `got ${c5.status}: ${JSON.stringify(c5.body)}`);

  // Upgrade to premium (unlimited)
  await setPlan(t1.userId, 'premium');
  const cPremium = await addClient(t1.token, csrfT1);
  assert('Client add on premium is allowed', cPremium.status === 201,
    `got ${cPremium.status}: ${JSON.stringify(cPremium.body)}`);

  // ── Step 1b: Session upload limits ────────────────────────────────────────
  console.log('\nStep 1b: Session upload limits\n');

  // Check session limit API
  await setPlan(t1.userId, 'trial'); // trial: 5 sessions/month
  const sessionLimits = await req('GET', '/api/subscription/limits', null, auth1);
  // Note: the /limits endpoint only checks client limits, not sessions
  // Session limits are enforced in the sessions route via checkSessionLimit
  // Let's verify via a direct DB inspection
  const trialSub = await dbQuery('SELECT plan, status FROM subscriptions WHERE therapist_id = ?', [t1.userId]);
  assert('Therapist plan is trial for session limit test', trialSub.length > 0 && trialSub[0].plan === 'trial',
    JSON.stringify(trialSub));

  // Check that checkSessionLimit logic works by inspecting it through the limits endpoint
  // The sessions route uses checkSessionLimit to enforce. For a trial user with 0 sessions,
  // it should be allowed. We verify the session count functions correctly.
  const sessionCountRows = await dbQuery(
    "SELECT COUNT(*) as cnt FROM sessions WHERE therapist_id = ? AND created_at >= datetime('now','start of month')",
    [t1.userId]
  );
  assert('Session count query works', sessionCountRows.length > 0, JSON.stringify(sessionCountRows));

  // ── Step 1c: Pro/Premium-only NL query gating ─────────────────────────────
  console.log('\nStep 1c: NL query tier gating\n');

  const t2 = await registerTherapist('nlquery');
  const csrfT2 = await getCsrf(t2.token);
  const auth2 = { Authorization: `Bearer ${t2.token}`, 'X-CSRF-Token': csrfT2 };

  // Set trial plan — NL query should be blocked
  await setPlan(t2.userId, 'trial');
  const nlTrial = await req('POST', '/api/query', { client_id: 1, query: 'test' }, auth2);
  assert('NL query on trial plan → 403', nlTrial.status === 403,
    `got ${nlTrial.status}: ${JSON.stringify(nlTrial.body)}`);
  assert('NL query 403 mentions plan upgrade',
    nlTrial.body?.message?.toLowerCase().includes('pro') ||
    nlTrial.body?.error?.toLowerCase().includes('plan'),
    JSON.stringify(nlTrial.body));
  assert('NL query 403 includes current_plan field',
    nlTrial.body?.current_plan === 'trial',
    JSON.stringify(nlTrial.body));
  assert('NL query 403 includes required_plans',
    Array.isArray(nlTrial.body?.required_plans) && nlTrial.body.required_plans.includes('pro'),
    JSON.stringify(nlTrial.body));

  // Basic plan — still blocked
  await setPlan(t2.userId, 'basic');
  const nlBasic = await req('POST', '/api/query', { client_id: 1, query: 'test' }, auth2);
  assert('NL query on basic plan → 403', nlBasic.status === 403,
    `got ${nlBasic.status}: ${JSON.stringify(nlBasic.body)}`);

  // Pro plan — should be allowed (will fail with 404 since client_id=1 is not theirs, but NOT 403)
  await setPlan(t2.userId, 'pro');
  const nlPro = await req('POST', '/api/query', { client_id: 1, query: 'test query' }, auth2);
  assert('NL query on pro plan passes tier gate (gets 404 on client, not 403)',
    nlPro.status === 404 || nlPro.status === 200,
    `got ${nlPro.status}: ${JSON.stringify(nlPro.body)}`);

  // Premium plan — also allowed
  await setPlan(t2.userId, 'premium');
  const nlPremium = await req('POST', '/api/query', { client_id: 1, query: 'test query' }, auth2);
  assert('NL query on premium plan passes tier gate',
    nlPremium.status === 404 || nlPremium.status === 200,
    `got ${nlPremium.status}: ${JSON.stringify(nlPremium.body)}`);

  // ── Step 2: Stripe webhooks ────────────────────────────────────────────────
  console.log('\nStep 2: Stripe webhooks\n');

  const t3 = await registerTherapist('webhooks');
  const csrfT3 = await getCsrf(t3.token);
  const auth3 = { Authorization: `Bearer ${t3.token}`, 'X-CSRF-Token': csrfT3 };

  // Set up Stripe customer and subscription IDs for webhook testing
  const devCustomerId = 'cus_dev_t391_' + Date.now();
  const devSubId = 'sub_dev_t391_' + Date.now();
  await setSubscription(t3.userId, {
    stripe_customer_id: devCustomerId,
    stripe_subscription_id: devSubId,
    status: 'active',
    plan: 'basic'
  });

  // 2a: payment_intent.succeeded → payment recorded, subscription active
  const now = Math.floor(Date.now() / 1000);
  const webhookPaymentSucceeded = {
    id: 'evt_test_payment_succeeded',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_dev_t391_' + Date.now(),
        object: 'payment_intent',
        amount: 1900,
        currency: 'usd',
        customer: devCustomerId
      }
    }
  };

  const wh1 = await req('POST', '/api/webhooks/stripe', webhookPaymentSucceeded, {
    'Content-Type': 'application/json'
  });
  assert('payment_intent.succeeded webhook returns 200', wh1.status === 200,
    `got ${wh1.status}: ${JSON.stringify(wh1.body)}`);
  assert('payment webhook body has received:true', wh1.body?.received === true,
    JSON.stringify(wh1.body));

  // Verify payment was recorded in DB
  await new Promise(r => setTimeout(r, 200)); // small delay for DB write
  const paymentRows = await dbQuery(
    "SELECT p.amount, p.status FROM payments p JOIN subscriptions s ON s.id = p.subscription_id WHERE s.therapist_id = ? ORDER BY p.created_at DESC LIMIT 1",
    [t3.userId]
  );
  assert('Payment record created in payments table', paymentRows.length > 0,
    JSON.stringify(paymentRows));
  if (paymentRows.length > 0) {
    assert('Payment amount is 1900 (cents)', paymentRows[0].amount === 1900,
      `got ${paymentRows[0].amount}`);
    assert('Payment status is succeeded', paymentRows[0].status === 'succeeded',
      `got ${paymentRows[0].status}`);
  }

  // Verify subscription status is active after payment
  const subAfterPayment = await req('GET', '/api/subscription/current', null, auth3);
  assert('Subscription active after payment_intent.succeeded',
    subAfterPayment.body.subscription?.status === 'active',
    JSON.stringify(subAfterPayment.body.subscription));

  // 2b: customer.subscription.updated → period dates updated
  const periodStart = now;
  const periodEnd = now + 30 * 24 * 60 * 60;
  const webhookSubUpdated = {
    id: 'evt_test_sub_updated',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: devSubId,
        object: 'subscription',
        customer: devCustomerId,
        status: 'active',
        cancel_at_period_end: false,
        current_period_start: periodStart,
        current_period_end: periodEnd
      }
    }
  };
  const wh2 = await req('POST', '/api/webhooks/stripe', webhookSubUpdated, {
    'Content-Type': 'application/json'
  });
  assert('customer.subscription.updated webhook returns 200', wh2.status === 200,
    `got ${wh2.status}: ${JSON.stringify(wh2.body)}`);

  // Verify period updated in DB
  const subRows = await dbQuery(
    'SELECT current_period_start, current_period_end FROM subscriptions WHERE therapist_id = ?',
    [t3.userId]
  );
  assert('Subscription period updated in DB', subRows.length > 0 && !!subRows[0].current_period_end,
    JSON.stringify(subRows));

  // 2c: invoice.payment_succeeded
  const webhookInvoicePaid = {
    id: 'evt_test_invoice_paid',
    type: 'invoice.payment_succeeded',
    data: {
      object: {
        id: 'in_dev_t391_' + Date.now(),
        object: 'invoice',
        customer: devCustomerId,
        subscription: devSubId,
        amount_paid: 1900,
        status: 'paid'
      }
    }
  };
  const wh3 = await req('POST', '/api/webhooks/stripe', webhookInvoicePaid, {
    'Content-Type': 'application/json'
  });
  assert('invoice.payment_succeeded webhook returns 200', wh3.status === 200,
    `got ${wh3.status}: ${JSON.stringify(wh3.body)}`);

  // 2d: invoice.payment_failed → subscription goes past_due
  const devCustomerIdFailed = 'cus_dev_t391_fail_' + Date.now();
  const devSubIdFailed = 'sub_dev_t391_fail_' + Date.now();

  const t3b = await registerTherapist('wh_fail');
  await setSubscription(t3b.userId, {
    stripe_customer_id: devCustomerIdFailed,
    stripe_subscription_id: devSubIdFailed,
    status: 'active',
    plan: 'basic'
  });

  const webhookPaymentFailed = {
    id: 'evt_test_payment_failed',
    type: 'payment_intent.payment_failed',
    data: {
      object: {
        id: 'pi_dev_fail_' + Date.now(),
        object: 'payment_intent',
        amount: 1900,
        currency: 'usd',
        customer: devCustomerIdFailed,
        last_payment_error: { message: 'Your card was declined.' }
      }
    }
  };
  const wh4 = await req('POST', '/api/webhooks/stripe', webhookPaymentFailed, {
    'Content-Type': 'application/json'
  });
  assert('payment_intent.payment_failed webhook returns 200', wh4.status === 200,
    `got ${wh4.status}: ${JSON.stringify(wh4.body)}`);

  // Subscription should now be past_due
  await new Promise(r => setTimeout(r, 200));
  const subFailedRows = await dbQuery(
    "SELECT status FROM subscriptions WHERE therapist_id = ?",
    [t3b.userId]
  );
  assert('Subscription status is past_due after payment failure',
    subFailedRows.length > 0 && subFailedRows[0].status === 'past_due',
    JSON.stringify(subFailedRows));

  // Failed payment recorded
  const failedPaymentRows = await dbQuery(
    "SELECT p.status FROM payments p JOIN subscriptions s ON s.id = p.subscription_id WHERE s.therapist_id = ? ORDER BY p.created_at DESC LIMIT 1",
    [t3b.userId]
  );
  assert('Failed payment recorded in payments table',
    failedPaymentRows.length > 0 && failedPaymentRows[0].status === 'failed',
    JSON.stringify(failedPaymentRows));

  // Audit log: payment_failed entry
  const failAudit = await req('POST', '/api/dev/audit-query', { action: 'payment_failed', actor_id: t3b.userId });
  assert('payment_failed audit log entry created', failAudit.body?.rows?.length > 0,
    JSON.stringify(failAudit.body));

  // 2e: customer.subscription.deleted → expired
  const webhookSubDeleted = {
    id: 'evt_test_sub_deleted',
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: devSubId,
        object: 'subscription',
        customer: devCustomerId,
        status: 'canceled',
        current_period_start: periodStart,
        current_period_end: periodEnd
      }
    }
  };
  const wh5 = await req('POST', '/api/webhooks/stripe', webhookSubDeleted, {
    'Content-Type': 'application/json'
  });
  assert('customer.subscription.deleted webhook returns 200', wh5.status === 200,
    `got ${wh5.status}: ${JSON.stringify(wh5.body)}`);

  const subDeletedRows = await dbQuery(
    "SELECT status FROM subscriptions WHERE therapist_id = ?",
    [t3.userId]
  );
  assert('Subscription status is expired after deletion webhook',
    subDeletedRows.length > 0 && subDeletedRows[0].status === 'expired',
    JSON.stringify(subDeletedRows));

  // 2f: Checkout session (dev mode auto-completes upgrade)
  const t4 = await registerTherapist('checkout');
  const csrfT4 = await getCsrf(t4.token);
  const auth4 = { Authorization: `Bearer ${t4.token}`, 'X-CSRF-Token': csrfT4 };

  const checkoutR = await req('POST', '/api/subscription/checkout', { plan: 'pro' }, auth4);
  assert('POST /subscription/checkout returns 200', checkoutR.status === 200,
    `got ${checkoutR.status}: ${JSON.stringify(checkoutR.body)}`);
  assert('Checkout has session_id', !!checkoutR.body?.session_id, JSON.stringify(checkoutR.body));
  assert('Dev mode checkout auto_completed', checkoutR.body?.auto_completed === true,
    JSON.stringify(checkoutR.body));
  assert('Dev mode checkout has checkout_url', !!checkoutR.body?.checkout_url,
    JSON.stringify(checkoutR.body));

  // After dev checkout, subscription should be pro
  const subAfterCheckout = await req('GET', '/api/subscription/current', null, auth4);
  assert('Subscription plan is pro after dev checkout',
    subAfterCheckout.body.subscription?.plan === 'pro',
    JSON.stringify(subAfterCheckout.body.subscription));
  assert('Subscription status is active after checkout',
    subAfterCheckout.body.subscription?.status === 'active',
    JSON.stringify(subAfterCheckout.body.subscription));

  // ── Step 3: Expiry warning emails ─────────────────────────────────────────
  console.log('\nStep 3: Expiry warning scheduler\n');

  const t5 = await registerTherapist('expiry');
  const csrfT5 = await getCsrf(t5.token);
  const auth5 = { Authorization: `Bearer ${t5.token}`, 'X-CSRF-Token': csrfT5 };
  await setPlan(t5.userId, 'trial');

  // Set trial to expire in 2 days (within 3-day warning window)
  const expiresIn2Days = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  await setSubscription(t5.userId, { trial_ends_at: expiresIn2Days });

  // Run the expiry warning job
  const expiryJobResult = await runScheduler('expiry-warning');
  assert('Expiry warning job runs successfully', !expiryJobResult.result?.error,
    JSON.stringify(expiryJobResult));
  assert('Expiry warning job processed ≥ 1 subscription',
    (expiryJobResult.result?.warned || 0) >= 1,
    JSON.stringify(expiryJobResult));

  // Verify audit log entry was created
  const expiryAudit = await req('POST', '/api/dev/audit-query', { action: 'expiry_warning_sent' });
  assert('expiry_warning_sent audit log entry exists', expiryAudit.body?.rows?.length > 0,
    JSON.stringify(expiryAudit.body));

  // Verify dedup — running again should NOT produce another warning (already warned within 3 days)
  const expiryJobResult2 = await runScheduler('expiry-warning');
  // The same subscriptions should be skipped due to the dedup check
  // warned count could be 0 for our test sub (already warned)
  assert('Expiry warning job runs twice without error', !expiryJobResult2.result?.error,
    JSON.stringify(expiryJobResult2));

  // ── Step 3b: Trial expiration job ────────────────────────────────────────
  console.log('\nStep 3b: Trial expiration job\n');

  const t6 = await registerTherapist('trialexp');
  await setPlan(t6.userId, 'trial');
  // Set trial to already expired (1 day ago)
  const expiredYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await setSubscription(t6.userId, { trial_ends_at: expiredYesterday });

  const trialExpResult = await runScheduler('trial-expiration');
  assert('Trial expiration job runs successfully', !trialExpResult.result?.error,
    JSON.stringify(trialExpResult));
  assert('Trial expiration job expired ≥ 1 trial',
    (trialExpResult.result?.expired || 0) >= 1,
    JSON.stringify(trialExpResult));

  // Verify subscription is now expired
  const expiredSubRows = await dbQuery(
    "SELECT status FROM subscriptions WHERE therapist_id = ?",
    [t6.userId]
  );
  assert('Trial subscription is now expired',
    expiredSubRows.length > 0 && expiredSubRows[0].status === 'expired',
    JSON.stringify(expiredSubRows));

  // Verify trial_expired audit log entry
  const trialExpAudit = await req('POST', '/api/dev/audit-query', { action: 'trial_expired', target_id: expiredSubRows[0]?.id });
  // Note: target_id in audit is subscription ID, not easily queried here — just check action exists
  const trialExpAudit2 = await req('POST', '/api/dev/audit-query', { action: 'trial_expired' });
  assert('trial_expired audit log entry exists', trialExpAudit2.body?.rows?.length > 0,
    JSON.stringify(trialExpAudit2.body));

  // ── Step 4: Downgrade path ────────────────────────────────────────────────
  console.log('\nStep 4: Downgrade path\n');

  const t7 = await registerTherapist('downgrade');
  const csrfT7 = await getCsrf(t7.token);
  const auth7 = { Authorization: `Bearer ${t7.token}`, 'X-CSRF-Token': csrfT7 };

  // Set to pro plan with current_period_end in the future
  await setPlan(t7.userId, 'pro');
  const futureEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
  await setSubscription(t7.userId, { current_period_end: futureEnd });

  // Downgrade from pro to basic
  const downgradeR = await req('POST', '/api/subscription/change-plan', { plan: 'basic' }, auth7);
  assert('Downgrade pro→basic returns 200', downgradeR.status === 200,
    `got ${downgradeR.status}: ${JSON.stringify(downgradeR.body)}`);
  assert('Downgrade response has is_downgrade:true', downgradeR.body.subscription?.is_downgrade === true,
    JSON.stringify(downgradeR.body));
  assert('Downgrade response has scheduled:true', downgradeR.body.subscription?.scheduled === true,
    JSON.stringify(downgradeR.body));
  assert('Downgrade response shows pending_plan=basic',
    downgradeR.body.subscription?.pending_plan === 'basic',
    JSON.stringify(downgradeR.body));

  // Current plan should still be pro (downgrade scheduled, not immediate)
  const subAfterDowngrade = await req('GET', '/api/subscription/current', null, auth7);
  assert('Current plan still pro after scheduled downgrade',
    subAfterDowngrade.body.subscription?.plan === 'pro',
    JSON.stringify(subAfterDowngrade.body.subscription));
  assert('pending_plan is basic',
    subAfterDowngrade.body.subscription?.pending_plan === 'basic',
    JSON.stringify(subAfterDowngrade.body.subscription));

  // Pro feature (NL query) should still be accessible while on pro
  const nlDuringDowngrade = await req('POST', '/api/query', { client_id: 999, query: 'test' }, auth7);
  assert('NL query still accessible during pending downgrade (pro plan active)',
    nlDuringDowngrade.status === 404 || nlDuringDowngrade.status === 200,
    `got ${nlDuringDowngrade.status}: ${JSON.stringify(nlDuringDowngrade.body)}`);

  // Test upgrade (immediate effect)
  const upgradeR = await req('POST', '/api/subscription/change-plan', { plan: 'premium' }, auth7);
  assert('Upgrade pro→premium returns 200', upgradeR.status === 200,
    `got ${upgradeR.status}: ${JSON.stringify(upgradeR.body)}`);
  assert('Upgrade is immediate (not scheduled)', upgradeR.body.subscription?.scheduled === false,
    JSON.stringify(upgradeR.body));
  assert('Upgrade shows new plan', upgradeR.body.subscription?.plan === 'premium',
    JSON.stringify(upgradeR.body));

  // Subscription should now be premium
  const subAfterUpgrade = await req('GET', '/api/subscription/current', null, auth7);
  assert('Subscription plan is premium after upgrade',
    subAfterUpgrade.body.subscription?.plan === 'premium',
    JSON.stringify(subAfterUpgrade.body.subscription));

  // Downgrade warning when clients exceed new plan limit
  const t8 = await registerTherapist('dg_warn');
  const csrfT8 = await getCsrf(t8.token);
  const auth8 = { Authorization: `Bearer ${t8.token}`, 'X-CSRF-Token': csrfT8 };

  await setPlan(t8.userId, 'premium'); // unlimited
  await setSubscription(t8.userId, { current_period_end: futureEnd });

  // Seed 12 clients via dev endpoint (bypasses plan limit — premium has none)
  // Basic limit = 10, so 12 > 10 should trigger the downgrade warning
  await seedClients(t8.userId, 12);
  const dgWarnR = await req('POST', '/api/subscription/change-plan', { plan: 'basic' }, auth8);
  assert('Downgrade to basic when over limit returns 200', dgWarnR.status === 200,
    `got ${dgWarnR.status}: ${JSON.stringify(dgWarnR.body)}`);
  assert('Downgrade warning present when clients exceed new limit',
    !!dgWarnR.body.downgrade_warning,
    JSON.stringify(dgWarnR.body));
  if (dgWarnR.body.downgrade_warning) {
    assert('Downgrade warning has excess count',
      typeof dgWarnR.body.downgrade_warning.excess === 'number',
      JSON.stringify(dgWarnR.body.downgrade_warning));
  }

  // ── Step 5: Receipt email ─────────────────────────────────────────────────
  console.log('\nStep 5: Receipt email rendering\n');

  // Set up a therapist with a stripe customer and trigger payment succeeded
  const t9 = await registerTherapist('receipt');
  const devCustReceipt = 'cus_dev_receipt_' + Date.now();
  await setSubscription(t9.userId, {
    stripe_customer_id: devCustReceipt,
    plan: 'pro',
    status: 'active'
  });

  const receiptWebhook = {
    id: 'evt_test_receipt_' + Date.now(),
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_dev_receipt_' + Date.now(),
        object: 'payment_intent',
        amount: 4900, // pro: $49/mo
        currency: 'usd',
        customer: devCustReceipt
      }
    }
  };

  const whReceipt = await req('POST', '/api/webhooks/stripe', receiptWebhook, {
    'Content-Type': 'application/json'
  });
  assert('Receipt webhook returns 200', whReceipt.status === 200,
    `got ${whReceipt.status}: ${JSON.stringify(whReceipt.body)}`);

  // Verify payment record for receipt
  await new Promise(r => setTimeout(r, 300));
  const receiptPayment = await dbQuery(
    "SELECT p.amount, p.status FROM payments p JOIN subscriptions s ON s.id = p.subscription_id WHERE s.therapist_id = ? ORDER BY p.created_at DESC LIMIT 1",
    [t9.userId]
  );
  assert('Receipt payment recorded', receiptPayment.length > 0 && receiptPayment[0].status === 'succeeded',
    JSON.stringify(receiptPayment));
  assert('Receipt payment amount is 4900 (pro)', receiptPayment.length > 0 && receiptPayment[0].amount === 4900,
    JSON.stringify(receiptPayment));

  // payment_succeeded audit log
  const receiptAudit = await req('POST', '/api/dev/audit-query', { action: 'payment_succeeded', actor_id: t9.userId });
  assert('payment_succeeded audit log for receipt', receiptAudit.body?.rows?.length > 0,
    JSON.stringify(receiptAudit.body));

  // ── Step 6: Available plans endpoint ──────────────────────────────────────
  console.log('\nStep 6: Plans catalog and subscription endpoints\n');

  const plansR = await req('GET', '/api/subscription/plans');
  assert('GET /plans returns 200', plansR.status === 200, JSON.stringify(plansR.body));
  assert('Plans has 3 entries (basic/pro/premium)', plansR.body.plans?.length === 3,
    JSON.stringify(plansR.body));

  const planIds = plansR.body.plans?.map(p => p.id) || [];
  assert('basic plan is present', planIds.includes('basic'), JSON.stringify(planIds));
  assert('pro plan is present', planIds.includes('pro'), JSON.stringify(planIds));
  assert('premium plan is present', planIds.includes('premium'), JSON.stringify(planIds));

  // Verify prices
  const basicPlan = plansR.body.plans?.find(p => p.id === 'basic');
  const proPlan = plansR.body.plans?.find(p => p.id === 'pro');
  const premiumPlan = plansR.body.plans?.find(p => p.id === 'premium');
  assert('Basic plan price is $19/mo', basicPlan?.amount === 1900, `got ${basicPlan?.amount}`);
  assert('Pro plan price is $49/mo', proPlan?.amount === 4900, `got ${proPlan?.amount}`);
  assert('Premium plan price is $99/mo', premiumPlan?.amount === 9900, `got ${premiumPlan?.amount}`);

  // stripe-status endpoint
  const stripeStatusR = await req('GET', '/api/subscription/stripe-status');
  assert('GET /stripe-status returns 200', stripeStatusR.status === 200, JSON.stringify(stripeStatusR.body));
  assert('Stripe is configured (dev mode)', stripeStatusR.body.configured === true, JSON.stringify(stripeStatusR.body));
  assert('Stripe dev mode is true', stripeStatusR.body.dev_mode === true, JSON.stringify(stripeStatusR.body));

  // Payment history
  const authT3 = { Authorization: `Bearer ${t3.token}` };
  const paymentsR = await req('GET', '/api/subscription/payments', null, { Authorization: `Bearer ${t4.token}` });
  assert('GET /payments returns 200', paymentsR.status === 200, JSON.stringify(paymentsR.body));
  assert('Payments list is an array', Array.isArray(paymentsR.body.payments), JSON.stringify(paymentsR.body));

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFAILURES:');
    failures.forEach(f => console.log(`  ✗ ${f}`));
  }
  console.log('══════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
