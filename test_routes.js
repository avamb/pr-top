var r = require('./src/backend/src/routes/bot');
var routes = [];
r.stack.forEach(function(layer) {
  if (layer.route) {
    routes.push(layer.route.path + ' ' + Object.keys(layer.route.methods));
  }
});
process.stdout.write(JSON.stringify(routes, null, 2));
