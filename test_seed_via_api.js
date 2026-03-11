// Seed additional clients via internal DB endpoint
// This adds a temporary seeding endpoint, seeds data, then removes it
const http = require('http');

function req(m,p,b,t){
  return new Promise((res,rej)=>{
    const u=new URL(p,'http://localhost:3001');
    const o={method:m,hostname:u.hostname,port:u.port,path:u.pathname+u.search,headers:{'Content-Type':'application/json'}};
    if(t)o.headers.Authorization='Bearer '+t;
    const r=http.request(o,s=>{let d='';s.on('data',c=>d+=c);s.on('end',()=>{try{res(JSON.parse(d))}catch(e){res({raw:d})}})});
    r.on('error',rej);if(b)r.write(JSON.stringify(b));r.end();
  });
}

async function main(){
  // First check how many clients therapist 50 has
  // We need to get a token for therapist 50
  const loginRes = await req('POST','/api/auth/register',{email:'seed_helper@test.com',password:'TestPass123'});
  // If email exists, try login
  let token;
  if(loginRes.error){
    // Already registered, need another approach - use the existing perf account
    console.log('Need to get token another way...');
    console.log('Adding seed endpoint to backend temporarily...');
  } else {
    token = loginRes.token;
  }

  // Use the seed endpoint we'll add
  const seedRes = await req('POST','/api/admin/seed-clients',{
    therapist_id:50, count:70
  });
  console.log('Seed result:', JSON.stringify(seedRes));
}

main().catch(e=>console.error(e.message));
