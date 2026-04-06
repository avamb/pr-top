// Watch the DB file for changes and report user count on each change
var fs = require('fs');
var path = require('path');

var dbPath = path.join(__dirname, 'src', 'backend', 'data', 'prtop.db');

async function countUsers() {
  var initSqlJs = require(path.join(__dirname, 'src', 'backend', 'node_modules', 'sql.js'));
  var SQL = await initSqlJs();
  var buf = fs.readFileSync(dbPath);
  var db = new SQL.Database(buf);
  var count = db.exec("SELECT COUNT(*) FROM users");
  var result = count[0].values[0][0];
  db.close();
  return result;
}

var lastMtime = 0;

async function check() {
  try {
    var stat = fs.statSync(dbPath);
    var mtime = stat.mtime.getTime();
    if (mtime !== lastMtime) {
      lastMtime = mtime;
      var users = await countUsers();
      process.stdout.write('[' + new Date().toISOString() + '] File changed: ' + stat.size + ' bytes, ' + users + ' users, mtime=' + stat.mtime.toISOString() + '\n');
    }
  } catch (e) {
    process.stdout.write('[' + new Date().toISOString() + '] Error: ' + e.message + '\n');
  }
}

process.stdout.write('Watching ' + dbPath + '\n');
check();
setInterval(check, 500); // Check every 500ms
