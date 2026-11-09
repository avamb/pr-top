// Find RU frontend keys identical to EN (long strings)
const en = require('./src/frontend/src/i18n/en.json');
const ru = require('./src/frontend/src/i18n/ru.json');

function flat(o, p) {
  return Object.keys(o).reduce(function(a, k) {
    var fk = p ? p + '.' + k : k;
    if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) return a.concat(flat(o[k], fk));
    a.push(fk);
    return a;
  }, []);
}

var enK = flat(en, '');
var same = enK.filter(function(k) {
  var ev = k.split('.').reduce(function(o, p) { return o && o[p]; }, en);
  var rv = k.split('.').reduce(function(o, p) { return o && o[p]; }, ru);
  return typeof ev === 'string' && typeof rv === 'string' && ev === rv && ev.length > 20;
});

console.log('RU keys identical to EN (long strings):');
same.forEach(function(k) {
  var v = k.split('.').reduce(function(o, p) { return o && o[p]; }, en);
  console.log('  Key:', k);
  console.log('  Val:', v.slice(0, 100));
  console.log('');
});
