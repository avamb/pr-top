const http = require('http');
function req(m,p,t,b,h){return new Promise((ok,no)=>{const hd={'Content-Type':'application/json'};if(t)hd.Authorization='Bearer '+t;if(h)for(const[k,v]of Object.entries(h))if(v)hd[k]=v;const d=b?JSON.stringify(b):null;if(d)hd['Content-Length']=Buffer.byteLength(d);const r=http.request({hostname:'localhost',port:3001,path:p,method:m,headers:hd},rs=>{let x='';rs.on('data',c=>x+=c);rs.on('end',()=>{try{ok({s:rs.statusCode,b:JSON.parse(x)})}catch(e){ok({s:rs.statusCode,b:x})}});});r.on('error',no);if(d)r.write(d);r.end();})}
async function main(){
  const c=await req('GET','/api/csrf-token');
  const l=await req('POST','/api/auth/login',null,{email:'admin@psylink.app',password:'Admin123!'},{['X-CSRF-Token']:c.b.csrfToken});
  const t=l.b.token;
  const g=await req('GET','/api/admin/settings',t);
  const val=g.b.settings.trial_duration_days.value;
  console.log('trial_duration_days after restart: '+val);
  console.log('PERSIST: '+(val==='21'?'PASS':'FAIL expected 21 got '+val));
  await req('PUT','/api/admin/settings',t,{settings:{trial_duration_days:'14'}});
  console.log('Restored to 14');
}
main().catch(e=>console.log('ERR:'+e.message));
