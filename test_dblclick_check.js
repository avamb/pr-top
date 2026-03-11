var http = require('http');

var req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, function(res) {
  var data = '';
  res.on('data', function(c) { data += c; });
  res.on('end', function() {
    var parsed = JSON.parse(data);
    var token = parsed.token;

    var req2 = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/admin/stats/users',
      headers: { Authorization: 'Bearer ' + token }
    }, function(res2) {
      var d2 = '';
      res2.on('data', function(c) { d2 += c; });
      res2.on('end', function() {
        var stats = JSON.parse(d2);
        console.log('Total users:', stats.total_users || stats.users);

        var req3 = http.request({
          hostname: 'localhost',
          port: 3001,
          path: '/api/admin/therapists',
          headers: { Authorization: 'Bearer ' + token }
        }, function(res3) {
          var d3 = '';
          res3.on('data', function(c) { d3 += c; });
          res3.on('end', function() {
            var therapists = JSON.parse(d3);
            var dblclickUsers = (therapists.therapists || []).filter(function(t) {
              return t.email === 'dblclickfinal@test.com';
            });
            console.log('Accounts with dblclickfinal@test.com:', dblclickUsers.length);
            if (dblclickUsers.length === 1) {
              console.log('PASS: Only one account created despite double-click');
            } else {
              console.log('FAIL: Expected 1 account, found', dblclickUsers.length);
            }
          });
        });
        req3.end();
      });
    });
    req2.end();
  });
});

req.write(JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' }));
req.end();
