const http = require('http');

// Get token first
function makeRequest(method, path, headers, body) {
  return new Promise(function(resolve, reject) {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: headers || {}
    };
    const req = http.request(options, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Login
  const loginResp = await makeRequest('POST', '/api/auth/login',
    { 'Content-Type': 'application/json' },
    { email: 'vidtest25@test.com', password: 'Test123!' });
  const token = loginResp.body.token;
  const therapistId = loginResp.body.user.id;
  console.log('Logged in as therapist #' + therapistId);

  const authHeaders = { 'Authorization': 'Bearer ' + token };

  // Read diary entries (should create audit log with action='read_diary')
  console.log('\n1. Reading diary entries...');
  const diaryResp = await makeRequest('GET', '/api/clients/291/diary', authHeaders);
  console.log('   Status:', diaryResp.status, '- Entries:', diaryResp.body.total || 0);

  // Read notes (should create audit log with action='read_notes')
  console.log('2. Reading notes...');
  const notesResp = await makeRequest('GET', '/api/clients/291/notes', authHeaders);
  console.log('   Status:', notesResp.status);

  // Read timeline (should create audit log with action='read_timeline')
  console.log('3. Reading timeline...');
  const timelineResp = await makeRequest('GET', '/api/clients/291/timeline', authHeaders);
  console.log('   Status:', timelineResp.status);

  // Read context (should create audit log with action='read_context')
  console.log('4. Reading context...');
  const contextResp = await makeRequest('GET', '/api/clients/291/context', authHeaders);
  console.log('   Status:', contextResp.status);

  // Now check audit logs via admin API
  console.log('\nChecking audit logs...');

  // Login as admin
  const adminLogin = await makeRequest('POST', '/api/auth/login',
    { 'Content-Type': 'application/json' },
    { email: 'admin@psylink.app', password: 'Admin123!' });
  const adminToken = adminLogin.body.token;

  const adminHeaders = { 'Authorization': 'Bearer ' + adminToken };

  // Get recent audit logs
  const auditResp = await makeRequest('GET', '/api/admin/logs/audit?limit=20', adminHeaders);

  if (auditResp.status === 200 && auditResp.body.logs) {
    console.log('\nRecent audit log entries:');
    const readActions = auditResp.body.logs.filter(function(log) {
      return log.action && log.action.startsWith('read_');
    });

    readActions.forEach(function(log) {
      console.log('  ' + log.action + ' | actor_id=' + log.actor_id + ' | target_type=' + log.target_type + ' | target_id=' + log.target_id);
    });

    // Verify specific actions
    const hasReadDiary = readActions.some(function(l) { return l.action === 'read_diary' && l.actor_id === therapistId; });
    const hasReadNotes = readActions.some(function(l) { return l.action === 'read_notes' && l.actor_id === therapistId; });
    const hasReadTimeline = readActions.some(function(l) { return l.action === 'read_timeline' && l.actor_id === therapistId; });
    const hasReadContext = readActions.some(function(l) { return l.action === 'read_context' && l.actor_id === therapistId; });

    console.log('\n--- Verification ---');
    console.log('read_diary logged:', hasReadDiary ? '✓ PASS' : '✗ FAIL');
    console.log('read_notes logged:', hasReadNotes ? '✓ PASS' : '✗ FAIL');
    console.log('read_timeline logged:', hasReadTimeline ? '✓ PASS' : '✗ FAIL');
    console.log('read_context logged:', hasReadContext ? '✓ PASS' : '✗ FAIL');

    // Check actor_id matches therapist
    const allCorrectActor = readActions.every(function(l) {
      return l.actor_id === therapistId;
    });
    console.log('actor_id matches therapist:', allCorrectActor ? '✓ PASS' : '✗ FAIL');

    // Check target_type and target_id
    const diaryLog = readActions.find(function(l) { return l.action === 'read_diary'; });
    if (diaryLog) {
      console.log('target_type for read_diary:', diaryLog.target_type, diaryLog.target_type === 'client' ? '✓ PASS' : '✗ FAIL');
      console.log('target_id for read_diary:', diaryLog.target_id, parseInt(diaryLog.target_id) === 291 ? '✓ PASS' : '✗ FAIL');
    }
  } else {
    console.log('Failed to get audit logs:', auditResp.status, JSON.stringify(auditResp.body));
  }
}

main().catch(function(err) {
  console.error('Error:', err.message);
});
