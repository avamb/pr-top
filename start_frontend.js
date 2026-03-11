const { execSync } = require('child_process');
const http = require('http');

// Check ports
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:' + port, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

async function main() {
  const ports = [3000, 3001, 5173, 5174, 8080];
  for (const p of ports) {
    const alive = await checkPort(p);
    if (alive) console.log('Port ' + p + ': ACTIVE');
  }
}

main();
