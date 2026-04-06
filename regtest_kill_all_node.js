var exec = require('child_process').execSync;

// Find all node processes
try {
  var out = exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', { encoding: 'utf8' });
  var lines = out.trim().split('\n');
  var myPid = process.pid;
  console.log('Current process PID:', myPid);
  console.log('All node processes:');

  var pidsToKill = [];
  lines.forEach(function(line) {
    if (!line.trim()) return;
    var parts = line.split(',');
    if (parts.length >= 2) {
      var pid = parseInt(parts[1].replace(/"/g, ''));
      console.log('  PID:', pid, line.trim());
      if (pid !== myPid) {
        pidsToKill.push(pid);
      }
    }
  });

  console.log('\nKilling all node processes except self...');
  pidsToKill.forEach(function(pid) {
    try {
      exec('taskkill /PID ' + pid + ' /F', { encoding: 'utf8' });
      console.log('  Killed PID', pid);
    } catch(e) {
      console.log('  Could not kill PID', pid, ':', e.message.split('\n')[0]);
    }
  });
} catch(e) {
  console.log('Error:', e.message);
}
