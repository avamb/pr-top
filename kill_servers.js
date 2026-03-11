var exec = require('child_process').execSync;
try {
  var r = exec('taskkill /F /IM node.exe', { encoding: 'utf8' });
  console.log(r);
} catch(e) {
  console.log(e.stderr || e.message);
}
