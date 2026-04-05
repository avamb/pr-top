const http = require('http');

function check(retries) {
  return new Promise((resolve) => {
    if (retries <= 0) { resolve(false); return; }
    const req = http.get('http://localhost:3000', { timeout: 2000 }, (res) => {
      console.log('Frontend responding on port 3000, status:', res.statusCode);
      resolve(true);
    });
    req.on('error', () => {
      setTimeout(() => check(retries - 1).then(resolve), 1500);
    });
    req.on('timeout', () => {
      req.destroy();
      setTimeout(() => check(retries - 1).then(resolve), 1500);
    });
  });
}

check(10).then(ok => {
  if (!ok) console.log('Frontend not available on port 3000');
  else console.log('Frontend is ready');
  process.exit(ok ? 0 : 1);
});
