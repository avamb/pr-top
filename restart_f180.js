// Kill port 3001 and restart backend
async function run() {
  try {
    await fetch('http://localhost:3001/api/health');
    console.log('Backend already running, restarting...');
  } catch(e) {
    console.log('Backend not running');
  }

  // Touch a file to trigger nodemon restart
  require('fs').writeFileSync('src/backend/src/.restart-trigger', Date.now().toString());
  console.log('Triggered nodemon restart');
}
run();
