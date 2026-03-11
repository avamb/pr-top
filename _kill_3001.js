const { exec } = require('child_process');
exec('netstat -ano | findstr :3001', (err, stdout) => {
  if (stdout) {
    const pids = new Set();
    for (const line of stdout.trim().split('\n')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      exec('taskkill /PID ' + pid + ' /F', (e, o) => {
        console.log('Killed PID ' + pid + ':', (o||'').trim() || (e&&e.message));
      });
    }
  } else {
    console.log('Port 3001 is free');
  }
});
