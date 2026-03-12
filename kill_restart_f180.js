var exec = require('child_process').execSync;
try {
  // Windows: find and kill node processes on port 3001
  var result = exec('netstat -ano | findstr :3001 | findstr LISTENING', {encoding: 'utf8'});
  var lines = result.trim().split('\n');
  var pids = new Set();
  lines.forEach(function(line) {
    var parts = line.trim().split(/\s+/);
    var pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  });
  pids.forEach(function(pid) {
    try {
      exec('taskkill /F /PID ' + pid);
      console.log('Killed PID:', pid);
    } catch(e) { console.log('Failed to kill PID', pid); }
  });
} catch(e) {
  console.log('No process on 3001');
}
console.log('Port 3001 cleared');
