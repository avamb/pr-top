const { exec } = require('child_process');

// Kill all node processes on ports 3000, 5173, 5174
const ports = [3000, 5173, 5174];
const isWin = process.platform === 'win32';

async function killPort(port) {
  return new Promise((resolve) => {
    if (isWin) {
      exec('netstat -ano | findstr :' + port, (err, stdout) => {
        if (stdout) {
          const lines = stdout.trim().split('\n');
          const pids = new Set();
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0') pids.add(pid);
          }
          for (const pid of pids) {
            try {
              exec('taskkill /PID ' + pid + ' /F', (e, o) => {
                console.log('Killed PID ' + pid + ' on port ' + port + ':', o || e);
              });
            } catch(e) {}
          }
        }
        resolve();
      });
    } else {
      exec('lsof -ti :' + port, (err, stdout) => {
        if (stdout) {
          const pids = stdout.trim().split('\n');
          for (const pid of pids) {
            try { process.kill(parseInt(pid)); console.log('Killed', pid); } catch(e) {}
          }
        }
        resolve();
      });
    }
  });
}

async function main() {
  for (const p of ports) {
    await killPort(p);
  }
  console.log('Done killing. Wait 2s...');
  await new Promise(r => setTimeout(r, 2000));
  console.log('Ports cleared.');
}

main();
