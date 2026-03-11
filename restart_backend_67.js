const { execSync } = require('child_process');

// Kill existing node processes on port 3001
try {
  const result = execSync('netstat -ano | findstr :3001 | findstr LISTENING', { encoding: 'utf8' });
  const lines = result.trim().split('\n');
  const pids = new Set();
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  }
  for (const pid of pids) {
    try {
      execSync('taskkill /PID ' + pid + ' /F', { encoding: 'utf8' });
      console.log('Killed PID', pid);
    } catch(e) {}
  }
} catch(e) {
  console.log('No process on 3001');
}

// Start backend
const { spawn } = require('child_process');
const child = spawn('node', ['src/index.js'], {
  cwd: __dirname + '/src/backend',
  detached: true,
  stdio: 'ignore',
  env: { ...process.env }
});
child.unref();
console.log('Backend restarted, PID:', child.pid);

setTimeout(() => process.exit(0), 1000);
