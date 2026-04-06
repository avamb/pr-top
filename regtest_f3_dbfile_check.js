// Direct DB file check - reads the SQLite file without going through the server
var initSqlJs = require('./src/backend/node_modules/sql.js');
var fs = require('fs');
var path = require('path');

var dbPath = path.resolve(__dirname, 'src/backend/data/prtop.db');

async function checkDB() {
  console.log('DB file path:', dbPath);
  console.log('DB file exists:', fs.existsSync(dbPath));

  if (!fs.existsSync(dbPath)) {
    console.log('ERROR: DB file not found');
    return;
  }

  var stats = fs.statSync(dbPath);
  console.log('DB file size:', stats.size, 'bytes');
  console.log('DB file modified:', stats.mtime.toISOString());

  var SQL = await initSqlJs();
  var fileBuffer = fs.readFileSync(dbPath);
  var db = new SQL.Database(fileBuffer);

  // Count users
  var result = db.exec('SELECT COUNT(*) FROM users');
  console.log('Total users in DB file:', result[0].values[0][0]);

  // Check for our test users
  var testEmails = [
    'f3_persist_ctrl_0404c@test.com',
    'restart_test_f3_regr_0404@test.com',
    'regtest_f5_agent_042@test.com',
    'restart_test_12345@test.com'
  ];

  testEmails.forEach(function(email) {
    var r = db.exec("SELECT id, email, created_at FROM users WHERE email = ?", [email]);
    if (r.length > 0 && r[0].values.length > 0) {
      console.log('FOUND:', email, '-> id=' + r[0].values[0][0], 'created=' + r[0].values[0][2]);
    } else {
      console.log('NOT FOUND:', email);
    }
  });

  // Check last few users
  var recent = db.exec('SELECT id, email, created_at FROM users ORDER BY id DESC LIMIT 5');
  console.log('\nLast 5 users in DB:');
  if (recent.length > 0) {
    recent[0].values.forEach(function(row) {
      console.log('  id=' + row[0] + ' email=' + row[1] + ' created=' + row[2]);
    });
  }

  // Check sqlite_sequence for users table
  var seq = db.exec("SELECT * FROM sqlite_sequence WHERE name = 'users'");
  if (seq.length > 0) {
    console.log('\nsqlite_sequence for users:', JSON.stringify(seq[0].values));
  }

  db.close();
}

checkDB().catch(function(e) { console.error('Error:', e.message); });
