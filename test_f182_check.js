const http = require('http');
function get(url, headers) {
  return new Promise((resolve, reject) => {
    http.get(url, {headers}, r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>console.log(d)); }).on('error', reject);
  });
}
async function main() {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjY2NCwiZW1haWwiOiJmaWx0ZXIxODJ0ZXN0QHRlc3QuY29tIiwicm9sZSI6InRoZXJhcGlzdCIsImlhdCI6MTc3MzMyMTU2NiwiZXhwIjoxNzczNDA3OTY2fQ.tRXh85Go76EafslaWzgC8H9fD-UKkoQn_pPwQi_6cNE';
  await get('http://localhost:3001/api/clients', {Authorization:'Bearer '+jwt});
}
main();
