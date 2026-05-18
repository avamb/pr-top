'use strict';
const { initDatabase, getDatabase } = require('./src/backend/src/db/connection');
initDatabase().then(() => {
  const db = getDatabase();
  const r = db.exec(
    "SELECT token FROM password_reset_tokens WHERE used = 0 ORDER BY created_at DESC LIMIT 1"
  );
  if (r.length > 0 && r[0].values.length > 0) {
    process.stdout.write(r[0].values[0][0]);
  } else {
    process.stdout.write('NO_TOKEN');
  }
  process.exit(0);
}).catch(e => { process.stderr.write(e.message); process.exit(1); });
