// Seed 100+ clients directly in the database for performance testing
const initSqlJs = require('./src/backend/node_modules/sql.js');
const bcrypt = require('./src/backend/node_modules/bcryptjs');
const fs = require('fs');
const path = require('path');

async function main(){
  const dbPath = path.resolve(__dirname, 'src/backend/data/psylink.db');
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // Find the perf test therapist (id=50)
  const therapistId = 50;
  const existing = db.exec("SELECT COUNT(*) FROM users WHERE therapist_id = ? AND role = 'client'", [therapistId]);
  const existingCount = existing[0].values[0][0];
  console.log(`Therapist ${therapistId} has ${existingCount} clients already`);

  const needed = 105 - existingCount;
  if(needed <= 0){
    console.log('Already have enough clients');
    return;
  }

  const hash = await bcrypt.hash('TestPass123', 12);
  const ts = Date.now();

  for(let i = 1; i <= needed; i++){
    const email = `seed_c${i}_${ts}@t.com`;
    db.run(
      "INSERT INTO users (email, password_hash, role, therapist_id, consent_therapist_access, language) VALUES (?, ?, 'client', ?, 1, 'en')",
      [email, hash, therapistId]
    );
    if(i % 20 === 0) console.log(`Inserted ${i}/${needed} clients`);
  }

  // Verify count
  const count = db.exec("SELECT COUNT(*) FROM users WHERE therapist_id = ? AND role = 'client'", [therapistId]);
  console.log(`Total clients for therapist ${therapistId}: ${count[0].values[0][0]}`);

  // Save
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log('Database saved');
}

main().catch(e => console.error('Error:', e.message));
