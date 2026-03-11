const http = require('http');
function req(m,p,b,t){return new Promise((res,rej)=>{const u=new URL(p,'http://localhost:3001');const o={method:m,hostname:u.hostname,port:u.port,path:u.pathname,headers:{'Content-Type':'application/json'}};if(t)o.headers.Authorization='Bearer '+t;const r=http.request(o,s=>{let d='';s.on('data',c=>d+=c);s.on('end',()=>res(JSON.parse(d)))});r.on('error',rej);if(b)r.write(JSON.stringify(b));r.end()})}
async function main(){
  // Use the therapist from downgrade test (id=27, downgrade_flow@test.com)
  const login = await req('POST','/api/auth/register',{email:'verify_dash_test@test.com',password:'TestPass123'});
  const t = login.token;
  console.log('Token obtained:', !!t);
  const stats = await req('GET','/api/dashboard/stats',null,t);
  console.log('Dashboard stats:', JSON.stringify(stats));
  const limits = await req('GET','/api/subscription/limits',null,t);
  console.log('Limits:', JSON.stringify(limits));
}
main().catch(console.error);
