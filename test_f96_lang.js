const http = require('http');

function httpReq(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: headers || {} };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Get token
  const csrfRes = await httpReq('GET', 'http://localhost:3001/api/csrf-token');
  const csrf = JSON.parse(csrfRes.body).csrfToken;

  const loginRes = await httpReq('POST', 'http://localhost:3001/api/auth/login',
    JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' }),
    { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }
  );
  const token = JSON.parse(loginRes.body).token;
  const auth = { 'Authorization': 'Bearer ' + token };

  // Test Russian
  console.log('=== Testing language=ru ===');
  const ruRes = await httpReq('GET', 'http://localhost:3001/api/exercises?language=ru', null, auth);
  const ruData = JSON.parse(ruRes.body);
  console.log('Status:', ruRes.status, '| Language:', ruData.language);
  const ruEx = ruData.exercises[0];
  console.log('First exercise title:', ruEx.title);
  console.log('Has Russian title:', ruEx.title === ruEx.title_ru);
  console.log('Has Russian description:', ruEx.description === ruEx.description_ru);
  console.log('Has Russian instructions:', ruEx.instructions === ruEx.instructions_ru);

  // Test English
  console.log('\n=== Testing language=en ===');
  const enRes = await httpReq('GET', 'http://localhost:3001/api/exercises?language=en', null, auth);
  const enData = JSON.parse(enRes.body);
  console.log('Status:', enRes.status, '| Language:', enData.language);
  const enEx = enData.exercises[0];
  console.log('First exercise title:', enEx.title);
  console.log('Has English title:', enEx.title === enEx.title_en);
  console.log('Has English description:', enEx.description === enEx.description_en);

  // Test Spanish
  console.log('\n=== Testing language=es ===');
  const esRes = await httpReq('GET', 'http://localhost:3001/api/exercises?language=es', null, auth);
  const esData = JSON.parse(esRes.body);
  console.log('Status:', esRes.status, '| Language:', esData.language);
  const esEx = esData.exercises[0];
  console.log('First exercise title:', esEx.title);
  console.log('Has Spanish title:', esEx.title === esEx.title_es);
  console.log('Has Spanish description:', esEx.description === esEx.description_es);

  // Verify all 3 languages have different content
  console.log('\n=== Cross-language verification ===');
  console.log('RU title:', ruEx.title);
  console.log('EN title:', enEx.title);
  console.log('ES title:', esEx.title);
  const allDifferent = ruEx.title !== enEx.title && enEx.title !== esEx.title && ruEx.title !== esEx.title;
  console.log('All titles different:', allDifferent);

  // Verify exercise count same across languages
  console.log('\nExercise counts: RU=' + ruData.exercises.length + ' EN=' + enData.exercises.length + ' ES=' + esData.exercises.length);
  const allSameCount = ruData.exercises.length === enData.exercises.length && enData.exercises.length === esData.exercises.length;
  console.log('Same count across languages:', allSameCount);

  console.log('\n=== OVERALL:', allDifferent && allSameCount ? 'PASS' : 'FAIL', '===');
}

main().catch(console.error);
