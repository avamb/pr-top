const http = require('http');
http.get('http://localhost:3001/api/auth/csrf-token', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data);
    console.log('Cookies:', JSON.stringify(res.headers['set-cookie']));
  });
});
