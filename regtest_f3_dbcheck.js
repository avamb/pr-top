var initSqlJs = require('./src/backend/node_modules/sql.js');
var fs = require('fs');
var path = require('path');

async function main() {
  var SQL = await initSqlJs();
  var dbPath = path.join(__dirname, 'src', 'backend', 'data', 'prtop.db');
  var buf = fs.readFileSync(dbPath);
  var db = new SQL.Database(buf);

  // Check for our test user
  var res = db.exec("SELECT id, email, role, password_hash, created_at FROM users WHERE email LIKE '%restart_regtest_20260404%'");
  if (res.length > 0) {
    console.log('User FOUND in database:');
    res[0].columns.forEach(function(col, i) {
      console.log('  ' + col + ': ' + res[0].values[0][i]);
    });
  } else {
    console.log('User NOT FOUND in database - data was lost on restart!');
  }

  // Also check total user count
  var cnt = db.exec("SELECT COUNT(*) FROM users");
  console.log('Total users in DB: ' + cnt[0].values[0][0]);

  // Check recent users
  var recent = db.exec("SELECT id, email, created_at FROM users ORDER BY id DESC LIMIT 5");
  if (recent.length > 0) {
    console.log('\nMost recent users:');
    recent[0].values.forEach(function(row) {
      console.log('  id=' + row[0] + ' email=' + row[1] + ' created=' + row[2]);
    });
  }

  db.close();
}

main().catch(function(e) { console.error('Error:', e.message); });
