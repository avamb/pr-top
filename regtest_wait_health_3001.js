const http = require('http');

function checkHealth(attempt) {
  if (attempt > 30) {
    console.log('TIMEOUT: Server did not start after 30 attempts');
    process.exit(1);
  }

  const req = http.get('http://localhost:3001/api/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Server is ready! Response:', data);
      process.exit(0);
    });
  });

  req.on('error', () => {
    setTimeout(() => checkHealth(attempt + 1), 1000);
  });

  req.setTimeout(2000, () => {
    req.destroy();
    setTimeout(() => checkHealth(attempt + 1), 1000);
  });
}

checkHealth(1);
