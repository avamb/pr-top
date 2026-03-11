var initSqlJs = require('C:\\Projects\\dev-psy-bot\\src\\backend\\node_modules\\sql.js');
var fs = require('fs');
var path = require('path');

var dbPath = path.join('C:\\Projects\\dev-psy-bot', 'src', 'backend', 'data', 'psylink.db');

initSqlJs().then(function(SQL) {
  var fileBuffer = fs.readFileSync(dbPath);
  var db = new SQL.Database(fileBuffer);

  var tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  if (tables.length === 0) {
    console.log('No tables found!');
    return;
  }

  var tableNames = tables[0].values.map(function(r) { return r[0]; });
  console.log('Tables found:', tableNames.length);

  tableNames.forEach(function(name) {
    console.log('\n=== TABLE:', name, '===');
    var cols = db.exec("PRAGMA table_info(" + name + ")");
    if (cols.length > 0) {
      cols[0].values.forEach(function(c) {
        console.log('  -', c[1], '(' + c[2] + ')');
      });
    }
  });

  db.close();
}).catch(function(err) {
  console.error('Error:', err);
});
