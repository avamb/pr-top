const { execSync, spawn } = require('child_process');
const http = require('http');
const path = require('path');

// Kill backend on port 3001
function killPort(port) {
  try {
    const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
    const lines = result.trim().split('\n');
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf8' });
        console.log('Killed PID:', pid);
      } catch (e) {
        console.log('Could not kill PID:', pid);
      }
    }
  } catch (e) {
    console.log('No process on port', port);
  }
}

killPort(3001);

// Wait a moment then start backend
setTimeout(() => {
  const backendDir = path.join(__dirname, 'src', 'backend');
  const child = spawn('npm', ['run', 'dev'], {
    cwd: backendDir,
    stdio: 'ignore',
    detached: true,
    shell: true
  });
  child.unref();
  console.log('Backend starting...');

  // Wait for it to be ready
  let attempts = 0;
  const check = setInterval(() => {
    attempts++;
    const req = http.request({ hostname: 'localhost', port: 3001, path: '/api/health', method: 'GET' }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log('Backend ready:', body.substring(0, 50));
        clearInterval(check);
      });
    });
    req.on('error', () => {
      if (attempts > 30) {
        console.log('Backend failed to start after 30 attempts');
        clearInterval(check);
      }
    });
    req.end();
  }, 1000);
}, 2000);
