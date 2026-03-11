const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;

    function doRequest(csrfToken) {
      if (csrfToken) opts.headers['x-csrf-token'] = csrfToken;
      const r = http.request(opts, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      });
      r.on('error', reject);
      if (body) r.write(JSON.stringify(body));
      r.end();
    }

    if (method === 'POST' || method === 'PUT') {
      const csrfReq = http.get('http://localhost:3001/api/csrf-token', (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { doRequest(JSON.parse(d).csrfToken); });
      });
      csrfReq.on('error', reject);
    } else {
      doRequest();
    }
  });
}

async function main() {
  // Create test client
  const clientTgId = 'debug_test_' + Date.now();
  const regRes = await req('POST', '/api/bot/register', { telegram_id: clientTgId, role: 'client', language: 'en' });
  console.log('Register:', regRes.status, regRes.body);

  // Create diary entry
  const diaryRes = await req('POST', '/api/bot/diary', {
    telegram_id: clientTgId,
    content: 'Test diary entry about anxiety',
    entry_type: 'text'
  });
  console.log('Diary:', diaryRes.status, diaryRes.body);
}

main().catch(err => console.error(err));
