const http = require('http');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjM3NiwiZW1haWwiOiJmZWF0NjR0QHRlc3QuY29tIiwicm9sZSI6InRoZXJhcGlzdCIsImlhdCI6MTc3MzI0ODAwOCwiZXhwIjoxNzczMzM0NDA4fQ.rjHSI_eMSiYMrFiWUkbeoGc81rFHhdGx4QtwZPBIEE8';
const CLIENT_ID = 377;

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

function uploadSession(clientId) {
  return new Promise((resolve, reject) => {
    // Create a minimal WAV file
    const dummyAudio = Buffer.from('RIFF____WAVEfmt ________________data________', 'ascii');
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

    const parts = [];
    // client_id field
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n${clientId}\r\n`));
    // audio file
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="test_session.wav"\r\nContent-Type: audio/wav\r\n\r\n`));
    parts.push(dummyAudio);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const fullBody = Buffer.concat(parts);

    const req = http.request({
      hostname: 'localhost', port: 3001,
      path: '/api/sessions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': fullBody.length
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({status: res.statusCode, body: JSON.parse(d)}); }
        catch(e) { resolve({status: res.statusCode, body: {raw: d}}); }
      });
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

async function main() {
  console.log('=== Feature #64: Session Detail Page Test Setup ===');

  // Check existing sessions first
  const sessRes = await get('/api/clients/' + CLIENT_ID + '/sessions');
  console.log('Existing sessions:', sessRes.status, JSON.stringify(sessRes.body).substring(0, 300));

  let sessionId = null;

  // Check if there's already a complete session
  if (sessRes.body.sessions && sessRes.body.sessions.length > 0) {
    const complete = sessRes.body.sessions.find(s => s.status === 'complete');
    if (complete) {
      sessionId = complete.id;
      console.log('Found existing complete session:', sessionId);
    }
  }

  if (!sessionId) {
    // Upload a new session
    console.log('Uploading new session audio...');
    const uploadRes = await uploadSession(CLIENT_ID);
    console.log('Upload result:', uploadRes.status, JSON.stringify(uploadRes.body));

    if (uploadRes.body.id) {
      sessionId = uploadRes.body.id;

      // Wait for auto-transcription + summarization
      console.log('Waiting for transcription pipeline...');
      await new Promise(r => setTimeout(r, 4000));

      // Trigger summarization manually if needed
      const checkRes = await get('/api/sessions/' + sessionId);
      console.log('After wait - status:', checkRes.body.status, 'has_transcript:', checkRes.body.has_transcript, 'has_summary:', checkRes.body.has_summary);

      if (checkRes.body.has_transcript && !checkRes.body.has_summary) {
        console.log('Triggering summarization...');
        const sumRes = await post('/api/sessions/' + sessionId + '/summarize', {});
        console.log('Summarize result:', sumRes.status, JSON.stringify(sumRes.body));
        await new Promise(r => setTimeout(r, 2000));
      }

      if (!checkRes.body.has_transcript) {
        console.log('Triggering transcription manually...');
        const trRes = await post('/api/sessions/' + sessionId + '/transcribe', {});
        console.log('Transcribe result:', trRes.status, JSON.stringify(trRes.body));
        await new Promise(r => setTimeout(r, 2000));

        // Now try summarize
        const sumRes = await post('/api/sessions/' + sessionId + '/summarize', {});
        console.log('Summarize result:', sumRes.status, JSON.stringify(sumRes.body));
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  // Final check
  if (sessionId) {
    const finalRes = await get('/api/sessions/' + sessionId);
    console.log('\n=== FINAL SESSION STATE ===');
    console.log('Status:', finalRes.status);
    console.log('Session ID:', finalRes.body.id);
    console.log('Audio ref:', finalRes.body.audio_ref);
    console.log('Has transcript:', finalRes.body.has_transcript);
    console.log('Has summary:', finalRes.body.has_summary);
    console.log('Session status:', finalRes.body.status);
    if (finalRes.body.transcript) console.log('Transcript:', finalRes.body.transcript.substring(0, 200));
    if (finalRes.body.summary) console.log('Summary:', finalRes.body.summary.substring(0, 200));
    console.log('\nSESSION_ID=' + sessionId);
  }

  console.log('THERAPIST_EMAIL=feat64t@test.com');
  console.log('THERAPIST_PASSWORD=Test1234!');
}

main().catch(e => console.error('Error:', e));
