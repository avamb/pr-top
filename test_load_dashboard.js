try {
  require('./src/backend/src/routes/dashboard.js');
  process.stdout.write('Dashboard routes loaded OK\n');
} catch(e) {
  process.stdout.write('Error: ' + e.message + '\n');
  process.stdout.write(e.stack + '\n');
}
