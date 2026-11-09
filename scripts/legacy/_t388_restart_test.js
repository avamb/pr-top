'use strict';
/**
 * Server restart persistence test for feature #388.
 * Usage:
 *   node _t388_restart_test.js write   — create test entry, print ID
 *   node _t388_restart_test.js read ID — verify entry still exists
 */
const http = require('http');
const mode = process.argv[2];
const id = process.argv[3];

function post(path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ hostname: 'localhost', port: 3001, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...extraHeaders }
    }, res => {
      let raw = ''; res.on('data', d => raw += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

async function main() {
  if (mode === 'write') {
    // Find a client with telegram_id
    const r = await post('/api/dev/db-query', { sql: "SELECT id, telegram_id FROM users WHERE role = 'client' AND telegram_id IS NOT NULL ORDER BY id DESC LIMIT 1" });
    const row = r.body.rows[0];
    if (!row) { console.error('No client with telegram_id found'); process.exit(1); }
    const suffix = 'RESTART388_' + Date.now();
    const br = await post('/api/bot/diary', { telegram_id: row.telegram_id, type: 'text', content: suffix }, { 'X-Bot-API-Key': 'dev-bot-api-key' });
    const entryId = br.body?.entry?.id;
    if (!entryId) { console.error('Failed to create entry:', JSON.stringify(br.body)); process.exit(1); }
    // Verify in DB
    const dbR = await post('/api/dev/db-query', { sql: 'SELECT id, content_encrypted FROM diary_entries WHERE id = ?', params: [entryId] });
    const dbRow = dbR.body.rows[0];
    console.log('ENTRY_ID=' + entryId);
    console.log('SUFFIX=' + suffix);
    console.log('DB_ROW=' + JSON.stringify(dbRow));
    process.exit(0);
  }

  if (mode === 'read') {
    const dbR = await post('/api/dev/db-query', { sql: 'SELECT id, content_encrypted FROM diary_entries WHERE id = ?', params: [parseInt(id)] });
    const rows = dbR.body.rows;
    if (!rows || rows.length === 0) {
      console.error('FAIL: Entry id=' + id + ' NOT FOUND after restart');
      process.exit(1);
    }
    console.log('PASS: Entry id=' + id + ' persisted. content_encrypted (first 60):', String(rows[0].content_encrypted).substring(0, 60));
    process.exit(0);
  }

  console.error('Usage: node _t388_restart_test.js write | read <id>');
  process.exit(1);
}
main().catch(e => { console.error(e.message); process.exit(1); });
