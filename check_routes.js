var router = require('./src/backend/src/routes/bot');
var stack = router.stack || [];
stack.forEach(function(layer) {
  if (layer.route) {
    process.stdout.write(layer.route.path + ' ' + Object.keys(layer.route.methods).join(',') + '\n');
  }
});
