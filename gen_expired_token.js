var jwt = require('./src/backend/node_modules/jsonwebtoken');
var secret = 'dev-jwt-secret-change-in-production';
// Token that expired 1 hour ago
var token = jwt.sign({ userId: 999, iat: Math.floor(Date.now()/1000) - 7200 }, secret, { expiresIn: '1h' });
process.stdout.write(token);
