const { execSync } = require('child_process');
try {
  // Windows: find and kill node processes with vite in command line
  const result = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /V', { encoding: 'utf8' });
  const lines = result.split('\n');
  for (const line of lines) {
    if (line.includes('vite')) {
      const pid = line.split(',')[1]?.replace(/"/g, '');
      if (pid) {
        try { execSync('taskkill /PID ' + pid + ' /F'); console.log('Killed PID', pid); }
        catch(e) { console.log('Failed to kill', pid); }
      }
    }
  }
} catch(e) {}

// Also try via netstat for port 3004
try {
  const ns = execSync('netstat -ano | findstr :3004', { encoding: 'utf8' });
  const pids = new Set();
  for (const line of ns.split('\n')) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && !isNaN(pid) && pid !== '0') pids.add(pid);
  }
  for (const pid of pids) {
    try { execSync('taskkill /PID ' + pid + ' /F'); console.log('Killed port 3004 PID', pid); }
    catch(e) {}
  }
} catch(e) {}
console.log('Done');
