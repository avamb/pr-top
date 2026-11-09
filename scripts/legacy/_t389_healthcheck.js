'use strict';
const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3001' + path, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

get('/api/health').then(r => {
  console.log('Backend status:', r.status, JSON.stringify(r.body).substring(0, 100));
}).catch(e => {
  console.error('Backend DOWN:', e.message);
});
