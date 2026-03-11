var initSqlJs = require('./src/backend/node_modules/sql.js');
var fs = require('fs');
var path = require('path');

async function verify() {
  var SQL = await initSqlJs();
  var dbPath = path.join(__dirname, 'src/backend/data/psylink.db');
  var buf = fs.readFileSync(dbPath);
  var db = new SQL.Database(buf);

  // Check sos_events
  var result = db.exec("SELECT id, client_id, therapist_id, message_encrypted, encryption_key_id, status, created_at FROM sos_events ORDER BY id");
  if (result.length > 0) {
    var cols = result[0].columns;
    process.stdout.write("SOS Events:\n");
    result[0].values.forEach(function(row) {
      var obj = {};
      cols.forEach(function(c, i) { obj[c] = row[i]; });
      process.stdout.write(JSON.stringify(obj) + "\n");
    });
  } else {
    process.stdout.write("No SOS events found\n");
  }

  // Check audit logs for SOS
  var auditResult = db.exec("SELECT id, actor_id, action, target_type, target_id FROM audit_logs WHERE action LIKE 'sos_%' ORDER BY id");
  if (auditResult.length > 0) {
    process.stdout.write("\nAudit Logs (SOS):\n");
    auditResult[0].values.forEach(function(row) {
      process.stdout.write(JSON.stringify({id: row[0], actor_id: row[1], action: row[2], target_type: row[3], target_id: row[4]}) + "\n");
    });
  }

  db.close();
}
verify();
