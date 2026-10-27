import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
const origin=process.env.TEST_ORIGIN;
if(!origin||process.env.TEST_ISOLATED!=='1')throw Error('Run only against a verified preview bound to the isolated verification database branch. Set TEST_ORIGIN and TEST_ISOLATED=1.');
const runId=Date.now(),password=crypto.randomBytes(24).toString('base64url');
function client(){let cookie='';return async(path,body,method)=>{const r=await fetch(origin+path,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',Origin:origin,...(process.env.TEST_BYPASS?{'x-vercel-protection-bypass':process.env.TEST_BYPASS}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0];const name=pair.split('=')[0];cookie=cookie.split('; ').filter(x=>!x.startsWith(name+'=')).concat(pair).filter(Boolean).join('; ');}let data;const t=await r.text();try{data=JSON.parse(t);}catch{data={raw:t.slice(0,100)};}return {status:r.status,data};};}
const a=client(),b=client();
const checks=[];function check(name,fn){fn();checks.push(name);console.log('PASS '+name);}
let r=await a('/api/projects');check('unauthenticated API denied',()=>assert.equal(r.status,401));
for(const [c,name] of [[a,'owner'],[b,'outsider']]){r=await c('/api/auth/sign-up/email',{name:'LPS Verification '+name,email:`lps-verification-${runId}-${name}@example.com`,password});check(name+' signup establishes session',()=>assert.equal(r.status,200,JSON.stringify(r.data)));r=await c('/api/auth/get-session');check(name+' session restoration',()=>assert.ok(r.data?.user??r.data?.data?.user,JSON.stringify(r.data)));}
r=await a('/api/projects',{name:'Verification fixture '+runId});check('create private project',()=>assert.equal(r.status,200,JSON.stringify(r.data)));const id=r.data.id;let version=r.data.version;
let outsider=await b('/api/projects/'+id);check('other account cannot read project',()=>assert.equal(outsider.status,404));
const settings={type:'settings',name:'Verification fixture '+runId,code:'QA',client:'Test fixture',location:'Chennai',start:'2026-10-01',finish:'2026-12-31',trades:['Civil','Structure'],areas:['Zone A']};
async function command(command,expect=200,extra={}){const r=await a('/api/projects/'+id,{requestId:crypto.randomUUID(),version,command,...extra});assert.equal(r.status,expect,JSON.stringify(r.data));if(r.status===200)version=r.data.version;return r;}
await command(settings);check('configuration persisted',()=>assert.ok(version>1));
const task={type:'task',id:'a',name:'Concrete',trade:'Structure',area:'Zone A',owner:'Lead',unit:'m³',total:100,start:'2026-10-01',finish:'2026-12-01',predecessors:[],milestoneId:'',pull:true};await command(task);
await command({type:'allocate',id:'al',taskId:'a',week:'2026-10-19',quantity:60});await command({type:'commit',id:'c',taskId:'a',week:'2026-10-19',quantity:60,due:'2026-10-23',owner:'Lead'});await command({type:'freeze',week:'2026-10-19'});
await command({type:'actual',commitmentId:'c',date:'2026-10-19',quantity:20,note:'First day'});await command({type:'actual',commitmentId:'c',date:'2026-10-20',quantity:25,note:'Second day'});await command({type:'actual',commitmentId:'c',date:'2026-10-19',quantity:10,note:'Correction'});
r=await a('/api/projects/'+id);check('reload preserves corrected cumulative 35 across 2 entries',()=>{assert.equal(r.data.state.entries.length,2);assert.equal(r.data.state.entries.reduce((n,e)=>n+e.quantity,0),35);});
await command({type:'actual',commitmentId:'c',date:'2026-10-21',quantity:90,note:''},422);check('scope overflow rejected by server',()=>assert.ok(true));
const oldVersion=version;const concurrent=await Promise.all([a('/api/projects/'+id,{requestId:crypto.randomUUID(),version:oldVersion,command:{type:'actual',commitmentId:'c',date:'2026-10-21',quantity:5,note:'Parallel one'}}),a('/api/projects/'+id,{requestId:crypto.randomUUID(),version:oldVersion,command:{type:'actual',commitmentId:'c',date:'2026-10-22',quantity:5,note:'Parallel two'}})]);check('concurrent stale save conflicts rather than overwrites',()=>assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]));version=concurrent.find(x=>x.status===200).data.version;
const requestId=crypto.randomUUID(),payload={type:'variance',commitmentId:'c',reason:'Materials',learning:'Confirm delivery 48h before promise'};await command(payload,200,{requestId});const after=version;await command(payload,200,{requestId,version:version-1});check('same request retry is idempotent',()=>assert.equal(version,after));
await command({type:'close',week:'2026-10-19'});await command({type:'actual',commitmentId:'c',date:'2026-10-20',quantity:10,note:'Forbidden'},422);check('closed ledger is locked on server',()=>assert.ok(true));
r=await b('/api/projects/'+id,{requestId:crypto.randomUUID(),version,command:settings});check('other account cannot mutate project',()=>assert.equal(r.status,404));
r=await a('/api/projects/'+id);check('audit events and state versions remain consistent',()=>assert.equal(r.data.events[0].version,r.data.version));
r=await a('/api/auth/sign-out',{});check('sign-out request accepted',()=>assert.equal(r.status,200));r=await a('/api/projects');check('signed-out API denied',()=>assert.equal(r.status,401));
fs.writeFileSync('../lps-http-verification.json',JSON.stringify({origin,runId,projectId:id,checks},null,2));
console.log(checks.length+' HTTP checks passed. Synthetic fixture retained only on isolated verification branch.');
