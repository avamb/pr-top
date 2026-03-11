// Force kill processes by port and restart servers
var exec = require('child_process').execSync;
var spawn = require('child_process').spawn;

function killByPort(port) {
  try {
    // Windows: use findstr with netstat
    var result = exec('netstat -ano | findstr :' + port, { encoding: 'utf8' });
    var lines = result.trim().split('\n');
    var pids = new Set();
    lines.forEach(function(line) {
      var parts = line.trim().split(/\s+/);
      var pid = parts[parts.length - 1];
      if (pid && pid !== '0' && !isNaN(parseInt(pid))) {
        pids.add(pid);
      }
    });
    pids.forEach(function(pid) {
      try {
        exec('kill -9 ' + pid);
        process.stdout.write('Killed PID ' + pid + ' on port ' + port + '\n');
      } catch(e) {
        try {
          exec('kill ' + pid);
          process.stdout.write('Killed PID ' + pid + ' on port ' + port + '\n');
        } catch(e2) {
          process.stdout.write('Could not kill PID ' + pid + ': ' + e2.message + '\n');
        }
      }
    });
  } catch(e) {
    process.stdout.write('No process on port ' + port + '\n');
  }
}

killByPort(3001);
killByPort(3000);

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
    process.stdout.write('Frontend PID: ' + fe.pid + '\n');
    process.stdout.write('Waiting 5s for servers...\n');
  }, 1000);
}, 3000);
