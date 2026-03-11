// Restart backend by killing old process and starting new one
var exec = require('child_process').execSync;
var spawn = require('child_process').spawn;

// Find and kill process on port 3001
try {
  var result = exec('netstat -ano | findstr :3001 | findstr LISTENING', { encoding: 'utf8' });
  var lines = result.trim().split('\n');
  var pids = new Set();
  lines.forEach(function(line) {
    var parts = line.trim().split(/\s+/);
    var pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  });
  pids.forEach(function(pid) {
    try {
      exec('kill ' + pid);
      console.log('Killed PID:', pid);
    } catch(e) {
      console.log('Could not kill PID ' + pid + ':', e.message);
    }
  });
} catch(e) {
  console.log('No process found on port 3001 or error:', e.message);
}

// Wait a moment
setTimeout(function() {
  console.log('Starting backend...');
  var child = spawn('npm', ['run', 'dev', '--prefix', 'src/backend'], {
    stdio: 'ignore',
    detached: true,
    shell: true
  });
  child.unref();
  console.log('Backend started with PID:', child.pid);

  // Also restart frontend
  try {
    var result2 = exec('netstat -ano | findstr :3000 | findstr LISTENING', { encoding: 'utf8' });
    var lines2 = result2.trim().split('\n');
    var pids2 = new Set();
    lines2.forEach(function(line) {
      var parts = line.trim().split(/\s+/);
      var pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids2.add(pid);
    });
    pids2.forEach(function(pid) {
      try {
        exec('kill ' + pid);
        console.log('Killed frontend PID:', pid);
      } catch(e) {}
    });
  } catch(e) {}

  setTimeout(function() {
    var child2 = spawn('npm', ['run', 'dev', '--prefix', 'src/frontend'], {
      stdio: 'ignore',
      detached: true,
      shell: true
    });
    child2.unref();
    console.log('Frontend started with PID:', child2.pid);
    console.log('Waiting 5s for servers to start...');
  }, 1000);
}, 2000);
