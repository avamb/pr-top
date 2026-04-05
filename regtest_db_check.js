// Check user data in both databases
var initSqlJs = require('./src/backend/node_modules/sql.js');
var fs = require('fs');
var path = require('path');

async function main() {
  var SQL = await initSqlJs();

  var files = ['prtop.db', 'psylink.db'];
  for (var i = 0; i < files.length; i++) {
    var dbPath = path.join(__dirname, 'src', 'backend', 'data', files[i]);
    if (!fs.existsSync(dbPath)) {
      console.log(files[i] + ': NOT FOUND');
      continue;
    }
    var stat = fs.statSync(dbPath);
    console.log('\n=== ' + files[i] + ' (size: ' + stat.size + ', modified: ' + stat.mtime.toISOString() + ') ===');
    var fileBuffer = fs.readFileSync(dbPath);
    var db = new SQL.Database(fileBuffer);

    try {
      var countResult = db.exec('SELECT COUNT(*) FROM users');
      console.log('Total users:', countResult[0].values[0][0]);

      var recentUsers = db.exec("SELECT id, email, role, created_at FROM users ORDER BY id DESC LIMIT 5");
      if (recentUsers.length > 0) {
        console.log('Recent users:');
        recentUsers[0].values.forEach(function(row) {
          console.log('  id=' + row[0] + ' email=' + row[1] + ' role=' + row[2] + ' created=' + row[3]);
        });
      }

      var testUser = db.exec("SELECT id, email, password_hash FROM users WHERE email LIKE '%regr_f3%' OR email LIKE '%REGR_F3%' OR email LIKE '%restart_test%' OR email LIKE '%RESTART_TEST%'");
      if (testUser.length > 0 && testUser[0].values.length > 0) {
        console.log('Test users found:');
        testUser[0].values.forEach(function(row) {
          console.log('  id=' + row[0] + ' email=' + row[1] + ' hash_exists=' + (row[2] ? 'yes' : 'no'));
        });
      } else {
        console.log('NO test users found!');
      }
    } catch(e) {
      console.log('Error:', e.message);
    }
    db.close();
  }
}

main().catch(function(e) { console.error(e); process.exit(1); });
