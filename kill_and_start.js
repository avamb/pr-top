const { execSync } = require('child_process');
// Find and kill node processes on ports 3000 and 3001
try {
  const result = execSync('lsof -ti:3001', { encoding: 'utf8' }).trim();
  if (result) {
    result.split('\n').forEach(pid => {
      try { process.kill(parseInt(pid), 'SIGTERM'); } catch(e) {}
    });
  }
} catch(e) {}
try {
  const result = execSync('lsof -ti:3000', { encoding: 'utf8' }).trim();
  if (result) {
    result.split('\n').forEach(pid => {
      try { process.kill(parseInt(pid), 'SIGTERM'); } catch(e) {}
    });
  }
} catch(e) {}
console.log('Ports cleared');
