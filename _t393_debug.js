'use strict';
const http = require('http');

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: { 'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0, ...headers }
    };
    const r = http.request(opts, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  // 1. Register therapist
  const csrfR = await req('GET', '/api/csrf-token');
  const csrf = csrfR.body.csrfToken;
  const ts = Date.now();
  const regR = await req('POST', '/api/auth/register',
    { email: `debug393_${ts}@test.com`, password: 'Test12345!', role: 'therapist' },
    { 'X-CSRF-Token': csrf });
  const token = regR.body.token;
  const userId = regR.body.user?.id;
  console.log('Therapist registered, userId:', userId);

  // 2. Upgrade to pro
  await req('POST', '/api/dev/set-subscription', { therapist_id: userId, plan: 'pro', status: 'active' });

  // 3. Get invite code
  const csrf2 = (await req('GET', '/api/csrf-token', null, { Authorization: `Bearer ${token}` })).body.csrfToken;
  const invR = await req('GET', '/api/invite-code', null, { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrf2 });
  const inviteCode = invR.body.invite_code;
  console.log('Invite code:', inviteCode);

  // 4. Register client via bot
  const tgId = 93930099 + Math.floor(Math.random() * 1000);
  const BOT = { 'X-Bot-Api-Key': 'dev-bot-api-key' };
  await req('POST', '/api/bot/register', { telegram_id: String(tgId), role: 'client', first_name: 'Test' }, BOT);
  const connR = await req('POST', '/api/bot/connect', { telegram_id: String(tgId), invite_code: inviteCode }, BOT);
  const therapistId = connR.body.therapist?.id;
  console.log('Connect response therapist_id:', therapistId);
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update('consent-text-v1').digest('hex');
  const consentR = await req('POST', '/api/bot/consent',
    { telegram_id: String(tgId), therapist_id: therapistId, consent: true, consent_version: 1, consent_text_hash: hash, mode: 'connect' }, BOT);
  const clientId = consentR.body.client_id;
  console.log('Client linked, clientId:', clientId);

  // 5. Post diary with unique key
  const KEY = 'debugrevoke_393_ZZZZ';
  const diaryR = await req('POST', '/api/bot/diary',
    { telegram_id: String(tgId), entry_type: 'text', content: `The client mentions ${KEY} repeatedly` }, BOT);
  console.log('Diary posted:', diaryR.status, diaryR.body.entry?.id);

  await new Promise(r => setTimeout(r, 500));

  // 6. Search BEFORE revocation
  const before = await req('POST', '/api/search', { query: KEY, limit: 10 }, { Authorization: `Bearer ${token}` });
  console.log('Before revoke: results =', before.body.results?.length, 'total =', before.body.total);
  if (before.body.results?.[0]) {
    console.log('  Top result client_id:', before.body.results[0].client_id, 'source_type:', before.body.results[0].source_type);
  }

  // 7. Revoke consent
  const revoke = await req('POST', '/api/bot/revoke-consent', { telegram_id: String(tgId) }, BOT);
  console.log('Revoke response:', revoke.status, revoke.body.revoked);

  // 8. Check DB state of the user
  const dbR = await req('POST', '/api/dev/db-query',
    { sql: 'SELECT id, therapist_id, consent_therapist_access, role FROM users WHERE id = ?', params: [clientId] });
  console.log('User DB state after revocation:', JSON.stringify(dbR.body.rows?.[0]));

  // 9. Search AFTER revocation
  const after = await req('POST', '/api/search', { query: KEY, limit: 10 }, { Authorization: `Bearer ${token}` });
  console.log('After revoke: results =', after.body.results?.length, 'total =', after.body.total);
  if (after.body.results?.length > 0) {
    console.log('  CONSENT BUG: results still returned!', JSON.stringify(after.body.results));
  } else {
    console.log('  PASS: no results after revocation');
  }

  // 10. Also check the search stats endpoint to confirm server loaded the new code
  const stats = await req('GET', '/api/search/stats', null, { Authorization: `Bearer ${token}` });
  console.log('Stats:', JSON.stringify(stats.body));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
