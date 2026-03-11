// Test timeline type filtering via API
var BASE = 'http://localhost:3001/api';

async function test() {
  // Login as therapist
  var res = await fetch(BASE + '/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'admin@psylink.app', password: 'Admin123!'})
  });
  var loginData = await res.json();
  var token = loginData.token;
  console.log('Login:', loginData.user?.role);

  // Get clients
  res = await fetch(BASE + '/clients', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var clientsData = await res.json();
  var clients = clientsData.clients || [];
  console.log('Clients count:', clients.length);

  if (clients.length === 0) {
    console.log('No clients - need to create test data');
    return;
  }

  var clientId = clients[0].id;
  console.log('Using client ID:', clientId);

  // Test timeline with no filter
  res = await fetch(BASE + '/clients/' + clientId + '/timeline', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var allData = await res.json();
  console.log('All timeline items:', allData.total);
  var types = {};
  for (var item of allData.timeline) {
    types[item.type] = (types[item.type] || 0) + 1;
  }
  console.log('By type:', JSON.stringify(types));

  // Test diary filter
  res = await fetch(BASE + '/clients/' + clientId + '/timeline?type=diary', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var diaryData = await res.json();
  console.log('Diary filter:', diaryData.total, 'items, filter:', diaryData.filters?.type);
  var allDiary = diaryData.timeline.every(function(i) { return i.type === 'diary'; });
  console.log('All diary?', allDiary);

  // Test note filter
  res = await fetch(BASE + '/clients/' + clientId + '/timeline?type=note', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var noteData = await res.json();
  console.log('Note filter:', noteData.total, 'items, filter:', noteData.filters?.type);
  var allNotes = noteData.timeline.every(function(i) { return i.type === 'note'; });
  console.log('All notes?', allNotes);

  // Test session filter
  res = await fetch(BASE + '/clients/' + clientId + '/timeline?type=session', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var sessionData = await res.json();
  console.log('Session filter:', sessionData.total, 'items, filter:', sessionData.filters?.type);
  var allSessions = sessionData.timeline.every(function(i) { return i.type === 'session'; });
  console.log('All sessions?', allSessions);

  // Verify counts match
  var expectedTotal = (diaryData.total || 0) + (noteData.total || 0) + (sessionData.total || 0);
  console.log('Sum of filtered:', expectedTotal, 'vs All:', allData.total, 'Match:', expectedTotal === allData.total);

  // Test invalid type returns all
  res = await fetch(BASE + '/clients/' + clientId + '/timeline?type=invalid', {
    headers: {'Authorization': 'Bearer ' + token}
  });
  var invalidData = await res.json();
  console.log('Invalid type filter:', invalidData.total, 'items (should match all:', allData.total, ')');
}

test().catch(function(e) { console.error(e); });
