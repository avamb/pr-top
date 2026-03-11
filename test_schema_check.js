const Database = require('better-sqlite3');
const db = new Database('./src/backend/data/psylink.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('=== TABLES ===');
console.log(tables.map(t => t.name).join('\n'));

console.log('\n=== COLUMNS ===');
for (const t of tables) {
  const cols = db.prepare('PRAGMA table_info(' + t.name + ')').all();
  console.log('\n' + t.name + ': ' + cols.map(c => c.name).join(', '));
}

db.close();
