// Regression test: verify database schema
var Database = require('better-sqlite3');
var db = new Database(__dirname + '/src/backend/data/psylink.db', { readonly: true });

var tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables found:', tables.length);
console.log('Table names:', JSON.stringify(tables.map(function(t){ return t.name; })));

tables.forEach(function(t){
  var cols = db.prepare('PRAGMA table_info(' + t.name + ')').all();
  console.log('\n' + t.name + ': ' + cols.map(function(c){ return c.name; }).join(', '));
});

db.close();
console.log('\nDone.');
