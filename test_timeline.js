// Test script for timeline feature
const http = require('http');
const fs = require('fs');
const path = require('path');

const TOKEN = process.argv[2];
const CLIENT_ID = 212;
const API = 'http://localhost:3001';

function request(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API + urlPath);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers }
    };

    if (body && !(body instanceof Buffer)) {
      const data = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
      const req = http.request(opts, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode, data: d }); }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    } else {
      // Multipart upload for session audio
      const boundary = '----FormBoundary' + Date.now();
      const audioData = Buffer.from('fake audio content for testing');

      let bodyParts = [];
      // client_id field
      bodyParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="client_id"\r\n\r\n${CLIENT_ID}`);
      // audio file
      bodyParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="test.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`);

      const prefix = Buffer.from(bodyParts.join('\r\n') + '\r\n');
      const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
      const fullBody = Buffer.concat([prefix, audioData, suffix]);

      opts.headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      opts.headers['Content-Length'] = fullBody.length;

      const req = http.request(opts, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
          catch { resolve({ status: res.statusCode, data: d }); }
        });
      });
      req.on('error', reject);
      req.write(fullBody);
      req.end();
    }
  });
}

async function main() {
  console.log('=== Testing Timeline Feature ===\n');

  // 1. Upload a session
  console.log('1. Uploading session audio...');
  const sessionRes = await request('POST', '/api/sessions', Buffer.alloc(0), {
    'Authorization': `Bearer ${TOKEN}`
  });
  console.log('Session upload:', sessionRes.status, JSON.stringify(sessionRes.data).substring(0, 200));

  // 2. Test timeline endpoint
  console.log('\n2. Fetching timeline...');
  const timelineRes = await request('GET', `/api/clients/${CLIENT_ID}/timeline`, null, {
    'Authorization': `Bearer ${TOKEN}`
  });
  console.log('Timeline status:', timelineRes.status);

  if (timelineRes.status === 200) {
    const tl = timelineRes.data;
    console.log('Total items:', tl.total);
    console.log('Timeline items:');
    for (const item of tl.timeline) {
      console.log(`  - [${item.type}] id=${item.id} created_at=${item.created_at}`);
      if (item.type === 'diary') console.log(`    entry_type=${item.entry_type} content=${(item.content || '').substring(0, 50)}`);
      if (item.type === 'note') console.log(`    content=${(item.content || '').substring(0, 50)}`);
      if (item.type === 'session') console.log(`    status=${item.status} has_audio=${item.has_audio} has_transcript=${item.has_transcript}`);
    }

    // Verify types present
    const types = new Set(tl.timeline.map(i => i.type));
    console.log('\nTypes present:', [...types].join(', '));
    console.log('Has diary:', types.has('diary'));
    console.log('Has note:', types.has('note'));

    // Verify chronological order
    let inOrder = true;
    for (let i = 1; i < tl.timeline.length; i++) {
      if (new Date(tl.timeline[i-1].created_at) < new Date(tl.timeline[i].created_at)) {
        inOrder = false;
        break;
      }
    }
    console.log('Chronological order (newest first):', inOrder);

    // Verify type indicators
    const allHaveType = tl.timeline.every(i => i.type);
    console.log('All items have type indicator:', allHaveType);
  } else {
    console.log('ERROR:', JSON.stringify(timelineRes.data));
  }

  // 3. Test date range filter
  console.log('\n3. Testing date range filter...');
  const futureRes = await request('GET', `/api/clients/${CLIENT_ID}/timeline?start_date=2027-01-01`, null, {
    'Authorization': `Bearer ${TOKEN}`
  });
  console.log('Future date filter status:', futureRes.status);
  if (futureRes.status === 200) {
    console.log('Items with future start_date:', futureRes.data.total, '(should be 0)');
  }

  const pastRes = await request('GET', `/api/clients/${CLIENT_ID}/timeline?end_date=2025-01-01`, null, {
    'Authorization': `Bearer ${TOKEN}`
  });
  console.log('Past date filter status:', pastRes.status);
  if (pastRes.status === 200) {
    console.log('Items with past end_date:', pastRes.data.total, '(should be 0)');
  }

  const currentRes = await request('GET', `/api/clients/${CLIENT_ID}/timeline?start_date=2026-01-01&end_date=2027-01-01`, null, {
    'Authorization': `Bearer ${TOKEN}`
  });
  console.log('Current range filter status:', currentRes.status);
  if (currentRes.status === 200) {
    console.log('Items in current range:', currentRes.data.total, '(should match total)');
  }

  console.log('\n=== Timeline Test Complete ===');
}

main().catch(console.error);
