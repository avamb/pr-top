var fs = require('fs');
var path = require('path');

var dbPath = path.join(__dirname, 'src', 'backend', 'data', 'prtop.db');

console.log('Watching DB file for modifications...');
console.log('Path:', dbPath);

var lastSize = fs.statSync(dbPath).size;
var lastMtime = fs.statSync(dbPath).mtime.getTime();

fs.watchFile(dbPath, { interval: 500 }, function(curr, prev) {
  if (curr.mtime.getTime() !== prev.mtime.getTime()) {
    console.log('[' + new Date().toISOString() + '] FILE CHANGED:');
    console.log('  Size: ' + prev.size + ' -> ' + curr.size);
    console.log('  Modified: ' + prev.mtime.toISOString() + ' -> ' + curr.mtime.toISOString());
  }
});

// Stop watching after 20 seconds
setTimeout(function() {
  fs.unwatchFile(dbPath);
  console.log('Done watching');
  process.exit(0);
}, 20000);
