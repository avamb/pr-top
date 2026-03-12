var spawn = require('child_process').spawn;
var path = require('path');

// Start backend
var backend = spawn('node', ['src/index.js'], {
  cwd: path.join(__dirname, 'src', 'backend'),
  stdio: 'inherit',
  detached: true
});
backend.unref();
console.log('Backend started, PID:', backend.pid);

// Start frontend after short delay
setTimeout(function() {
  var frontend = spawn('npx', ['vite', '--port', '3000'], {
    cwd: path.join(__dirname, 'src', 'frontend'),
    stdio: 'inherit',
    detached: true,
    shell: true
  });
  frontend.unref();
  console.log('Frontend started, PID:', frontend.pid);
}, 3000);
