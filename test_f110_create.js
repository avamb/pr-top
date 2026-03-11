const http = require('http');

function apiCall(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {})
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(opts, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch(e) { resolve(b); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const botH = { 'x-bot-api-key': 'dev-bot-api-key' };

  // Create diary entry for existing client (client 486 / telegram f109_diary_1773268558365)
  const diaryRes = await apiCall('POST', '/api/bot/diary', {
    telegram_id: 'f109_diary_1773268558365',
    content: 'DELETE_TEST_22222',
    entry_type: 'text'
  }, botH);
  console.log('Created diary entry:', JSON.stringify(diaryRes));
}

main().catch(e => console.error(e));
