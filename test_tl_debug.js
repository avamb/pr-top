var BASE = 'http://localhost:3001/api';

async function test() {
  var res = await fetch(BASE + '/auth/register', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'tl_type_test2@psylink.app', password: 'Test1234!', name: 'TL Tester'})
  });
  var data = await res.json();
  console.log('Register status:', res.status);
  console.log('Register response:', JSON.stringify(data));
}
test().catch(function(e) { console.error(e); });
