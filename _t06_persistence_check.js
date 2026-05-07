// T-06 persistence verification: register a fresh therapist, create a solo
// client with a unique marker note, then expect the same row to survive a
// backend kill+restart (which the caller does between this script and a
// follow-up "verify" pass).
const API = 'http://localhost:3001/api';
const fs = require('fs');

let cookieJar = '';
function captureCookies(headers) {
  const setCookies = headers.getSetCookie ? headers.getSetCookie() : (headers.raw && headers.raw()['set-cookie']) || [];
  for (const c of setCookies) {
    const semi = c.indexOf(';');
    const kv = semi === -1 ? c : c.slice(0, semi);
    const eq = kv.indexOf('=');
    if (eq === -1) continue;
    const name = kv.slice(0, eq);
    const val = kv.slice(eq + 1);
    cookieJar = cookieJar
      .split('; ')
      .filter(piece => piece && !piece.startsWith(name + '='))
      .concat([`${name}=${val}`])
      .join('; ');
  }
}
async function jfetch(url, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  if (cookieJar) headers.cookie = cookieJar;
  const res = await fetch(url, Object.assign({}, opts, { headers }));
  captureCookies(res.headers);
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body, headers: res.headers };
}

(async () => {
  const phase = process.argv[2] || 'create';
  const stateFile = '_t06_state.json';

  if (phase === 'create') {
    const ts = Date.now();
    const email = `t06p_${ts}@test.local`;
    const password = 'TestPass123!';
    const marker = `T06_RESTART_PERSIST_${ts}`;

    const csrf = await jfetch(`${API}/csrf-token`);
    const csrfToken = csrf.body.csrfToken;
    const reg = await jfetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ email, password, first_name: 'P', last_name: 'P', csrfToken })
    });
    if (reg.status !== 201) { console.log('FAIL register: ' + reg.status); process.exit(1); }
    const token = reg.body.token;
    const therapistId = reg.body.user.id;

    const create = await jfetch(`${API}/clients/solo`, {
      method: 'POST',
      headers: { 'authorization': `Bearer ${token}`, 'x-csrf-token': csrfToken, 'content-type': 'application/json' },
      body: JSON.stringify({ first_name: 'Persist', last_name: 'Test', language: 'en', note: marker })
    });
    if (create.status !== 201) { console.log('FAIL create: ' + create.status + ' ' + JSON.stringify(create.body)); process.exit(1); }
    const soloId = create.body.client.id;
    fs.writeFileSync(stateFile, JSON.stringify({ email, password, token, therapistId, soloId, marker }, null, 2));
    console.log(`CREATED therapist=${therapistId} soloClient=${soloId} marker=${marker}`);
    process.exit(0);
  }

  if (phase === 'verify') {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    // Re-login: the bearer token should still work (JWT is server-side validated against secret),
    // but to be safe, do a fresh login.
    const csrf = await jfetch(`${API}/csrf-token`);
    const login = await jfetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.body.csrfToken },
      body: JSON.stringify({ email: state.email, password: state.password, csrfToken: csrf.body.csrfToken })
    });
    if (login.status !== 200) { console.log('FAIL login: ' + login.status); process.exit(1); }
    const token = login.body.token;

    // Verify list contains the solo client with mode='solo'
    const list = await jfetch(`${API}/clients`, { headers: { 'authorization': `Bearer ${token}` } });
    const found = (list.body.clients || []).find(c => c.id === state.soloId);
    if (!found) { console.log('FAIL: solo client missing after restart'); process.exit(1); }
    if (found.mode !== 'solo') { console.log('FAIL: mode!=solo after restart'); process.exit(1); }

    // Verify the encrypted note survived
    const notes = await jfetch(`${API}/clients/${state.soloId}/notes`, { headers: { 'authorization': `Bearer ${token}` } });
    const ok = (notes.body.notes || []).some(n => (n.content || '').includes(state.marker));
    if (!ok) { console.log('FAIL: encrypted note missing after restart'); process.exit(1); }
    console.log(`VERIFIED solo client #${state.soloId} survived restart with marker ${state.marker}`);
    process.exit(0);
  }

  console.log('Usage: node _t06_persistence_check.js [create|verify]');
  process.exit(2);
})().catch(e => { console.error(e); process.exit(2); });
