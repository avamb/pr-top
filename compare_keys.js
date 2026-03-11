// Compare i18n keys between en.json and ru.json
var en = require('./src/frontend/src/i18n/en.json');
var ru = require('./src/frontend/src/i18n/ru.json');

function getKeys(obj, prefix) {
  prefix = prefix || '';
  var keys = [];
  Object.keys(obj).forEach(function(k) {
    var path = prefix ? prefix + '.' + k : k;
    if (typeof obj[k] === 'object') {
      keys = keys.concat(getKeys(obj[k], path));
    } else {
      keys.push(path);
    }
  });
  return keys;
}

var enKeys = getKeys(en);
var ruKeys = getKeys(ru);
var missingInEn = ruKeys.filter(function(k) { return enKeys.indexOf(k) === -1; });
var missingInRu = enKeys.filter(function(k) { return ruKeys.indexOf(k) === -1; });

console.log('EN keys: ' + enKeys.length);
console.log('RU keys: ' + ruKeys.length);
console.log(missingInEn.length ? 'Missing in EN: ' + missingInEn.join(', ') : 'No keys missing in EN');
console.log(missingInRu.length ? 'Missing in RU: ' + missingInRu.join(', ') : 'No keys missing in RU');
