var exec = require('child_process').exec;

// Kill existing backend on port 3001
exec('netstat -ano | findstr :3001 | findstr LISTENING', function(err, stdout) {
  if (stdout) {
    var lines = stdout.trim().split('\n');
    var pids = [];
    lines.forEach(function(line) {
      var parts = line.trim().split(/\s+/);
      var pid = parts[parts.length - 1];
      if (pid && pids.indexOf(pid) === -1) pids.push(pid);
    });
    console.log('Killing PIDs:', pids.join(', '));
    pids.forEach(function(pid) {
      try { exec('taskkill /F /PID ' + pid); } catch(e) {}
    });
    setTimeout(startBackend, 2000);
  } else {
    startBackend();
  }
});

function startBackend() {
  console.log('Starting backend...');
  var child = exec('npm run dev --prefix src/backend');
  child.stdout.on('data', function(d) { process.stdout.write(d); });
  child.stderr.on('data', function(d) { process.stderr.write(d); });
  setTimeout(function() {
    console.log('\nBackend should be running. Testing...');
    var http = require('http');
    http.get('http://127.0.0.1:3001/api/health', function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() { console.log('Health:', data); process.exit(0); });
    }).on('error', function(e) { console.log('Not ready yet:', e.message); process.exit(1); });
  }, 5000);
}
