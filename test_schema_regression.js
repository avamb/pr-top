const Database = require('better-sqlite3');
const db = new Database('./src/backend/data/psylink.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables:', JSON.stringify(tables.map(t => t.name)));

for (const t of tables) {
  const cols = db.prepare('PRAGMA table_info(' + t.name + ')').all();
  console.log(t.name + ': ' + cols.map(c => c.name).join(', '));
}

db.close();
