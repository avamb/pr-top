// Kill node processes using cmd taskkill
var exec = require('child_process').execSync;
var spawn = require('child_process').spawn;

var ports = [3001, 3000];

ports.forEach(function(port) {
  try {
    var r = exec('cmd /c "netstat -ano | findstr :' + port + ' | findstr LISTENING"', { encoding: 'utf8', maxBuffer: 64 * 1024 });
    var pids = new Set();
    r.trim().split('\n').forEach(function(line) {
      var parts = line.trim().split(/\s+/);
      var pid = parts[parts.length - 1];
      if (pid && !isNaN(parseInt(pid)) && parseInt(pid) > 0) pids.add(pid);
    });
    pids.forEach(function(pid) {
      try {
        exec('cmd /c "taskkill /F /PID ' + pid + '"', { encoding: 'utf8' });
        process.stdout.write('Killed PID ' + pid + ' on port ' + port + '\n');
      } catch(e) {
        process.stdout.write('taskkill failed for ' + pid + ': ' + e.message.substring(0, 80) + '\n');
      }
    });
  } catch(e) {
    process.stdout.write('No LISTENING on port ' + port + '\n');
  }
});

process.stdout.write('Waiting 3s...\n');
setTimeout(function() {
  process.stdout.write('Starting backend...\n');
  var be = spawn('node', ['src/backend/src/index.js'], {
    stdio: 'ignore', detached: true, shell: true
  });
  be.unref();
  process.stdout.write('Backend PID: ' + be.pid + '\n');

  setTimeout(function() {
    process.stdout.write('Starting frontend...\n');
    var fe = spawn('npm', ['run', 'dev', '--prefix', 'src/frontend'], {
      stdio: 'ignore', detached: true, shell: true
    });
    fe.unref();
    process.stdout.write('Done.\n');
  }, 1000);
}, 3000);
