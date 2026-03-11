const http = require('http');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjM3NiwiZW1haWwiOiJmZWF0NjR0QHRlc3QuY29tIiwicm9sZSI6InRoZXJhcGlzdCIsImlhdCI6MTc3MzI0ODAwOCwiZXhwIjoxNzczMzM0NDA4fQ.rjHSI_eMSiYMrFiWUkbeoGc81rFHhdGx4QtwZPBIEE8';
const CLIENT_ID = 377;

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const headers = { 'Authorization': 'Bearer ' + TOKEN };
    let data;
    if (body) {
      data = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request({hostname:'localhost',port:3001,path:urlPath,method,headers}, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
        try { resolve({status:res.statusCode,body:JSON.parse(d)}); }
        catch(e) { resolve({status:res.statusCode,body:{raw:d}}); }
      });
    });
    req.on('error',reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Create several notes with distinct keywords
  const notes = [
    'Client shows significant progress with anxiety management techniques',
    'Discussed sleep hygiene SEARCHABLE_KEYWORD_ABC and bedtime routine',
    'Client reported feeling overwhelmed at work, discussed coping strategies',
    'Follow-up on breathing exercises SEARCHABLE_KEYWORD_ABC from last session',
    'Client exploring relationship dynamics with family members'
  ];

  for (const note of notes) {
    const r = await request('POST', `/api/clients/${CLIENT_ID}/notes`, { content: note });
    console.log('Create note:', r.status, note.substring(0, 50));
  }

  // Fetch all notes
  const all = await request('GET', `/api/clients/${CLIENT_ID}/notes`);
  console.log('\nAll notes:', all.body.total, 'total');

  // Search for keyword
  const search1 = await request('GET', `/api/clients/${CLIENT_ID}/notes?search=SEARCHABLE_KEYWORD_ABC`);
  console.log('Search "SEARCHABLE_KEYWORD_ABC":', search1.body.total, 'results');
  search1.body.notes.forEach(n => console.log('  -', n.content.substring(0, 60)));

  // Search for anxiety
  const search2 = await request('GET', `/api/clients/${CLIENT_ID}/notes?search=anxiety`);
  console.log('Search "anxiety":', search2.body.total, 'results');
  search2.body.notes.forEach(n => console.log('  -', n.content.substring(0, 60)));

  // Search for non-existent keyword
  const search3 = await request('GET', `/api/clients/${CLIENT_ID}/notes?search=zzzznonexistent`);
  console.log('Search "zzzznonexistent":', search3.body.total, 'results');

  console.log('\nDone!');
}

main().catch(e => console.error('Error:', e));
