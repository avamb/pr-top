'use strict';
// Ported from the wave-2 track G scratch suite (no network; Stripe stubbed).
const path = require('path');
const fs = require('fs');
const http = require('http');
const { setupEnv, check, run, dep, src } = require('./helpers/checks');
setupEnv('billing');
const express = dep('express');
const jwt = dep('jsonwebtoken');

function call(server, method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const r = http.request({
      host: '127.0.0.1', port: server.address().port, method, path: url,
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...headers }
    }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => { let j = null; try { j = JSON.parse(chunks); } catch (e) {} resolve({ status: res.statusCode, body: j, raw: chunks }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

run('plan gates, access helper, webhook idempotency, pending_plan (wave 2 track G)', async () => {
  const conn = src('db/connection');
  await conn.initDatabase();
  // Second boot: a fresh DB needs it for the pre-existing T-409 'confirm'
  // rebuild (fails on first boot), and it proves the new migration is idempotent.
  await conn.initDatabase();
  const db = conn.getDatabase();

  // ---------------------------------------------------------------- schema
  console.log('Schema');
  const t = db.exec("SELECT sql FROM sqlite_master WHERE name = 'stripe_webhook_events'");
  check('stripe_webhook_events exists', t.length && /event_id TEXT PRIMARY KEY/.test(t[0].values[0][0]));

  // ---------------------------------------------------------------- helper
  console.log('getEffectiveSubscriptionAccess');
  const planLimits = src('utils/planLimits');
  const { getEffectiveSubscriptionAccess: acc } = planLimits;
  const now = new Date('2026-11-02T12:00:00Z');
  const past = '2026-11-01T00:00:00.000Z', future = '2026-12-01T00:00:00.000Z';
  const cases = [
    ['null row', null, false, 'trial'],
    ['active pro', { plan: 'pro', status: 'active' }, true, 'pro'],
    ['legacy trial active, trial over', { plan: 'trial', status: 'active', trial_ends_at: past }, false, 'trial'],
    ['legacy trial active, running', { plan: 'trial', status: 'active', trial_ends_at: future }, true, 'trial'],
    ['trialing before end', { plan: 'basic', status: 'trialing', trial_ends_at: future }, true, 'basic'],
    ['trialing after end', { plan: 'basic', status: 'trialing', trial_ends_at: past }, false, 'trial'],
    ['trialing after end, Stripe-backed', { plan: 'basic', status: 'trialing', trial_ends_at: past, stripe_subscription_id: 'sub_1' }, true, 'basic'],
    ['canceled in grace', { plan: 'pro', status: 'canceled', current_period_end: future }, true, 'pro'],
    ['canceled after end', { plan: 'pro', status: 'canceled', current_period_end: past }, false, 'trial'],
    ['canceled no end', { plan: 'pro', status: 'canceled' }, false, 'trial'],
    ['past_due', { plan: 'premium', status: 'past_due' }, true, 'premium'],
    ['expired', { plan: 'pro', status: 'expired' }, false, 'trial'],
    ['unknown status', { plan: 'pro', status: 'weird' }, false, 'trial'],
    ['sqlite datetime format', { plan: 'pro', status: 'canceled', current_period_end: '2026-11-03 10:00:00' }, true, 'pro'],
    ['pending, period running', { plan: 'pro', status: 'active', pending_plan: 'basic', current_period_end: future }, true, 'pro'],
    ['pending, period ended', { plan: 'pro', status: 'active', pending_plan: 'basic', current_period_end: past }, true, 'basic']
  ];
  for (const [name, row, usable, plan] of cases) {
    const r = acc(row, now);
    check(name, r.usable === usable && r.plan === plan, r);
  }

  // ---------------------------------------------------------------- M11 limits
  console.log('Plan limits (M11)');
  check('confirm session limit is 0 (setting "0")', planLimits.getSessionLimit('confirm') === 0, planLimits.getSessionLimit('confirm'));
  db.run("DELETE FROM platform_settings WHERE key = 'confirm_session_limit'");
  check('confirm session limit default 0 (no setting)', planLimits.getSessionLimit('confirm') === 0);
  check('unknown plan falls back to trial', planLimits.getSessionLimit('nope') === 5 && planLimits.getClientLimit('nope') === 3);
  check('premium unlimited', planLimits.getSessionLimit('premium') === Infinity);

  // ---------------------------------------------------------------- fixtures
  let nextId = 1000;
  function mkTherapist(sub) {
    const id = ++nextId;
    db.run("INSERT INTO users (id, email, password_hash, role, email_verified_at, created_at) VALUES (?, ?, 'x', 'therapist', datetime('now'), datetime('now'))",
      [id, `t${id}@example.test`]);
    if (sub) {
      db.run(`INSERT INTO subscriptions (therapist_id, plan, status, trial_ends_at, current_period_start, current_period_end,
              stripe_customer_id, stripe_subscription_id, pending_plan, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [id, sub.plan, sub.status, sub.trial_ends_at || null, sub.current_period_start || null, sub.current_period_end || null,
          sub.stripe_customer_id || null, sub.stripe_subscription_id || null, sub.pending_plan || null]);
    }
    return id;
  }
  const realFuture = new Date(Date.now() + 10 * 86400000).toISOString();
  const realPast = new Date(Date.now() - 86400000).toISOString();
  const token = (id) => jwt.sign({ userId: id, role: 'therapist' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const sub = (id) => {
    const r = db.exec('SELECT plan, status, pending_plan, current_period_end FROM subscriptions WHERE therapist_id = ?', [id]);
    const [plan, status, pending_plan, current_period_end] = r[0].values[0];
    return { plan, status, pending_plan, current_period_end };
  };

  console.log('Gates via planLimits');
  const tGrace = mkTherapist({ plan: 'pro', status: 'canceled', current_period_end: realFuture });
  const tEnded = mkTherapist({ plan: 'pro', status: 'canceled', current_period_end: realPast });
  const tPastDue = mkTherapist({ plan: 'basic', status: 'past_due' });
  const tConfirm = mkTherapist({ plan: 'confirm', status: 'active' });
  const tExpired = mkTherapist({ plan: 'pro', status: 'expired' });
  check('client limit: canceled-in-grace allowed', planLimits.checkClientLimit(tGrace).allowed === true && planLimits.checkClientLimit(tGrace).plan === 'pro');
  check('client limit: canceled-ended blocked, plan null', planLimits.checkClientLimit(tEnded).allowed === false && planLimits.checkClientLimit(tEnded).plan === null);
  check('client limit: past_due allowed', planLimits.checkClientLimit(tPastDue).allowed === true);
  check('session limit: confirm blocked (0)', planLimits.checkSessionLimit(tConfirm).allowed === false && planLimits.checkSessionLimit(tConfirm).limit === 0, planLimits.checkSessionLimit(tConfirm));
  check('reminders: canceled-in-grace yes', planLimits.canUseSessionReminders(tGrace) === true);
  check('reminders: expired no', planLimits.canUseSessionReminders(tExpired) === false);
  check('access for therapist: no row', planLimits.getSubscriptionAccessForTherapist(999999).subscription === null);


  check('helper: Stripe-backed pending, period ended -> keeps paid plan (webhook decides)',
    acc({ plan: 'pro', status: 'active', pending_plan: 'basic', current_period_end: past, stripe_subscription_id: 'sub_z' }, now).plan === 'pro');

  // ---------------------------------------------------------------- fake Stripe
  // Real services/stripe.js with a fake API key; every API method the code
  // uses is replaced, and the raw request sender is blocked (no network).
  const stripeSvc = src('services/stripe');

  console.log('Reconciliation in dev mode');
  delete process.env.STRIPE_SECRET_KEY;
  stripeSvc.initStripe();
  const devRec = await stripeSvc.reconcilePendingDowngrades();
  check('reconcile skipped in dev mode', devRec.skipped === true, devRec);

  for (const p of ['trial', 'confirm', 'basic', 'pro', 'premium']) process.env['STRIPE_PRICE_' + p.toUpperCase()] = 'price_' + p;
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_tests_only';
  stripeSvc.initStripe();
  const client = stripeSvc.getStripeClient();
  let networkAttempted = false;
  client._requestSender._request = function () {
    networkAttempted = true;
    const cb = arguments[arguments.length - 1];
    if (typeof cb === 'function') cb(new Error('network blocked in test'));
  };
  const fake = { subs: {}, calls: [], updateMode: 'ok', retrieveMode: 'ok', updateDelayMs: 0 };
  const priceOf = (plan) => ({ id: 'price_' + plan, lookup_key: `prtop_${plan}_monthly`, unit_amount: 100, currency: 'usd' });
  const nowS = Math.floor(Date.now() / 1000);
  function fakeSub(id, plan, extra = {}) {
    fake.subs[id] = {
      id, status: 'active', cancel_at_period_end: false, metadata: { plan },
      current_period_start: nowS - 5 * 86400, current_period_end: nowS + 25 * 86400,
      items: { data: [{ id: 'si_' + id, price: priceOf(plan) }] }, ...extra
    };
    return fake.subs[id];
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const missing = () => Object.assign(new Error('No such subscription'), { code: 'resource_missing' });
  client.subscriptions.retrieve = async (id) => {
    if (fake.retrieveMode === 'fail') throw new Error('stripe down (retrieve)');
    if (!fake.subs[id]) throw missing();
    return clone(fake.subs[id]);
  };
  client.subscriptions.update = async (id, params, opts) => {
    fake.calls.push({ id, params: clone(params), opts: opts ? clone(opts) : null });
    if (fake.updateDelayMs) await new Promise(r => setTimeout(r, fake.updateDelayMs));
    if (fake.updateMode === 'fail') throw new Error('stripe down (update)');
    const s = fake.subs[id];
    if (!s) throw missing();
    if (params.items) {
      const plan = params.items[0].price.replace('price_', '');
      s.items.data[0].price = priceOf(plan);
    }
    if (params.metadata) s.metadata = params.metadata;
    if (params.cancel_at_period_end !== undefined) s.cancel_at_period_end = params.cancel_at_period_end;
    if (fake.updateMode === 'lost') throw new Error('socket hang up (applied)');
    return clone(s);
  };
  const updatesTo = () => fake.calls.filter(c => c.params.items).map(c => c.params.items[0].price.replace('price_', ''));

  // ---------------------------------------------------------------- HTTP app
  console.log('HTTP gates (export / query / kb)');
  const app = express();
  app.use('/api/webhooks', src('routes/webhooks'));
  app.use(express.json());
  app.use('/api/subscription', src('routes/subscription'));
  app.use('/api/export', src('routes/export'));
  app.use('/api/query', src('routes/query'));
  app.use('/api/kb', src('routes/kb'));
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const auth = (id) => ({ Authorization: 'Bearer ' + token(id) });

  let r = await call(server, 'POST', '/api/query', {}, auth(tGrace));
  check('query: canceled-in-grace Pro passes tier gate (400 validation)', r.status === 400 && /client_id/.test(r.body.error), r);
  r = await call(server, 'POST', '/api/query', {}, auth(tEnded));
  check('query: canceled-ended blocked 403', r.status === 403 && r.body.error === 'Subscription inactive', r);
  r = await call(server, 'GET', '/api/kb', undefined, auth(tGrace));
  check('kb: canceled-in-grace Pro allowed', r.status === 200, r.status);
  r = await call(server, 'GET', '/api/kb', undefined, auth(tPastDue));
  check('kb: past_due Basic -> plan gate 403', r.status === 403 && r.body.error === 'Plan upgrade required', r);
  r = await call(server, 'GET', '/api/kb', undefined, auth(tExpired));
  check('kb: expired -> inactive 403', r.status === 403 && r.body.error === 'Subscription inactive', r);
  r = await call(server, 'GET', '/api/export/analytics?format=csv&days=30', undefined, auth(tGrace));
  check('export analytics: canceled-in-grace Pro -> premium gate (current_plan pro)', r.status === 403 && r.body.current_plan === 'pro', r);
  r = await call(server, 'GET', '/api/export/analytics?format=csv&days=30', undefined, auth(tEnded));
  check('export analytics: ended -> current_plan trial', r.status === 403 && r.body.current_plan === 'trial', r);

  // ---------------------------------------------------------------- webhooks
  console.log('Webhooks (M17)');
  const tW = mkTherapist({ plan: 'basic', status: 'active', stripe_customer_id: 'cus_w', stripe_subscription_id: 'sub_w', current_period_end: realFuture });
  fakeSub('sub_w', 'basic');
  const ev = (id, type, object) => ({ id, type, data: { object } });
  const hook = (e) => call(server, 'POST', '/api/webhooks/stripe', e);
  const countPayments = (pi) => db.exec('SELECT COUNT(*) FROM payments WHERE stripe_payment_intent_id = ?', [pi])[0].values[0][0];
  const pi = { id: 'pi_1', amount: 1900, currency: 'usd', customer: 'cus_w' };
  r = await hook(ev('evt_1', 'payment_intent.succeeded', pi));
  check('first delivery processed', r.status === 200 && !r.body.duplicate, r);
  r = await hook(ev('evt_1', 'payment_intent.succeeded', pi));
  check('redelivery acknowledged as duplicate', r.status === 200 && r.body.duplicate === true, r);
  r = await hook(ev('evt_1b', 'payment_intent.succeeded', pi));
  check('same PI under new event id: no second payment', r.status === 200 && countPayments('pi_1') === 1, countPayments('pi_1'));

  db.run("UPDATE subscriptions SET status = 'past_due' WHERE therapist_id = ?", [tW]);
  db.run('ALTER TABLE audit_logs RENAME TO audit_logs_hidden');
  const pi2 = { id: 'pi_2', amount: 1900, currency: 'usd', customer: 'cus_w' };
  r = await hook(ev('evt_2', 'payment_intent.succeeded', pi2));
  check('handler failure -> 500, rolled back, not recorded', r.status === 500 && countPayments('pi_2') === 0 && sub(tW).status === 'past_due' &&
    db.exec("SELECT COUNT(*) FROM stripe_webhook_events WHERE event_id = 'evt_2'")[0].values[0][0] === 0, r);
  db.run('ALTER TABLE audit_logs_hidden RENAME TO audit_logs');
  r = await hook(ev('evt_2', 'payment_intent.succeeded', pi2));
  check('retry after failure processed', r.status === 200 && countPayments('pi_2') === 1 && sub(tW).status === 'active', [r.body, sub(tW)]);

  // every Stripe status (live object = the status under test)
  let n = 10;
  for (const st of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'canceled']) {
    db.run("UPDATE subscriptions SET status = 'active' WHERE therapist_id = ?", [tW]);
    const live = fakeSub('sub_w', 'basic', { status: st });
    r = await hook(ev('evt_s' + (n++), 'customer.subscription.updated', live));
    check(`status ${st} -> 200 (${sub(tW).status})`, r.status === 200 && ['active', 'trialing', 'canceled', 'past_due', 'expired'].includes(sub(tW).status), r);
  }
  db.run("UPDATE subscriptions SET status = 'active' WHERE therapist_id = ?", [tW]);
  r = await hook(ev('evt_inc', 'customer.subscription.updated', fakeSub('sub_w', 'basic', { status: 'incomplete', cancel_at_period_end: true })));
  check('incomplete + cancel_at_period_end does not become canceled', sub(tW).status === 'active', sub(tW));
  r = await hook('{"id":"evt_bad"}');
  check('malformed event -> 400', r.status === 400, r);

  console.log('Webhooks use the live subscription (review item 1)');
  const tL = mkTherapist({ plan: 'pro', status: 'active', stripe_customer_id: 'cus_l', stripe_subscription_id: 'sub_l', current_period_end: realFuture });
  fakeSub('sub_l', 'pro');
  const staleDowngrade = clone(fake.subs.sub_l); staleDowngrade.items.data[0].price = priceOf('basic');
  r = await hook(ev('evt_l1', 'customer.subscription.updated', staleDowngrade));
  check('stale "downgraded" snapshot ignored: live pro kept', r.status === 200 && sub(tL).plan === 'pro', [r.body, sub(tL)]);
  const staleCancel = { ...clone(fake.subs.sub_l), cancel_at_period_end: true };
  r = await hook(ev('evt_l2', 'customer.subscription.updated', staleCancel));
  check('stale cancel snapshot after resume ignored: stays active', sub(tL).status === 'active', sub(tL));
  const before = sub(tL).current_period_end;
  r = await hook(ev('evt_l3', 'customer.subscription.updated', { ...clone(fake.subs.sub_l), current_period_end: nowS - 40 * 86400, current_period_start: nowS - 70 * 86400 }));
  check('stale period does not move current_period_end backwards', sub(tL).current_period_end === new Date(fake.subs.sub_l.current_period_end * 1000).toISOString(), [before, sub(tL)]);
  fake.retrieveMode = 'fail';
  r = await hook(ev('evt_l4', 'customer.subscription.updated', clone(fake.subs.sub_l)));
  check('live retrieve error -> 500, event not recorded', r.status === 500 &&
    db.exec("SELECT COUNT(*) FROM stripe_webhook_events WHERE event_id = 'evt_l4'")[0].values[0][0] === 0, r);
  fake.retrieveMode = 'ok';
  r = await hook(ev('evt_l4', 'customer.subscription.updated', clone(fake.subs.sub_l)));
  check('retry after retrieve error processed', r.status === 200 && !r.body.duplicate, r);
  const goneSnap = clone(fake.subs.sub_l); delete fake.subs.sub_l;
  r = await hook(ev('evt_l5', 'customer.subscription.updated', goneSnap));
  check('resource_missing -> handled as deleted (expired)', r.status === 200 && sub(tL).status === 'expired', [r.body, sub(tL)]);

  // ---------------------------------------------------------------- pending_plan in webhooks
  console.log('Scheduled downgrade via webhook');
  const endS = Math.floor(new Date(realFuture).getTime() / 1000);
  const tP = mkTherapist({ plan: 'pro', status: 'active', stripe_customer_id: 'cus_p', stripe_subscription_id: 'sub_p',
    current_period_start: new Date((endS - 30 * 86400) * 1000).toISOString(), current_period_end: new Date(endS * 1000).toISOString(), pending_plan: 'basic' });
  const liveEvt = (id, plan, start, end, extra = {}) => {
    const s = fakeSub('sub_p', plan, { current_period_start: start, current_period_end: end, ...extra });
    return ev(id, 'customer.subscription.updated', clone(s));
  };
  await hook(liveEvt('evt_p1', 'basic', endS - 30 * 86400, endS));
  check('price switched mid-period: plan stays pro, pending kept', sub(tP).plan === 'pro' && sub(tP).pending_plan === 'basic', sub(tP));
  await hook(liveEvt('evt_p1c', 'basic', endS - 30 * 86400, endS, { cancel_at_period_end: true }));
  check('cancel event mid-period: plan stays pro', sub(tP).plan === 'pro' && sub(tP).status === 'canceled', sub(tP));
  await hook(liveEvt('evt_p2', 'basic', endS, endS + 30 * 86400));
  check('renewal: plan basic, pending cleared', sub(tP).plan === 'basic' && sub(tP).pending_plan === null && sub(tP).status === 'active', sub(tP));
  db.run("UPDATE subscriptions SET plan = 'pro', pending_plan = 'basic' WHERE therapist_id = ?", [tP]);
  await hook(liveEvt('evt_p3', 'pro', endS, endS + 30 * 86400));
  check('Stripe back on pro: pending cleared, plan pro', sub(tP).plan === 'pro' && sub(tP).pending_plan === null, sub(tP));
  db.run("UPDATE subscriptions SET plan = 'pro', pending_plan = 'basic', current_period_end = ? WHERE therapist_id = ?", [new Date((endS + 30 * 86400) * 1000).toISOString(), tP]);
  fake.subs.sub_p = { id: 'sub_p', status: 'active', cancel_at_period_end: false, metadata: {},
    items: { data: [{ id: 'si_p', current_period_start: endS + 30 * 86400, current_period_end: endS + 60 * 86400, price: priceOf('basic') }] } };
  await hook(ev('evt_p4', 'customer.subscription.updated', clone(fake.subs.sub_p)));
  check('item-level period (new API) detects renewal', sub(tP).plan === 'basic' && sub(tP).pending_plan === null, sub(tP));

  // ---------------------------------------------------------------- change-plan
  console.log('change-plan (fake Stripe)');
  const tS = mkTherapist({ plan: 'pro', status: 'active', stripe_customer_id: 'cus_s', stripe_subscription_id: 'sub_s', current_period_end: realFuture });
  fakeSub('sub_s', 'pro');
  const cp = (id, plan) => call(server, 'POST', '/api/subscription/change-plan', { plan }, auth(id));
  fake.calls.length = 0;
  r = await cp(tS, 'basic');
  check('downgrade scheduled, local plan pro', r.status === 200 && r.body.subscription.scheduled === true && sub(tS).plan === 'pro' && sub(tS).pending_plan === 'basic', [r.body, sub(tS)]);
  check('Stripe price switched with proration none + idempotency key',
    fake.calls.length === 1 && fake.calls[0].params.proration_behavior === 'none' &&
    /^prtop-\d+-downgrade-basic-[0-9a-f-]{36}$/.test(fake.calls[0].opts && fake.calls[0].opts.idempotencyKey), fake.calls);
  r = await cp(tS, 'basic');
  check('same downgrade again -> 400', r.status === 400, r);
  fake.calls.length = 0;
  r = await cp(tS, 'pro');
  check('Keep current plan undoes downgrade (price back to pro)', r.status === 200 && r.body.downgrade_canceled === true && sub(tS).pending_plan === null &&
    JSON.stringify(updatesTo()) === '["pro"]' && fake.subs.sub_s.items.data[0].price.id === 'price_pro', [r.body, fake.calls]);
  await cp(tS, 'confirm');
  fake.calls.length = 0;
  r = await cp(tS, 'premium');
  check('upgrade with pending: revert then prorated upgrade', r.status === 200 && r.body.charged === true &&
    JSON.stringify(updatesTo()) === '["pro","premium"]' && fake.calls[1].params.proration_behavior === 'always_invoice' &&
    sub(tS).plan === 'premium' && sub(tS).pending_plan === null, [r.body, updatesTo(), sub(tS)]);
  const keys = fake.calls.map(c => c.opts && c.opts.idempotencyKey);
  check('distinct idempotency keys per call', keys.every(Boolean) && new Set(keys).size === keys.length, keys);

  console.log('Lost / failed Stripe responses (review item 4)');
  const tF = mkTherapist({ plan: 'pro', status: 'active', stripe_customer_id: 'cus_f', stripe_subscription_id: 'sub_f', current_period_end: realFuture });
  fakeSub('sub_f', 'pro');
  fake.updateMode = 'fail';
  r = await cp(tF, 'basic');
  check('downgrade, Stripe did not apply -> 502, pending restored', r.status === 502 && r.body.code === 'stripe_error' && sub(tF).pending_plan === null, [r.body, sub(tF)]);
  fake.updateMode = 'lost';
  r = await cp(tF, 'basic');
  check('downgrade, applied but response lost -> 200 scheduled', r.status === 200 && r.body.subscription.scheduled === true && sub(tF).pending_plan === 'basic', [r.body, sub(tF)]);
  fake.updateMode = 'ok';
  await cp(tF, 'pro'); // undo
  fake.updateMode = 'lost';
  r = await cp(tF, 'premium');
  check('upgrade applied but response lost -> recorded as charged', r.status === 200 && r.body.charged === true && sub(tF).plan === 'premium', [r.body, sub(tF)]);
  fake.updateMode = 'ok';
  await cp(tF, 'pro'); // schedule premium -> pro
  check('setup: pending pro on premium', sub(tF).pending_plan === 'pro' && fake.subs.sub_f.items.data[0].price.id === 'price_pro');
  // upgrade genuinely failing after the revert: downgrade restored
  const tF2 = mkTherapist({ plan: 'pro', status: 'active', stripe_customer_id: 'cus_f2', stripe_subscription_id: 'sub_f2', current_period_end: realFuture, pending_plan: 'basic' });
  fakeSub('sub_f2', 'basic');
  const realUpdate = client.subscriptions.update;
  client.subscriptions.update = async (id, params, opts) => {
    if (params.payment_behavior === 'error_if_incomplete') { fake.calls.push({ id, params: clone(params), opts }); throw new Error('card declined'); }
    return realUpdate(id, params, opts);
  };
  fake.calls.length = 0;
  r = await cp(tF2, 'premium');
  check('upgrade declined after revert -> 402, downgrade restored in Stripe and locally',
    r.status === 402 && r.body.code === 'payment_failed' && sub(tF2).pending_plan === 'basic' && sub(tF2).plan === 'pro' &&
    fake.subs.sub_f2.items.data[0].price.id === 'price_basic' && JSON.stringify(updatesTo()) === '["pro","premium","basic"]', [r.body, sub(tF2), updatesTo()]);
  client.subscriptions.update = realUpdate;
  fake.retrieveMode = 'fail';
  const tF3 = mkTherapist({ plan: 'pro', status: 'active', stripe_customer_id: 'cus_f3', stripe_subscription_id: 'sub_f3', current_period_end: realFuture });
  fakeSub('sub_f3', 'pro');
  r = await cp(tF3, 'basic');
  check('downgrade with Stripe unreachable -> 502 unconfirmed, pending kept for webhook', r.status === 502 && r.body.code === 'stripe_unconfirmed' && sub(tF3).pending_plan === 'basic', [r.body, sub(tF3)]);
  fake.retrieveMode = 'ok';

  console.log('Revert only when Stripe is on the pending price (review item 2)');
  const tLeg = mkTherapist({ plan: 'pro', status: 'active', stripe_customer_id: 'cus_g', stripe_subscription_id: 'sub_g', current_period_end: realFuture, pending_plan: 'basic' });
  fakeSub('sub_g', 'pro'); // legacy: pending set locally, Stripe never switched
  fake.calls.length = 0;
  r = await cp(tLeg, 'premium');
  check('legacy pending: no revert call, only the upgrade', r.status === 200 && JSON.stringify(updatesTo()) === '["premium"]', [r.body, updatesTo()]);

  console.log('Per-therapist lock (review item 2)');
  const tC = mkTherapist({ plan: 'pro', status: 'active', stripe_customer_id: 'cus_c', stripe_subscription_id: 'sub_c', current_period_end: realFuture });
  fakeSub('sub_c', 'pro');
  await cp(tC, 'basic');
  fake.calls.length = 0;
  fake.updateDelayMs = 40;
  const [r1, r2] = await Promise.all([cp(tC, 'premium'), cp(tC, 'premium')]);
  fake.updateDelayMs = 0;
  const upgrades = fake.calls.filter(c => c.params.payment_behavior === 'error_if_incomplete').length;
  check('double-click: one upgrade charge, second request sees the new plan',
    upgrades === 1 && [r1.status, r2.status].sort().join(',') === '200,400' && sub(tC).plan === 'premium', [r1.status, r2.status, updatesTo()]);
  const [c1, c2] = await Promise.all([
    call(server, 'POST', '/api/subscription/cancel', {}, auth(tC)),
    call(server, 'POST', '/api/subscription/cancel', {}, auth(tC))
  ]);
  check('concurrent cancel: one succeeds, one "already canceled"', [c1.status, c2.status].sort().join(',') === '200,400' && sub(tC).status === 'canceled', [c1.body, c2.body]);
  const [s1, s2] = await Promise.all([
    call(server, 'POST', '/api/subscription/resume', {}, auth(tC)),
    call(server, 'POST', '/api/subscription/resume', {}, auth(tC))
  ]);
  check('concurrent resume: one succeeds, one "not canceled"', [s1.status, s2.status].sort().join(',') === '200,400' && sub(tC).status === 'active', [s1.body, s2.body]);

  console.log('change-plan (no Stripe subscription)');
  const tN = mkTherapist({ plan: 'pro', status: 'active' });
  r = await cp(tN, 'basic');
  check('no period: downgrade immediate, switched flag for i18n', r.status === 200 && r.body.switched === true && sub(tN).plan === 'basic' && sub(tN).pending_plan === null, [r.body, sub(tN)]);
  const tN2 = mkTherapist({ plan: 'pro', status: 'active', current_period_end: realFuture });
  fake.calls.length = 0;
  r = await cp(tN2, 'basic');
  check('running period: scheduled, no Stripe call', r.status === 200 && r.body.subscription.scheduled === true && sub(tN2).pending_plan === 'basic' && fake.calls.length === 0, [r.body, sub(tN2)]);
  r = await call(server, 'POST', '/api/subscription/cancel', {}, auth(tN2));
  check('cancel keeps pending_plan', r.status === 200 && sub(tN2).status === 'canceled' && sub(tN2).pending_plan === 'basic', [r.body, sub(tN2)]);
  db.run("UPDATE subscriptions SET status = 'active', current_period_end = ? WHERE therapist_id = ?", [realPast, tN2]);
  check('gate applies pending after period end (non-Stripe)', planLimits.getSubscriptionAccessForTherapist(tN2).plan === 'basic');
  r = await call(server, 'GET', '/api/subscription/current', undefined, auth(tN2));
  check('GET /current persists due downgrade (non-Stripe)', r.status === 200 && r.body.subscription.plan === 'basic' && sub(tN2).plan === 'basic', [r.body, sub(tN2)]);
  const tSD = mkTherapist({ plan: 'pro', status: 'active', stripe_customer_id: 'cus_sd', stripe_subscription_id: 'sub_sd', current_period_end: realPast, pending_plan: 'basic' });
  fakeSub('sub_sd', 'basic');
  r = await call(server, 'GET', '/api/subscription/current', undefined, auth(tSD));
  check('GET /current does not lazily apply on a Stripe-backed row', r.body.subscription.plan === 'pro' && sub(tSD).pending_plan === 'basic', [r.body, sub(tSD)]);

  // ---------------------------------------------------------------- reconciliation
  console.log('Legacy pending_plan reconciliation (review item 3)');
  db.run("UPDATE subscriptions SET pending_plan = NULL WHERE stripe_subscription_id LIKE 'sub_%'");
  const tR1 = mkTherapist({ plan: 'pro', status: 'active', stripe_subscription_id: 'sub_r1', pending_plan: 'basic' });
  fakeSub('sub_r1', 'pro'); // legacy: Stripe still on pro
  const tR2 = mkTherapist({ plan: 'premium', status: 'past_due', stripe_subscription_id: 'sub_r2', pending_plan: 'pro' });
  fakeSub('sub_r2', 'pro'); // already switched
  const tR3 = mkTherapist({ plan: 'pro', status: 'active', stripe_subscription_id: 'sub_r3', pending_plan: 'basic' });
  // sub_r3 missing in Stripe -> failure, logged
  const tR4 = mkTherapist({ plan: 'pro', status: 'expired', stripe_subscription_id: 'sub_r4', pending_plan: 'basic' });
  fakeSub('sub_r4', 'pro');
  fake.calls.length = 0;
  let rec = await stripeSvc.reconcilePendingDowngrades();
  check('reconcile: switches legacy row, leaves ok row, logs missing, skips expired',
    rec.checked === 3 && rec.switched === 1 && rec.alreadyOk === 1 && rec.failed === 1 &&
    fake.subs.sub_r1.items.data[0].price.id === 'price_basic' && fake.subs.sub_r4.items.data[0].price.id === 'price_pro' &&
    fake.calls[0].params.proration_behavior === 'none' && fake.calls[0].opts.idempotencyKey, [rec, fake.calls]);
  rec = await stripeSvc.reconcilePendingDowngrades();
  check('reconcile is idempotent (second run switches nothing)', rec.switched === 0 && rec.alreadyOk === 2, rec);
  fake.retrieveMode = 'fail';
  rec = await stripeSvc.reconcilePendingDowngrades();
  check('reconcile never throws on Stripe errors', rec.failed === 3, rec);
  fake.retrieveMode = 'ok';
  void tR1; void tR2; void tR3; void tR4;

  check('no real network request attempted', networkAttempted === false);

  server.close();
});
