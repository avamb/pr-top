var execSync = require('child_process').execSync;

// On Windows, use taskkill to kill node processes
try {
  // First verify server is running
  var http = require('http');
  var req = http.get('http://localhost:3001/api/health', function(res) {
    console.log('Server is running (status ' + res.statusCode + ')');
    req.destroy();
    killIt();
  });
  req.on('error', function() {
    console.log('Server is not running');
  });
  req.setTimeout(2000, function() {
    console.log('Server not responding');
    req.destroy();
  });
} catch(e) {
  console.log('Error checking server:', e.message);
}

function killIt() {
  try {
    execSync('taskkill /F /IM node.exe', { encoding: 'utf8', stdio: 'pipe' });
    console.log('Killed all node processes');
  } catch(e) {
    console.log('taskkill result:', e.message);
  }
}
