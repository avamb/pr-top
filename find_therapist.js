var db = require('./src/backend/src/db/connection');
var rows = db.prepare('SELECT id,email,role FROM users WHERE role="therapist" LIMIT 5').all();
console.log(JSON.stringify(rows));
var clients = db.prepare('SELECT id,email,telegram_id,therapist_id FROM users WHERE role="client" AND therapist_id IS NOT NULL LIMIT 5').all();
console.log(JSON.stringify(clients));
