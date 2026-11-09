const fs = require('fs');

const files = [
  { locale: 'EN', path: 'src/frontend/dist/index.html' },
  { locale: 'RU', path: 'src/frontend/dist/ru/index.html' },
  { locale: 'UK', path: 'src/frontend/dist/uk/index.html' },
  { locale: 'ES', path: 'src/frontend/dist/es/index.html' },
];

files.forEach(({ locale, path }) => {
  const c = fs.readFileSync(path, 'utf8');
  const h1m = c.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const h1text = h1m ? h1m[1].replace(/<[^>]*>/g, '').trim() : 'NOT FOUND';
  const titleM = c.match(/<title[^>]*>([\s\S]*?)<\/title>/);
  const title = titleM ? titleM[1].trim() : 'NOT FOUND';
  const descM = c.match(/name="description" content="([^"]*)/);
  const desc = descM ? descM[1] : 'NOT FOUND';

  const hasAI = /\bAI\b|\bИИ\b|\bШІ\b/i.test(h1text);
  const hasBot = /\bbot\b|\bбот\b/i.test(h1text);

  process.stdout.write('[' + locale + ']\n');
  process.stdout.write('H1: ' + h1text + '\n');
  process.stdout.write('H1 has AI: ' + hasAI + ' | has bot: ' + hasBot + '\n');
  process.stdout.write('Title: ' + title.substring(0, 120) + '\n');
  process.stdout.write('Desc len: ' + desc.length + ' | Desc: ' + desc.substring(0, 120) + '\n\n');
});
