const { execSync } = require('child_process');
[3000, 3001].forEach(port => {
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
    out.trim().split('\n').forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        try { execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' }); console.log(`Killed PID ${pid} on port ${port}`); } catch(e) {}
      }
    });
  } catch(e) { console.log(`No process on port ${port}`); }
});
