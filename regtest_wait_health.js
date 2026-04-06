const http = require('http');

function checkHealth(port, retries) {
  return new Promise((resolve) => {
    if (retries <= 0) { resolve(false); return; }
    const req = http.get('http://localhost:' + port + '/api/health', { timeout: 2000 }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { console.log('Port ' + port + ' (' + res.statusCode + '):', d); resolve(true); });
    });
    req.on('error', () => {
      setTimeout(() => checkHealth(port, retries - 1).then(resolve), 1000);
    });
    req.on('timeout', () => {
      req.destroy();
      setTimeout(() => checkHealth(port, retries - 1).then(resolve), 1000);
    });
  });
}

checkHealth(3001, 8).then(ok => {
  if (!ok) console.log('Server not available on port 3001');
  process.exit(ok ? 0 : 1);
});
