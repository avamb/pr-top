// Seed 100 clients for performance testing
const http = require('http');

function req(m,p,b,t){
  return new Promise((res,rej)=>{
    const u=new URL(p,'http://localhost:3001');
    const o={method:m,hostname:u.hostname,port:u.port,path:u.pathname,headers:{'Content-Type':'application/json'}};
    if(t)o.headers.Authorization='Bearer '+t;
    const r=http.request(o,s=>{let d='';s.on('data',c=>d+=c);s.on('end',()=>{try{res(JSON.parse(d))}catch(e){res({raw:d})}})});
    r.on('error',rej);if(b)r.write(JSON.stringify(b));r.end();
  });
}

async function main(){
  const ts = Date.now();
  const email = `perf_${ts}@test.com`;
  const reg = await req('POST','/api/auth/register',{email:email,password:'TestPass123'});
  if(!reg.token){console.log('Reg failed:',JSON.stringify(reg));return;}
  const token = reg.token;
  const therapistId = reg.user.id;
  console.log(`Therapist id=${therapistId}, email=${email}`);

  await req('POST','/api/subscription/change-plan',{plan:'premium'},token);
  console.log('Upgraded to premium');

  let linked = 0;
  for(let i=1;i<=105;i++){
    const cemail = `pc${i}_${ts}@t.com`;
    const c = await req('POST','/api/auth/register',{email:cemail,password:'TestPass123',role:'client'});
    if(!c.user){console.log(`Client ${i} reg failed:`,JSON.stringify(c).slice(0,100));continue;}
    const lnk = await req('POST','/api/clients/link',{client_id:c.user.id},token);
    if(lnk.message && lnk.message.includes('success')){linked++;}else{console.log(`Link ${i} failed:`,JSON.stringify(lnk).slice(0,100));}
    if(i%25===0) console.log(`Progress: ${i}/105, linked=${linked}`);
  }
  console.log(`Total linked: ${linked}`);

  const start = Date.now();
  const list = await req('GET','/api/clients',null,token);
  const elapsed = Date.now()-start;
  console.log(`Client list: ${list.total} clients in ${elapsed}ms`);
  console.log(`\nEmail: ${email}`);
  console.log(`Password: TestPass123`);
}

main().catch(e=>console.error('Error:',e.message));
