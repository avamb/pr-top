var exec = require('child_process').execSync;
[3000, 3001].forEach(function(port) {
  try {
    var r = exec('netstat -ano | findstr :' + port + ' | findstr LISTENING', { encoding: 'utf8' });
    var pids = new Set();
    r.trim().split('\n').forEach(function(l) {
      var p = l.trim().split(/\s+/).pop();
      if (p && p !== '0') pids.add(p);
    });
    pids.forEach(function(p) {
      try { exec('taskkill /F /PID ' + p); } catch(e) {}
      console.log('killed', p, 'on port', port);
    });
  } catch(e) {
    console.log('nothing on', port);
  }
});
