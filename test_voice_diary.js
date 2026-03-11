const initSqlJs = require('./src/backend/node_modules/sql.js');
const fs = require('fs');

(async () => {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('src/backend/data/psylink.db');
  const db = new SQL.Database(buf);
  const r = db.exec('SELECT id, entry_type, file_ref IS NOT NULL as has_file_ref, content_encrypted IS NOT NULL as has_content, encryption_key_id FROM diary_entries WHERE id = 35');
  console.log(JSON.stringify(r, null, 2));
})();
