const { execSync } = require('child_process');

function killPort(port) {
  const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
  const lines = result.trim().split('\n');
  lines.forEach(l => {
    const parts = l.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') {
      execSync(`taskkill /F /PID ${pid}`);
      console.log('Killed PID:', pid);
    }
  });
}

killPort(3001);
