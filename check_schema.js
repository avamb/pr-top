const path = require('path');
const fs = require('fs');
const initSqlJs = require(path.join(__dirname, 'src', 'backend', 'node_modules', 'sql.js'));

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'src', 'backend', 'data', 'psylink.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  if (tables.length > 0) {
    const tableNames = tables[0].values.map(r => r[0]);
    tableNames.forEach(function(name) {
      if (name.indexOf('sqlite_') === 0) return;
      const info = db.exec('PRAGMA table_info(' + name + ')');
      if (info.length > 0) {
        const cols = info[0].values.map(r => r[1]);
        console.log(name + ': ' + cols.join(', '));
      }
    });
  }
  db.close();
}

main().catch(console.error);
