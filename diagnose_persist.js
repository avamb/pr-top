// Diagnose: simulate what the server does
var fs = require('fs');
var path = require('path');
var bcrypt = require(path.join(__dirname, 'src', 'backend', 'node_modules', 'bcryptjs'));

async function run() {
  var initSqlJs = require(path.join(__dirname, 'src', 'backend', 'node_modules', 'sql.js'));
  var SQL = await initSqlJs();
  var dbPath = path.join(__dirname, 'src', 'backend', 'data', 'prtop.db');

  // Step 1: Load DB from file (like server startup)
  var buf = fs.readFileSync(dbPath);
  var db = new SQL.Database(buf);

  var count1 = db.exec("SELECT COUNT(*) FROM users");
  process.stdout.write('Users after load: ' + count1[0].values[0][0] + '\n');

  // Step 2: Insert a user (like registration)
  var hash = bcrypt.hashSync('TestPass123', 12);
  var email = 'DIAG_TEST_' + Date.now() + '@test.com';
  db.run("INSERT INTO users (email, password_hash, role, language, timezone) VALUES (?, ?, 'therapist', 'en', 'UTC')", [email, hash]);

  var count2 = db.exec("SELECT COUNT(*) FROM users");
  process.stdout.write('Users after insert: ' + count2[0].values[0][0] + '\n');

  // Step 3: Export and save (like saveDatabase)
  var data = db.export();
  var buffer = Buffer.from(data);
  process.stdout.write('Export buffer size: ' + buffer.length + '\n');

  // Save to a TEST file to not corrupt the real DB
  var testPath = dbPath + '.diagtest';
  fs.writeFileSync(testPath, buffer);
  process.stdout.write('Saved to: ' + testPath + '\n');

  // Step 4: Close and reload from saved file
  db.close();

  var buf2 = fs.readFileSync(testPath);
  var db2 = new SQL.Database(buf2);

  var count3 = db2.exec("SELECT COUNT(*) FROM users");
  process.stdout.write('Users after reload: ' + count3[0].values[0][0] + '\n');

  var found = db2.exec("SELECT id, email FROM users WHERE email = '" + email + "'");
  if (found.length > 0 && found[0].values.length > 0) {
    process.stdout.write('Test user FOUND after reload: ' + found[0].values[0][1] + '\n');
  } else {
    process.stdout.write('Test user NOT FOUND after reload!\n');
  }

  // Verify password works
  var userRow = db2.exec("SELECT password_hash FROM users WHERE email = '" + email + "'");
  if (userRow.length > 0) {
    var valid = bcrypt.compareSync('TestPass123', userRow[0].values[0][0]);
    process.stdout.write('Password verification: ' + (valid ? 'PASS' : 'FAIL') + '\n');
  }

  // Clean up test file
  db2.close();
  fs.unlinkSync(testPath);
  process.stdout.write('Cleanup done\n');
}

run().catch(function(e) { process.stderr.write('Error: ' + e.message + '\n'); });
