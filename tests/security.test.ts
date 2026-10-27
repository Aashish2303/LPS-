import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {sameOrigin,readJSON,publicFailure} from '../lib/request-security';
import {createProjectSchema,projectRequestSchema} from '../lib/api-schemas';
import {authSchemas,authFailure} from '../lib/auth-policy';
import {createAuthGateway} from '../lib/auth-handler';
import {clientAddress,rateKey,type RateRule} from '../lib/rate-limit';
import {parseRoute,projectPath,safeReturnPath,validWeek} from '../lib/routes';
const origin='https://lps.test';
const request=(path:string,body:unknown,extra:Record<string,string>={})=>new Request(origin+'/api/auth/'+path,{method:'POST',headers:{origin,'content-type':'application/json',...extra},body:JSON.stringify(body)});
const ctx=(path:string)=>({params:Promise.resolve({path:path.split('/')})});
const validLogin={email:'planner@example.com',password:'test credential only'};
const allow=async()=>null;

test('mutations require an exact same origin, including non-browser callers',()=>{
 assert.doesNotThrow(()=>sameOrigin(request('sign-in/email',validLogin)));
 const rejected:Record<string,string>[]=[{origin:'https://other.test'},{origin:'null'},{origin,'sec-fetch-site':'cross-site'}];
 for(const headers of rejected)assert.throws(()=>sameOrigin(request('sign-in/email',validLogin,headers)));
 assert.throws(()=>sameOrigin(new Request(origin+'/api/projects',{method:'POST'})));
});
test('JSON validation checks actual bytes without relying on Content-Length',async()=>{
 assert.deepEqual(await readJSON(request('sign-in/email',{ok:true})),{ok:true});
 await assert.rejects(readJSON(request('sign-in/email',{x:'x'.repeat(100)}),40),/large/);
 await assert.rejects(readJSON(request('sign-in/email',{}, {'content-type':'text/plain'})),/JSON/);
 await assert.rejects(readJSON(new Request(origin,{method:'POST',headers:{'content-type':'application/json'},body:'{"bad":'})),/fields/);
 await assert.rejects(readJSON(new Request(origin,{method:'POST',headers:{'content-type':'application/json'},body:new Uint8Array([255])})),/fields/);
});
test('project schema rejects mass assignment, malformed envelopes and unsupported commands',()=>{
 assert.equal(createProjectSchema.parse({name:'  Phase 2  '}).name,'Phase 2');
 for(const body of [{name:''},{name:'x',owner_id:'attacker'},{name:123},{name:'x'.repeat(201)}])assert.equal(createProjectSchema.safeParse(body).success,false);
 const base={requestId:randomUUID(),version:1,command:{type:'pull',taskId:'t1',selected:true}};
 assert.equal(projectRequestSchema.safeParse(base).success,true);
 for(const changed of [{...base,version:0},{...base,requestId:'bad'},{...base,owner:'other'},{...base,command:{type:'pull',taskId:'t1',selected:true,owner_id:'other'}},{...base,command:{type:'member',email:'x@example.com',role:'owner'}},{...base,command:{type:'importTasks',tasks:[base.command]}}])assert.equal(projectRequestSchema.safeParse(changed).success,false);
});
test('passwords remain opaque values, signup/reset policy does not break older sign-in lengths',()=>{
 const password='  A long test passphrase  ';
 assert.equal(authSchemas['sign-up/email'].parse({email:'a@example.com',name:'A',password}).password,password);
 assert.equal(authSchemas['sign-up/email'].safeParse({email:'a@example.com',name:'A',password:'short'}).success,false);
 assert.equal(authSchemas['sign-in/email'].safeParse({email:'a@example.com',password:'oldpass8'}).success,true);
 assert.equal(authSchemas['email-otp/reset-password'].safeParse({email:'a@example.com',password,otp:'123'}).success,false);
});
test('auth gateway validates before calling the identity provider',async()=>{
 let calls=0;const gateway=createAuthGateway(async()=>{calls++;return Response.json({success:true});},allow);
 assert.equal((await gateway(request('sign-in/email',{...validLogin,admin:true}),ctx('sign-in/email'))).status,400);
 assert.equal((await gateway(request('admin/list-users',{}),ctx('admin/list-users'))).status,404);
 assert.equal((await gateway(request('sign-in/email',validLogin,{origin:'https://bad.test'}),ctx('sign-in/email'))).status,403);
 assert.equal((await gateway(request('sign-in/email',{email:'a@example.com',password:'x'.repeat(9000)}),ctx('sign-in/email'))).status,413);
 assert.equal(calls,0);
});
test('authentication errors never expose provider messages or distinguish credentials',async()=>{
 for(const message of ['User does not exist','Invalid password','database connection password=PRIVATE']){
  const gateway=createAuthGateway(async()=>Response.json({message},{status:401}),allow);
  const r=await gateway(request('sign-in/email',validLogin),ctx('sign-in/email'));
  assert.equal(r.status,401);assert.deepEqual(await r.json(),authFailure(401));
 }
});
test('recovery success and nonexistent-account responses have the same public result',async()=>{
 const replies=[];
 for(const status of [200,400,404]){const gateway=createAuthGateway(async()=>Response.json({message:'Account detail'},{status}),allow);const r=await gateway(request('email-otp/send-verification-otp',{email:'a@example.com',type:'forget-password'}),ctx('email-otp/send-verification-otp'));replies.push([r.status,await r.json()]);}
 assert.deepEqual(replies,Array(3).fill([200,{success:true}]));
});
test('successful gateway responses preserve session cookies and disable caching',async()=>{
 const gateway=createAuthGateway(async()=>Response.json({user:{id:'example'}},{headers:{'Set-Cookie':'test_session=opaque; HttpOnly; Secure; SameSite=Lax'}}),allow);
 const r=await gateway(request('sign-in/email',validLogin),ctx('sign-in/email'));
 assert.equal(r.status,200);assert.match(r.headers.get('set-cookie')!,/HttpOnly/);assert.match(r.headers.get('cache-control')!,/no-store/);
});
test('gateway uses normalized email counters and blocks the sixth login before upstream',async()=>{
 const counts=new Map<string,number>();let calls=0;
 const limit=async(rules:RateRule[])=>{let blocked=false;for(const rule of rules){const key=JSON.stringify([rule.scope,rule.subject]),n=(counts.get(key)??0)+1;counts.set(key,n);if(n>rule.limit)blocked=true;}return blocked?Response.json(authFailure(429),{status:429,headers:{'Retry-After':'900'}}):null;};
 const gateway=createAuthGateway(async()=>{calls++;return Response.json({code:'invalid'},{status:401});},limit);
 for(let i=0;i<5;i++)assert.equal((await gateway(request('sign-in/email',{...validLogin,email:i%2?' PLANNER@example.com ':'planner@example.com'}),ctx('sign-in/email'))).status,401);
 const blocked=await gateway(request('sign-in/email',validLogin),ctx('sign-in/email'));
 assert.equal(blocked.status,429);assert.equal(blocked.headers.get('Retry-After'),'900');assert.equal(calls,5);
});
test('rate limit outages fail closed and provider failures return generic errors',async()=>{
 const gateway=createAuthGateway(async()=>{throw Error('Private provider details');},allow);
 const r=await gateway(request('sign-in/email',validLogin),ctx('sign-in/email'));assert.equal(r.status,503);assert.deepEqual(await r.json(),authFailure(503));
});
test('rate key contains no raw identity and ignores caller-controlled forwarding locally',()=>{
 const secret='test-only-secret-with-at-least-32-characters';
 const rule={scope:'login',subject:'planner@example.com',limit:5,seconds:900};
 const key=rateKey(rule,secret);assert.match(key,/^[0-9a-f]{64}$/);assert.equal(key,rateKey(rule,secret));assert.notEqual(key,rateKey({...rule,scope:'reset'},secret));
 const req=request('sign-in/email',{}, {'x-forwarded-for':'1.2.3.4','x-vercel-forwarded-for':'5.6.7.8'});
 assert.equal(clientAddress(req,false),'unknown');assert.equal(clientAddress(req,true),'5.6.7.8');
 assert.equal(clientAddress(request('x',{}, {'x-vercel-forwarded-for':'2001:db8:1234:5678::1'}),true),clientAddress(request('x',{}, {'x-vercel-forwarded-for':'2001:0db8:1234:5678:abcd::2'}),true));
});
test('database and permission failures expose only generic public messages',async()=>{
 const error=publicFailure(new Error('DATABASE_URL=private'));assert.equal(error.status,500);assert.doesNotMatch(JSON.stringify(await error.json()),/DATABASE_URL|private/);
});
test('routes accept only known sections and redirect targets cannot leave the app',()=>{
 const id=randomUUID(),path=projectPath(id,'weekly');assert.deepEqual(parseRoute(path),{kind:'project',projectId:id,view:'weekly'});
 assert.deepEqual(parseRoute('/demo/daily'),{kind:'demo',view:'daily'});assert.equal(parseRoute('/projects/bad/weekly'),null);assert.equal(parseRoute('/demo/admin'),null);
 for(const value of ['https://evil.test','//evil.test','/\\evil.test','/login','javascript:alert(1)',path+'%0a'])assert.equal(safeReturnPath(value),'/');
 assert.equal(safeReturnPath(path+'?week=2026-10-19&next=https://evil.test'),path+'?week=2026-10-19');
 assert.equal(validWeek('2026-10-19'),true);assert.equal(validWeek('2026-10-20'),false);assert.equal(validWeek('2026-02-30'),false);
});
