const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body && method === 'POST') {
      const csrf = request('GET', '/api/csrf-token').then(r => JSON.parse(r).csrfToken);
      return csrf.then(csrfToken => {
        opts.headers['x-csrf-token'] = csrfToken;
        const req = http.request(opts, (r) => {
          let d = '';
          r.on('data', c => d += c);
          r.on('end', () => resolve(d));
        });
        req.on('error', reject);
        req.write(JSON.stringify(body));
        req.end();
      });
    }
    const req = http.request(opts, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    // Get CSRF token and login
    const csrfResp = await request('GET', '/api/csrf-token');
    const csrfToken = JSON.parse(csrfResp).csrfToken;

    // Login as admin
    const loginOpts = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken
      }
    };

    const loginResp = await new Promise((resolve, reject) => {
      const req = http.request(loginOpts, (r) => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => resolve(d));
      });
      req.on('error', reject);
      req.write(JSON.stringify({ email: 'admin@psylink.app', password: 'Admin123!' }));
      req.end();
    });

    const loginData = JSON.parse(loginResp);
    if (!loginData.token) {
      console.log('Login failed:', loginResp);
      return;
    }
    const token = loginData.token;
    console.log('Logged in successfully');

    // Test 1: GET /api/exercises?language=en
    const enResp = await request('GET', '/api/exercises?language=en', null, token);
    const enData = JSON.parse(enResp);
    console.log('\n=== ENGLISH (language=en) ===');
    console.log('Total exercises:', enData.exercises.length);
    console.log('Language field:', enData.language);
    if (enData.exercises.length > 0) {
      const ex = enData.exercises[0];
      console.log('First exercise title:', ex.title);
      console.log('First exercise title_en:', ex.title_en);
      console.log('Has title field:', !!ex.title);
      console.log('Has description field:', !!ex.description);
      console.log('Has instructions field:', !!ex.instructions);
      console.log('EN title matches:', ex.title === ex.title_en);
    }

    // Test 2: GET /api/exercises?language=ru
    const ruResp = await request('GET', '/api/exercises?language=ru', null, token);
    const ruData = JSON.parse(ruResp);
    console.log('\n=== RUSSIAN (language=ru) ===');
    console.log('Total exercises:', ruData.exercises.length);
    console.log('Language field:', ruData.language);
    if (ruData.exercises.length > 0) {
      const ex = ruData.exercises[0];
      console.log('First exercise title:', ex.title);
      console.log('First exercise title_ru:', ex.title_ru);
      console.log('Has title field:', !!ex.title);
      console.log('Has description field:', !!ex.description);
      console.log('Has instructions field:', !!ex.instructions);
      console.log('RU title matches:', ex.title === ex.title_ru);
    }

    // Test 3: GET /api/exercises?language=es
    const esResp = await request('GET', '/api/exercises?language=es', null, token);
    const esData = JSON.parse(esResp);
    console.log('\n=== SPANISH (language=es) ===');
    console.log('Total exercises:', esData.exercises.length);
    console.log('Language field:', esData.language);
    if (esData.exercises.length > 0) {
      const ex = esData.exercises[0];
      console.log('First exercise title:', ex.title);
      console.log('First exercise title_es:', ex.title_es);
      console.log('Has title field:', !!ex.title);
      console.log('Has description field:', !!ex.description);
      console.log('Has instructions field:', !!ex.instructions);
      console.log('ES title matches:', ex.title === ex.title_es);
    }

    // Test 4: Verify all exercises have all 3 languages
    console.log('\n=== ALL EXERCISES LANGUAGE COVERAGE ===');
    const allResp = await request('GET', '/api/exercises', null, token);
    const allData = JSON.parse(allResp);
    let missingRu = 0, missingEn = 0, missingEs = 0;
    for (const ex of allData.exercises) {
      if (!ex.title_ru) missingRu++;
      if (!ex.title_en) missingEn++;
      if (!ex.title_es) missingEs++;
    }
    console.log('Total exercises:', allData.exercises.length);
    console.log('Missing RU titles:', missingRu);
    console.log('Missing EN titles:', missingEn);
    console.log('Missing ES titles:', missingEs);

    // Verify descriptions and instructions too
    let missingDescRu = 0, missingDescEn = 0, missingDescEs = 0;
    let missingInstRu = 0, missingInstEn = 0, missingInstEs = 0;
    for (const ex of allData.exercises) {
      if (!ex.description_ru) missingDescRu++;
      if (!ex.description_en) missingDescEn++;
      if (!ex.description_es) missingDescEs++;
      if (!ex.instructions_ru) missingInstRu++;
      if (!ex.instructions_en) missingInstEn++;
      if (!ex.instructions_es) missingInstEs++;
    }
    console.log('Missing RU descriptions:', missingDescRu);
    console.log('Missing EN descriptions:', missingDescEn);
    console.log('Missing ES descriptions:', missingDescEs);
    console.log('Missing RU instructions:', missingInstRu);
    console.log('Missing EN instructions:', missingInstEn);
    console.log('Missing ES instructions:', missingInstEs);

    // Summary
    const allPass = missingRu === 0 && missingEn === 0 && missingEs === 0 &&
                    missingDescRu === 0 && missingDescEn === 0 && missingDescEs === 0 &&
                    missingInstRu === 0 && missingInstEn === 0 && missingInstEs === 0;

    console.log('\n=== RESULT ===');
    console.log('All exercises have RU/EN/ES translations:', allPass ? 'PASS' : 'FAIL');
    console.log('Language param works for EN:', enData.language === 'en' && enData.exercises[0].title === enData.exercises[0].title_en ? 'PASS' : 'FAIL');
    console.log('Language param works for RU:', ruData.language === 'ru' && ruData.exercises[0].title === ruData.exercises[0].title_ru ? 'PASS' : 'FAIL');
    console.log('Language param works for ES:', esData.language === 'es' && esData.exercises[0].title === esData.exercises[0].title_es ? 'PASS' : 'FAIL');

  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
