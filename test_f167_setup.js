const http = require('http');
const BOT_KEY = 'dev-bot-api-key';

const req = (method, path, body, headers2) => new Promise((resolve, reject) => {
  const headers = {...(headers2||{})};
  let data;
  if (body) {
    data = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(data);
  }
  const r = http.request({ hostname:'localhost', port:3001, path, method, headers }, (res) => {
    let b=''; res.on('data',c=>b+=c); res.on('end',()=>{
      try { resolve({status:res.statusCode,body:JSON.parse(b)}); }
      catch(e) { resolve({status:res.statusCode,body:b}); }
    });
  });
  r.on('error',reject);
  if (data) r.write(data);
  r.end();
});

const run = async () => {
  const u = Date.now();

  // Get CSRF token
  const csrf = await req('GET', '/api/csrf-token');
  const csrfToken = csrf.body.csrfToken;
  console.log('CSRF token:', csrfToken ? 'OK' : 'FAIL');

  // Register therapist with CSRF
  const t = await req('POST', '/api/auth/register',
    {email:'t167_'+u+'@test.com',password:'TestPass1',role:'therapist'},
    {'X-CSRF-Token': csrfToken});
  console.log('Therapist registered:', t.status);
  const token = t.body.token;

  // Register client via bot
  const c = await req('POST', '/api/bot/register',
    {telegram_id:'167_'+u,role:'client',language:'en'},
    {'x-bot-api-key':BOT_KEY});
  console.log('Client registered:', c.status);

  // Get invite code
  const inviteRes = await req('GET', '/api/invite-code', null, {'Authorization':'Bearer '+token});
  const inviteCode = inviteRes.body.invite_code;
  console.log('Invite code:', inviteCode);

  // Connect client
  const conn = await req('POST', '/api/bot/connect',
    {telegram_id:'167_'+u, invite_code: inviteCode},
    {'x-bot-api-key':BOT_KEY});
  console.log('Connected:', conn.status, JSON.stringify(conn.body));
  const therapistId = conn.body.therapist?.id;

  // Grant consent with therapist_id
  const consent = await req('POST', '/api/bot/consent',
    {telegram_id:'167_'+u, therapist_id: therapistId, consent: true},
    {'x-bot-api-key':BOT_KEY});
  console.log('Consent:', consent.status);

  // Create diary entry
  const diary = await req('POST', '/api/bot/diary',
    {telegram_id:'167_'+u, content:'CASCADE_DEL_55555', entry_type:'text'},
    {'x-bot-api-key':BOT_KEY});
  console.log('Diary created:', diary.status);

  // Get client list
  const clients = await req('GET', '/api/clients', null, {'Authorization':'Bearer '+token});
  const theClient = clients.body.clients?.[0];
  console.log('Client ID:', theClient?.id);

  // Get diary entries
  const diaryList = await req('GET', '/api/clients/' + theClient?.id + '/diary', null, {'Authorization':'Bearer '+token});
  console.log('Diary entries count:', diaryList.body.entries?.length);
  const entry = diaryList.body.entries?.find(e => e.content?.includes('CASCADE_DEL_55555'));
  console.log('Found in diary:', entry?.id, entry?.content?.substring(0, 30));

  // Get timeline
  const timeline = await req('GET', '/api/clients/' + theClient?.id + '/timeline', null, {'Authorization':'Bearer '+token});
  const tlItems = timeline.body.items || timeline.body.timeline || [];
  const tlEntry = tlItems.find(i => i.content?.includes('CASCADE_DEL_55555'));
  console.log('Found in timeline:', !!tlEntry, 'type:', tlEntry?.type, 'total items:', tlItems.length);

  // Search
  const search = await req('POST', '/api/search', {query:'CASCADE_DEL_55555'}, {'Authorization':'Bearer '+token});
  console.log('Search results:', search.status, 'count:', search.body.results?.length);

  // Now DELETE the diary entry
  console.log('\n--- DELETING entry', entry?.id, '---');
  const delRes = await req('DELETE', '/api/clients/' + theClient?.id + '/diary/' + entry?.id, null, {'Authorization':'Bearer '+token});
  console.log('Delete result:', delRes.status, JSON.stringify(delRes.body));

  // Verify removed from diary
  const diaryAfter = await req('GET', '/api/clients/' + theClient?.id + '/diary', null, {'Authorization':'Bearer '+token});
  const entryAfter = diaryAfter.body.entries?.find(e => e.content?.includes('CASCADE_DEL_55555'));
  console.log('Still in diary?', !!entryAfter, 'entries:', diaryAfter.body.entries?.length);

  // Verify removed from timeline
  const timelineAfter = await req('GET', '/api/clients/' + theClient?.id + '/timeline', null, {'Authorization':'Bearer '+token});
  const tlAfter = timelineAfter.body.items?.find(i => i.content?.includes('CASCADE_DEL_55555'));
  console.log('Still in timeline?', !!tlAfter, 'items:', timelineAfter.body.items?.length);

  // Verify removed from search
  const searchAfter = await req('POST', '/api/search', {query:'CASCADE_DEL_55555'}, {'Authorization':'Bearer '+token});
  console.log('Still in search?', searchAfter.body.results?.length > 0, 'count:', searchAfter.body.results?.length);

  console.log('\n=== RESULTS ===');
  console.log('BEFORE DELETE: diary=' + !!entry + ', timeline=' + !!tlEntry + ', search=' + (search.body.results?.length > 0));
  console.log('AFTER DELETE: diary=' + !!entryAfter + ', timeline=' + !!tlAfter + ', search=' + (searchAfter.body.results?.length > 0));
  console.log('ALL VIEWS CLEAN:', !entryAfter && !tlAfter && !(searchAfter.body.results?.length > 0) ? 'PASS' : 'FAIL');
  console.log('TOKEN=' + token);
  console.log('CLIENT_ID=' + theClient?.id);
};

run().catch(console.error);
