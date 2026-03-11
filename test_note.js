const initSqlJs = require('./src/backend/node_modules/sql.js');
const fs = require('fs');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync('src/backend/data/psylink.db');
  const db = new SQL.Database(buf);

  // Check client 204
  var r = db.exec('SELECT id, therapist_id, consent_therapist_access, role FROM users WHERE id = 204');
  console.log('Client 204:', JSON.stringify(r[0].values[0]));

  // Set consent
  db.run("UPDATE users SET consent_therapist_access = 1 WHERE id = 204");
  var buf2 = db.export();
  fs.writeFileSync('src/backend/data/psylink.db', Buffer.from(buf2));
  console.log('Set consent for client 204');
}

main();
