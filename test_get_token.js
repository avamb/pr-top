const http=require('http');
function r(m,p,b,h){return new Promise((ok,no)=>{const hd={'Content-Type':'application/json'};if(h)Object.assign(hd,h);const d=b?JSON.stringify(b):null;if(d)hd['Content-Length']=Buffer.byteLength(d);const q=http.request({hostname:'localhost',port:3001,path:p,method:m,headers:hd},rs=>{let x='';rs.on('data',c=>x+=c);rs.on('end',()=>{try{ok(JSON.parse(x))}catch(e){ok(x)}});});q.on('error',no);if(d)q.write(d);q.end();})}
async function main(){
  const c=await r('GET','/api/csrf-token');
  const l=await r('POST','/api/auth/login',{email:'admin@psylink.app',password:'Admin123!'},{'X-CSRF-Token':c.csrfToken});
  // Output just the token
  process.stdout.write(l.token||'FAILED');
}
main();
