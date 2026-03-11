const http = require('http');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjM3NiwiZW1haWwiOiJmZWF0NjR0QHRlc3QuY29tIiwicm9sZSI6InRoZXJhcGlzdCIsImlhdCI6MTc3MzI0ODAwOCwiZXhwIjoxNzczMzM0NDA4fQ.rjHSI_eMSiYMrFiWUkbeoGc81rFHhdGx4QtwZPBIEE8';

function get(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({hostname:'localhost',port:3001,path:urlPath,method:'GET',headers:{'Authorization':'Bearer '+TOKEN}}, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
        try { resolve({status:res.statusCode,body:JSON.parse(d)}); }
        catch(e) { resolve({status:res.statusCode,body:{raw:d}}); }
      });
    });
    req.on('error',reject);
    req.end();
  });
}

function post(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({hostname:'localhost',port:3001,path:urlPath,method:'POST',headers:{'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}}, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
        try { resolve({status:res.statusCode,body:JSON.parse(d)}); }
        catch(e) { resolve({status:res.statusCode,body:{raw:d}}); }
      });
    });
    req.on('error',reject);
    req.write(data); req.end();
  });
}

async function main() {
  // Check session 5
  const r = await get('/api/sessions/5');
  console.log('Session 5:', JSON.stringify(r, null, 2));

  // Try to manually transcribe
  if (!r.body.has_transcript) {
    console.log('Trying manual transcription...');
    const tr = await post('/api/sessions/5/transcribe', {});
    console.log('Transcribe:', JSON.stringify(tr, null, 2));

    // Wait and re-check
    await new Promise(r => setTimeout(r, 3000));
    const r2 = await get('/api/sessions/5');
    console.log('Session 5 after transcribe:', JSON.stringify(r2, null, 2));
  }

  // Try to summarize if transcript exists but no summary
  const r3 = await get('/api/sessions/5');
  if (r3.body.has_transcript && !r3.body.has_summary) {
    console.log('Trying manual summarization...');
    const sm = await post('/api/sessions/5/summarize', {});
    console.log('Summarize:', JSON.stringify(sm, null, 2));
    await new Promise(r => setTimeout(r, 2000));
    const r4 = await get('/api/sessions/5');
    console.log('Final:', JSON.stringify(r4, null, 2));
  }
}

main().catch(e => console.error('Error:', e));
