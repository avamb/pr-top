'use strict';
const { initDatabase, getDatabase, saveDatabaseAfterWrite } = require('./src/backend/src/db/connection');
initDatabase().then(() => {
  const db = getDatabase();
  const userRes = db.exec("SELECT id FROM users WHERE email = 'ui_test_386@example.com'");
  if (userRes.length > 0 && userRes[0].values.length > 0) {
    const uid = userRes[0].values[0][0];
    db.run('DELETE FROM subscriptions WHERE therapist_id = ?', [uid]);
    db.run('DELETE FROM password_reset_tokens WHERE user_id = ?', [uid]);
    db.run('DELETE FROM audit_logs WHERE actor_id = ?', [uid]);
    db.run('DELETE FROM users WHERE id = ?', [uid]);
    saveDatabaseAfterWrite();
    process.stdout.write('Cleaned up ui_test_386\n');
  } else {
    process.stdout.write('User not found (already cleaned)\n');
  }
  process.exit(0);
}).catch(e => { process.stderr.write(e.message + '\n'); process.exit(1); });
