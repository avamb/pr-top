// Kill whatever is on port 3001 and restart
var exec = require('child_process').execSync;
try {
  // Try to find process on port 3001 (Windows)
  var result = exec('netstat -ano | findstr :3001 | findstr LISTENING', { encoding: 'utf8' });
  process.stdout.write('Port 3001 listeners:\n' + result + '\n');
  // Extract PIDs
  var lines = result.trim().split('\n');
  var pids = new Set();
  lines.forEach(function(line) {
    var parts = line.trim().split(/\s+/);
    var pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  });
  pids.forEach(function(pid) {
    process.stdout.write('Killing PID: ' + pid + '\n');
    try { exec('taskkill /F /PID ' + pid); } catch(e) { process.stdout.write('Failed: ' + e.message + '\n'); }
  });
} catch(e) {
  process.stdout.write('No process found on 3001 or error: ' + e.message + '\n');
}
