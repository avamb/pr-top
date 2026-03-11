const http = require('http');

// First login to get a fresh token
function post(urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const hdrs = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers };
    const req = http.request({hostname:'localhost',port:3001,path:urlPath,method:'POST',headers:hdrs}, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
        try { resolve({status:res.statusCode,body:JSON.parse(d)}); }
        catch(e) { resolve({status:res.statusCode,body:{raw:d}}); }
      });
    });
    req.on('error',reject);
    req.write(data); req.end();
  });
}

function get(urlPath, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({hostname:'localhost',port:3001,path:urlPath,method:'GET',headers:{'Authorization':'Bearer '+token}}, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
        try { resolve({status:res.statusCode,body:JSON.parse(d)}); }
        catch(e) { resolve({status:res.statusCode,body:{raw:d}}); }
      });
    });
    req.on('error',reject);
    req.end();
  });
}

async function main() {
  // Get CSRF token first
  const csrfRes = await get('/api/csrf-token', '');
  console.log('CSRF:', csrfRes.body);

  // Login
  const loginRes = await post('/api/auth/login',
    {email:'feat64t@test.com', password:'Test1234!'},
    {'x-csrf-token': csrfRes.body.csrfToken || ''}
  );
  console.log('Login:', loginRes.status);
  const token = loginRes.body.token;

  // Check notes
  const notesRes = await get('/api/clients/377/notes', token);
  console.log('Notes:', notesRes.status, 'total:', notesRes.body.total);
  if (notesRes.body.notes) {
    notesRes.body.notes.forEach(n => console.log('  -', n.id, n.content.substring(0, 60)));
  }

  // Search
  const searchRes = await get('/api/clients/377/notes?search=anxiety', token);
  console.log('Search anxiety:', searchRes.status, 'total:', searchRes.body.total);
  if (searchRes.body.notes) {
    searchRes.body.notes.forEach(n => console.log('  -', n.id, n.content.substring(0, 60)));
  }
}

main().catch(e => console.error(e));
