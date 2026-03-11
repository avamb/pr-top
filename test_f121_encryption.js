// Verify exercise response is stored encrypted in DB
const initSqlJs = require('./src/backend/node_modules/sql.js');
const fs = require('fs');
const path = require('path');

const check = async () => {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'src', 'backend', 'data', 'psylink.db');
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  const result = db.exec("SELECT id, status, response_encrypted FROM exercise_deliveries WHERE id = 7");
  if (result.length > 0 && result[0].values.length > 0) {
    const row = result[0].values[0];
    console.log('Delivery ID:', row[0]);
    console.log('Status:', row[1]);
    const encrypted = row[2];
    console.log('Response encrypted (first 100 chars):', encrypted ? encrypted.substring(0, 100) : 'NULL');
    console.log('Is encrypted (contains colons):', encrypted ? encrypted.includes(':') : false);
    console.log('Plaintext check - NOT plaintext:', encrypted ? !encrypted.startsWith('EXERCISE_RESPONSE') : true);

    if (encrypted) {
      const parts = encrypted.split(':');
      console.log('Encrypted parts count:', parts.length);
      console.log('Format valid (4 parts):', parts.length === 4);
    }
  } else {
    console.log('Delivery not found');
  }
  db.close();
};

check().catch(console.error);
