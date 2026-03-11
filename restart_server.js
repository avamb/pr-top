// Restart backend server by killing the process on port 3001 and starting a new one
const { execSync, spawn } = require('child_process');
const path = require('path');

// Find and kill process on port 3001
try {
  const result = execSync('netstat -ano | findstr :3001 | findstr LISTENING', { encoding: 'utf-8' });
  const lines = result.trim().split('\n');
  const pids = new Set();
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') pids.add(pid);
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf-8' });
      console.log('Killed PID:', pid);
    } catch (e) {
      console.log('Could not kill PID:', pid, e.message);
    }
  }
} catch (e) {
  console.log('No process found on port 3001 or error:', e.message);
}

// Wait a moment then start new server
setTimeout(() => {
  console.log('Starting backend server...');
  const backendDir = path.join(__dirname, 'src', 'backend');
  const child = spawn('node', ['src/index.js'], {
    cwd: backendDir,
    stdio: 'inherit',
    detached: true,
    env: { ...process.env }
  });
  child.unref();
  console.log('Backend server started with PID:', child.pid);

  // Wait for server to be ready
  setTimeout(() => {
    const http = require('http');
    http.get('http://localhost:3001/api/health', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('Health check:', data);
        process.exit(0);
      });
    }).on('error', (e) => {
      console.log('Server not ready yet:', e.message);
      process.exit(1);
    });
  }, 3000);
}, 1000);
