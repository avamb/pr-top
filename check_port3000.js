const net = require('net');
const s = net.createServer();
s.on('error', e => { console.log('Port 3000 in use:', e.code); process.exit(1); });
s.listen(3000, () => { console.log('Port 3000 is free'); s.close(); });
