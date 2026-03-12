var initSqlJs = require('./src/backend/node_modules/sql.js');
var fs = require('fs');
var path = require('path');

var dbPath = path.join(__dirname, 'src', 'backend', 'data', 'psylink.db');
var buffer = fs.readFileSync(dbPath);

initSqlJs().then(function(SQL) {
  var db = new SQL.Database(buffer);
  var result = db.exec("SELECT id, email FROM users WHERE email = 'duplicate125@test.com'");
  if (result.length > 0) {
    console.log('Users with duplicate125@test.com:', result[0].values.length);
    result[0].values.forEach(function(row) {
      console.log('  id:', row[0], 'email:', row[1]);
    });
  } else {
    console.log('No users found with that email');
  }
  db.close();
});
