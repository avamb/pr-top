const fs = require('fs');
const c = fs.readFileSync('src/frontend/dist/index.html', 'utf8');
const m = c.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
if (m) process.stdout.write(m[0].substring(0, 400) + '\n');

// Check title tag
const t = c.match(/<title[^>]*>([\s\S]*?)<\/title>/);
if (t) process.stdout.write(t[0].substring(0, 200) + '\n');

// Check meta description
const d = c.match(/<meta name="description"[^>]*>/);
if (d) process.stdout.write(d[0].substring(0, 300) + '\n');

// Check if "AI Assistant for Therapists" appears in h1
const h1text = m ? m[1] : '';
const hasOldHero = h1text.includes('AI Assistant') || h1text.includes('Telegram Bot');
process.stdout.write('H1 has old AI/bot text: ' + hasOldHero + '\n');
process.stdout.write('H1 text: ' + h1text.replace(/<[^>]*>/g,'').trim().substring(0,200) + '\n');
