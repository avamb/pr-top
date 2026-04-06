var fs = require('fs');
var f = process.argv[2];
var d = fs.readFileSync(f, 'utf8');
var lines = d.split('\n');
lines.slice(-50).forEach(function(l) { process.stdout.write(l + '\n'); });
