const path = require('path');
const fs = require('fs');

const backendDir = path.join(__dirname, 'src', 'backend');
const initSqlJs = require(path.join(backendDir, 'node_modules', 'sql.js'));

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.join(backendDir, 'data', 'psylink.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  if (tables.length > 0) {
    const tableNames = tables[0].values.map(r => r[0]);
    console.log('Tables (' + tableNames.length + '):', tableNames.join(', '));

    for (const name of tableNames) {
      const cols = db.exec('PRAGMA table_info(' + name + ')');
      if (cols.length > 0) {
        const colNames = cols[0].values.map(r => r[1]);
        console.log('\n' + name + ':', colNames.join(', '));
      }
    }
  }

  db.close();
}
main().catch(console.error);
