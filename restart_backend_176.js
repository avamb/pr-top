var exec = require('child_process').exec;

// Kill existing backend on port 3001
exec('node -e "var http=require(\'http\');var r=http.request({hostname:\'127.0.0.1\',port:3001,path:\'/api/admin/shutdown\',method:\'POST\'},()=>{});r.on(\'error\',()=>{});r.end()"', function() {
  // Find and kill process on port 3001
  exec('taskkill /F /FI "WINDOWTITLE eq node*" 2>nul', function() {
    setTimeout(function() {
      // Start backend
      var child = exec('npm run dev --prefix src/backend');
      child.stdout.on('data', function(d) { process.stdout.write(d); });
      child.stderr.on('data', function(d) { process.stderr.write(d); });
      setTimeout(function() { process.exit(0); }, 5000);
    }, 1000);
  });
});
