// Verify all four locale files parse and contain T-06 solo-mode keys.
const fs = require('fs');
const REQUIRED = [
  'client.mode.solo',
  'client.mode.botConnected',
  'client.solo.badge',
  'client.solo.description',
  'client.solo.btn',
  'client.solo.title',
  'client.solo.disclaimer',
  'client.solo.firstName',
  'client.solo.lastName',
  'client.solo.create',
  'client.solo.errorNeedIdentifier'
];
let ok = true;
for (const lang of ['en', 'ru', 'es', 'uk']) {
  const file = 'src/frontend/src/i18n/' + lang + '.json';
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.log('JSON parse error in ' + file + ': ' + e.message);
    ok = false;
    continue;
  }
  for (const key of REQUIRED) {
    let v = data;
    for (const p of key.split('.')) v = v && v[p];
    if (!v) {
      console.log('Missing ' + key + ' in ' + lang);
      ok = false;
    }
  }
  console.log(ok ? 'OK ' + lang : 'FAIL ' + lang);
}
process.exit(ok ? 0 : 1);
