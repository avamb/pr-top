var exec = require('child_process').execSync;
try {
  var r = exec('netstat -ano | findstr :3001 | findstr LISTENING', { encoding: 'utf8' });
  var pids = new Set();
  r.trim().split('\n').forEach(function(l) {
    var p = l.trim().split(/\s+/).pop();
    if (p && p !== '0') pids.add(p);
  });
  pids.forEach(function(p) {
    try { exec('taskkill /F /PID ' + p); } catch(e) {}
    console.log('killed', p, 'on port 3001');
  });
} catch(e) {
  console.log('nothing on 3001');
}
