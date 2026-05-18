'use strict';
const http = require('http');
const crypto = require('crypto');

function request(method, path, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, data ? { 'Content-Length': Buffer.byteLength(data) } : {}, headers)
    };
    const req = http.request(opts, function(res) {
      let buf = '';
      res.on('data', function(c) { buf += c; });
      res.on('end', function() {
        let parsed;
        try { parsed = JSON.parse(buf); } catch(e) { parsed = buf; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const suffix = crypto.randomBytes(3).toString('hex');
  const email = 'debug390_' + suffix + '@test.com';

  // Register therapist
  const csrf1 = await request('GET', '/api/csrf-token');
  const reg = await request('POST', '/api/auth/register',
    { email: email, password: 'TestPass390!', role: 'therapist' },
    { 'X-CSRF-Token': csrf1.body.csrfToken });
  console.log('Register:', reg.status, JSON.stringify(reg.body).substring(0, 100));
  const jwt = reg.body.token;

  // Get invite code
  const inv = await request('GET', '/api/invite-code', null, { 'Authorization': 'Bearer ' + jwt });
  console.log('Invite code full response:', inv.status, JSON.stringify(inv.body));

  // Register bot client
  const BOT_H = { 'x-bot-api-key': 'dev-bot-api-key' };
  const tid = '39000' + Math.floor(Math.random() * 99999);
  const botReg = await request('POST', '/api/bot/register',
    { telegram_id: tid, role: 'client', first_name: 'Debug', last_name: 'Client', language: 'en' },
    BOT_H);
  console.log('Bot reg:', botReg.status, JSON.stringify(botReg.body).substring(0, 100));

  // Connect - try both code fields
  const inviteCode = inv.body.code || inv.body.invite_code || inv.body.inviteCode;
  console.log('Using invite code:', inviteCode);
  const conn = await request('POST', '/api/bot/connect',
    { telegram_id: tid, invite_code: inviteCode }, BOT_H);
  console.log('Connect:', conn.status, JSON.stringify(conn.body).substring(0, 200));
}
main().catch(console.error);
