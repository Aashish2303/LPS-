import { z } from 'zod';

export type Milestone={id:string;name:string;date:string;owner:string};
export type Task={id:string;name:string;trade:string;area:string;owner:string;unit:string;total:number;start:string;finish:string;predecessors:string[];milestoneId:string;pull:boolean};
export type Constraint={id:string;taskId:string;category:string;description:string;owner:string;due:string;resolvedOn:string|null;resolution:string};
export type Allocation={id:string;taskId:string;week:string;quantity:number;createdOn:string};
export type Commitment={id:string;taskId:string;quantity:number;due:string;owner:string;reason:string;learning:string;anticipated:boolean};
export type Week={key:string;status:'draft'|'active'|'closed';commitments:Commitment[];frozenOn:string|null;closedOn:string|null;readyAtFreeze:number;plannedAtFreeze:number};
export type Entry={commitmentId:string;date:string;quantity:number;note:string};
export type State={schema:1;name:string;code:string;client:string;location:string;start:string;finish:string;trades:string[];areas:string[];milestones:Milestone[];tasks:Task[];constraints:Constraint[];allocations:Allocation[];weeks:Week[];entries:Entry[]};
export class DomainError extends Error { constructor(message:string,public status=422){super(message);} }
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !isNaN(+d)&&d.toISOString().slice(0,10)===v;},'Enter a valid calendar date');
const text=z.string().trim().min(1).max(200);
const qty=z.number().finite().positive().max(1e9).refine(v=>Math.abs(v*1000-Math.round(v*1000))<0.0001,'Use at most three decimal places');
const id=z.string().min(1).max(100);
export const commandSchema=z.discriminatedUnion('type',[
 z.strictObject({type:z.literal('settings'),name:text,code:text,client:z.string().max(200),location:z.string().max(200),start:dateSchema,finish:dateSchema,trades:z.array(text).min(1).max(50),areas:z.array(text).min(1).max(100)}),
 z.strictObject({type:z.literal('milestone'),id:id,name:text,date:dateSchema,owner:text}),
 z.strictObject({type:z.literal('task'),id:id,name:text,trade:text,area:text,owner:text,unit:text,total:qty,start:dateSchema,finish:dateSchema,predecessors:z.array(id).max(100),milestoneId:z.string().max(100),pull:z.boolean()}),
 z.strictObject({type:z.literal('editTask'),task:z.strictObject({id:id,name:text,trade:text,area:text,owner:text,unit:text,total:qty,start:dateSchema,finish:dateSchema,predecessors:z.array(id).max(100),milestoneId:z.string().max(100),pull:z.boolean()})}),
 z.strictObject({type:z.literal('pull'),taskId:id,selected:z.boolean()}),
 z.strictObject({type:z.literal('constraint'),id:id,taskId:id,category:text,description:text,owner:text,due:dateSchema}),
 z.strictObject({type:z.literal('resolve'),id:id,resolution:text,date:dateSchema}),
 z.strictObject({type:z.literal('allocate'),id:id,taskId:id,week:dateSchema,quantity:qty}),
 z.strictObject({type:z.literal('unallocate'),id:id}),
 z.strictObject({type:z.literal('commit'),id:id,taskId:id,week:dateSchema,quantity:qty,due:dateSchema,owner:text}),
 z.strictObject({type:z.literal('uncommit'),id:id,week:dateSchema}),
 z.strictObject({type:z.literal('freeze'),week:dateSchema}),
 z.strictObject({type:z.literal('actual'),commitmentId:id,date:dateSchema,quantity:qty.or(z.literal(0)),note:z.string().max(1000)}),
 z.strictObject({type:z.literal('variance'),commitmentId:id,reason:text,learning:text}),
 z.strictObject({type:z.literal('close'),week:dateSchema})
]);
export type Command=z.infer<typeof commandSchema>;
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const addDays=(d:string,n:number)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function monday(d:string){dateSchema.parse(d);const dow=new Date(d+'T00:00:00Z').getUTCDay();return addDays(d,-((dow+6)%7));}
const scaled=(n:number)=>Math.round(n*1000);
export const sum=(xs:number[])=>xs.reduce((s,n)=>s+scaled(n),0)/1000;
export const fmt=(n:number)=>n.toLocaleString('en-IN',{maximumFractionDigits:3});
export const pct=(a:number,b:number)=>b>0?Math.round(a/b*1000)/10:null;
export function emptyState(name='Untitled project',date=today()):State{return {schema:1,name,code:'LPS-001',client:'',location:'',start:date,finish:addDays(date,180),trades:['Civil','Structure','MEP','Finishes'],areas:['Zone A','Zone B'],milestones:[],tasks:[],constraints:[],allocations:[],weeks:[],entries:[]};}
function requireThat(ok:unknown,msg:string):asserts ok{if(!ok)throw new DomainError(msg);}
export function findTask(s:State,id:string){const t=s.tasks.find(t=>t.id===id);requireThat(t,'Activity not found');return t;}
export function commitmentActual(s:State,c:Commitment,through='9999-12-31'){return sum(s.entries.filter(e=>e.commitmentId===c.id&&e.date<=through).map(e=>e.quantity));}
export function taskActual(s:State,taskId:string){const ids=new Set(s.weeks.flatMap(w=>w.commitments).filter(c=>c.taskId===taskId).map(c=>c.id));return sum(s.entries.filter(e=>ids.has(e.commitmentId)).map(e=>e.quantity));}
export function remaining(s:State,t:Task){return (scaled(t.total)-scaled(taskActual(s,t.id)))/1000;}
export function blockers(s:State,t:Task){return [...s.constraints.filter(c=>c.taskId===t.id&&!c.resolvedOn).map(c=>c.description),...t.predecessors.filter(p=>remaining(s,findTask(s,p))>0).map(p=>'Handoff: '+findTask(s,p).name)];}
export function ready(s:State,t:Task){return t.pull&&remaining(s,t)>0&&blockers(s,t).length===0;}
function getWeek(s:State,key:string,create=false){requireThat(monday(key)===key,'Weeks start on Monday');let w=s.weeks.find(w=>w.key===key);if(!w&&create){w={key,status:'draft',commitments:[],frozenOn:null,closedOn:null,readyAtFreeze:0,plannedAtFreeze:0};s.weeks.push(w);}requireThat(w,'Create commitments before starting this week');return w;}
export function metrics(s:State,w:Week){const done=w.commitments.filter(c=>scaled(commitmentActual(s,c,c.due))>=scaled(c.quantity)).length;return {total:w.commitments.length,done,ppc:pct(done,w.commitments.length),ta:pct(w.commitments.filter(c=>c.anticipated).length,w.commitments.length),tmr:w.frozenOn?pct(w.readyAtFreeze,w.plannedAtFreeze):null};}
function reserved(s:State,taskId:string,except?:string){return sum(s.weeks.filter(w=>w.status!=='closed').flatMap(w=>w.commitments).filter(c=>c.taskId===taskId&&c.id!==except).map(c=>Math.max(0,(scaled(c.quantity)-scaled(commitmentActual(s,c)))/1000)))}
export function available(s:State,t:Task){return (scaled(remaining(s,t))-scaled(reserved(s,t.id)))/1000;}
function sameUnitTotals(s:State,which:'actual'|'total'){const r:Record<string,number[]>={};s.tasks.forEach(t=>(r[t.unit]??=[]).push(which==='actual'?taskActual(s,t.id):t.total));return Object.fromEntries(Object.entries(r).map(([k,v])=>[k,sum(v)]));}
export const unitTotals=(s:State)=>({actual:sameUnitTotals(s,'actual'),total:sameUnitTotals(s,'total')});

export function network(s:State){
 const visiting=new Set<string>(),seen=new Set<string>(),order:Task[]=[];
 function visit(t:Task){requireThat(!visiting.has(t.id),'Dependency cycle detected');if(seen.has(t.id))return;visiting.add(t.id);for(const p of t.predecessors){requireThat(p!==t.id,'An activity cannot depend on itself');visit(findTask(s,p));}visiting.delete(t.id);seen.add(t.id);order.push(t);}
 s.tasks.forEach(visit);
 const result:Record<string,{es:string;ef:string;ls:string;lf:string;float:number;duration:number}>={};
 for(const t of order){const duration=Math.round((Date.parse(t.finish)-Date.parse(t.start))/86400000)+1;let es=s.start;for(const p of t.predecessors){const next=addDays(result[p].ef,1);if(next>es)es=next;}const ef=addDays(es,duration-1);result[t.id]={es,ef,ls:es,lf:ef,float:0,duration};}
 const end=order.reduce((end,t)=>result[t.id].ef>end?result[t.id].ef:end,s.start);
 for(const t of [...order].reverse()){const successors=order.filter(u=>u.predecessors.includes(t.id));const lf=successors.length?successors.map(u=>addDays(result[u.id].ls,-1)).sort()[0]:end;const ls=addDays(lf,1-result[t.id].duration);result[t.id]={...result[t.id],ls,lf,float:Math.round((Date.parse(ls)-Date.parse(result[t.id].es))/86400000)};}
 return result;
}

export function applyCommand(input:State,raw:unknown,now=today()):State{
 const parsed=commandSchema.safeParse(raw);if(!parsed.success)throw new DomainError(parsed.error.issues.map(x=>x.path.join('.')+': '+x.message).join('; '));
 const c=parsed.data,s=structuredClone(input);
 switch(c.type){
 case 'settings':requireThat(c.finish>=c.start,'Project finish must follow its start');requireThat(s.tasks.every(t=>t.start>=c.start&&t.finish<=c.finish),'Project dates must contain every activity');requireThat(s.tasks.every(t=>c.trades.includes(t.trade)&&c.areas.includes(t.area)),'Keep trades and areas used by activities');Object.assign(s,{name:c.name,code:c.code,client:c.client,location:c.location,start:c.start,finish:c.finish,trades:[...new Set(c.trades)],areas:[...new Set(c.areas)]});break;
 case 'milestone':requireThat(!s.milestones.some(m=>m.id===c.id),'Milestone already exists');requireThat(c.date>=s.start&&c.date<=s.finish,'Milestone must fall within the project');s.milestones.push({id:c.id,name:c.name,date:c.date,owner:c.owner});break;
 case 'task':{
  requireThat(c.start>=s.start&&c.finish<=s.finish&&c.finish>=c.start,'Activity dates must be ordered and within the project');requireThat(s.trades.includes(c.trade)&&s.areas.includes(c.area),'Select an existing trade and area');requireThat(!c.milestoneId||s.milestones.some(m=>m.id===c.milestoneId),'Milestone not found');requireThat(!s.tasks.some(t=>t.id===c.id),'Activity already exists');
  s.tasks.push({id:c.id,name:c.name,trade:c.trade,area:c.area,owner:c.owner,unit:c.unit,total:c.total,start:c.start,finish:c.finish,predecessors:[...new Set(c.predecessors)],milestoneId:c.milestoneId,pull:c.pull});network(s);for(const p of c.predecessors)requireThat(findTask(s,p).finish<c.start,'Finish-to-start predecessor must finish before this activity starts');if(c.milestoneId)requireThat(c.finish<=s.milestones.find(m=>m.id===c.milestoneId)!.date,'Activity finishes after its milestone');break;
 }
 case 'editTask':{const old=findTask(s,c.task.id);requireThat(!s.weeks.some(w=>w.commitments.some(k=>k.taskId===old.id)),'An activity with a promise has a frozen scope and baseline');requireThat(!s.allocations.some(a=>a.taskId===old.id),'Remove forecast allocations before editing this activity');const next=structuredClone(s);next.tasks=next.tasks.filter(t=>t.id!==old.id);return applyCommand(next,{type:'task',...c.task},now);}
 case 'pull':{const t=findTask(s,c.taskId);requireThat(c.selected||!s.allocations.some(a=>a.taskId===t.id)&&!s.weeks.some(w=>w.commitments.some(k=>k.taskId===t.id)),'An allocated or committed activity must remain in the pull plan');t.pull=c.selected;break;}
 case 'constraint':findTask(s,c.taskId);requireThat(!s.constraints.some(k=>k.id===c.id),'Constraint already exists');s.constraints.push({id:c.id,taskId:c.taskId,category:c.category,description:c.description,owner:c.owner,due:c.due,resolvedOn:null,resolution:''});break;
 case 'resolve':{const k=s.constraints.find(k=>k.id===c.id);requireThat(k,'Constraint not found');requireThat(!k.resolvedOn,'Constraint is already resolved');requireThat(c.date<=now,'Resolution cannot be future dated');k.resolvedOn=c.date;k.resolution=c.resolution;break;}
 case 'allocate':{
  requireThat(monday(c.week)===c.week,'Weeks start on Monday');const t=findTask(s,c.taskId);requireThat(t.pull,'Select this activity in pull planning first');requireThat(c.week<=t.finish&&addDays(c.week,6)>=t.start,'Allocation week must overlap the activity schedule');requireThat(!s.weeks.some(w=>w.key===c.week&&w.status!=='draft'),'Started weeks cannot be replanned');const existing=s.allocations.find(a=>a.id===c.id);requireThat(!existing||existing.taskId===c.taskId&&existing.week===c.week,'An allocation cannot be moved to another activity or week');requireThat(!s.allocations.some(a=>a.id!==c.id&&a.taskId===t.id&&a.week===c.week),'This activity already has an allocation for that week');const promise=s.weeks.find(w=>w.key===c.week)?.commitments.find(k=>k.taskId===t.id);requireThat(!promise||c.quantity>=promise.quantity,'Allocation cannot be less than its draft promise');
  const pending=sum(s.allocations.filter(a=>a.id!==c.id&&a.taskId===t.id&&!s.weeks.some(w=>w.key===a.week&&w.status==='closed')).map(a=>{const comm=s.weeks.find(w=>w.key===a.week)?.commitments.find(k=>k.taskId===t.id);return Math.max(0,(scaled(a.quantity)-scaled(comm?commitmentActual(s,comm):0))/1000);}));
  requireThat(scaled(c.quantity)+scaled(pending)<=scaled(remaining(s,t)),'Lookahead allocations exceed remaining scope');if(existing)existing.quantity=c.quantity;else s.allocations.push({id:c.id,taskId:t.id,week:c.week,quantity:c.quantity,createdOn:now});break;
 }
 case 'unallocate':{const a=s.allocations.find(x=>x.id===c.id);requireThat(a,'Allocation not found');const w=s.weeks.find(w=>w.key===a.week);requireThat(!w||w.status==='draft','Started weeks cannot be replanned');requireThat(!w?.commitments.some(k=>k.taskId===a.taskId),'Remove the draft promise before its allocation');s.allocations=s.allocations.filter(x=>x.id!==c.id);break;}
 case 'commit':{
  const t=findTask(s,c.taskId),w=getWeek(s,c.week,true);requireThat(w.status==='draft','Commitments are frozen once a week starts');requireThat(!s.weeks.some(w=>w.commitments.some(k=>k.id===c.id)),'Commitment already exists');requireThat(!w.commitments.some(k=>k.taskId===t.id),'Only one commitment per activity per week');requireThat(ready(s,t),'Clear constraints and complete predecessor handoffs first');
  const a=s.allocations.find(a=>a.taskId===t.id&&a.week===c.week);requireThat(a,'Allocate this activity to the selected week first');requireThat(scaled(c.quantity)<=scaled(a.quantity),'Promise cannot exceed the lookahead allocation');requireThat(c.due>=c.week&&c.due<addDays(c.week,7)&&c.due>=t.start&&c.due<=t.finish,'Promise due date must be inside its week and activity schedule');requireThat(scaled(c.quantity)<=scaled(available(s,t)),'Promise exceeds unreserved remaining scope');
  w.commitments.push({id:c.id,taskId:t.id,quantity:c.quantity,due:c.due,owner:c.owner,reason:'',learning:'',anticipated:a.createdOn<c.week});break;
 }
 case 'uncommit':{const w=getWeek(s,c.week);requireThat(w.status==='draft','Frozen promises cannot be removed');requireThat(w.commitments.some(k=>k.id===c.id),'Commitment not found');w.commitments=w.commitments.filter(k=>k.id!==c.id);break;}
 case 'freeze':{
  const w=getWeek(s,c.week);requireThat(w.status==='draft','Week already started');requireThat(w.commitments.length>0,'Add at least one promise');requireThat(c.week<=now,'Cannot start a future week');requireThat(w.commitments.every(k=>ready(s,findTask(s,k.taskId))),'A promised activity is no longer ready');w.status='active';w.frozenOn=now;const items=s.allocations.filter(a=>a.week===w.key);w.plannedAtFreeze=items.length;w.readyAtFreeze=items.filter(a=>ready(s,findTask(s,a.taskId))).length;break;
 }
 case 'actual':{
  const w=s.weeks.find(w=>w.commitments.some(k=>k.id===c.commitmentId));requireThat(w,'Commitment not found');requireThat(w.status==='active','Start the week before logging; closed weeks are locked');requireThat(c.date>=w.key&&c.date<addDays(w.key,7),'Entry must be inside its commitment week');requireThat(c.date<=now,'Actuals cannot be future dated');const k=w.commitments.find(k=>k.id===c.commitmentId)!,t=findTask(s,k.taskId);requireThat(c.date>=t.start,'Cannot record work before the activity start');
  const old=s.entries.find(e=>e.commitmentId===k.id&&e.date===c.date);const others=(scaled(taskActual(s,t.id))-scaled(old?.quantity??0))/1000;requireThat(scaled(others)+scaled(c.quantity)<=scaled(t.total),'Cumulative actual exceeds activity scope');requireThat(scaled(others)+scaled(c.quantity)+scaled(reserved(s,t.id,k.id))<=scaled(t.total),'Actual would consume scope reserved for another open promise');
  if(c.quantity>(old?.quantity??0)){
   requireThat(!s.constraints.some(k=>k.taskId===t.id&&(!k.resolvedOn||k.resolvedOn>c.date)),'A constraint blocks work on this date');
   for(const p of t.predecessors){const pred=findTask(s,p);const prevIds=new Set(s.weeks.flatMap(w=>w.commitments).filter(k=>k.taskId===p).map(k=>k.id));const done=sum(s.entries.filter(e=>prevIds.has(e.commitmentId)&&e.date<c.date).map(e=>e.quantity));requireThat(scaled(done)>=scaled(pred.total),'Finish-to-start handoff must be complete before this date');}
  }
  const next={commitmentId:k.id,date:c.date,quantity:c.quantity,note:c.note};if(old)Object.assign(old,next);else s.entries.push(next);
  for(const successor of s.tasks.filter(x=>x.predecessors.includes(t.id))){const ids=new Set(s.weeks.flatMap(w=>w.commitments).filter(k=>k.taskId===successor.id).map(k=>k.id));for(const e of s.entries.filter(e=>ids.has(e.commitmentId)&&e.quantity>0)){const predIds=new Set(s.weeks.flatMap(w=>w.commitments).filter(k=>k.taskId===t.id).map(k=>k.id));const done=sum(s.entries.filter(x=>predIds.has(x.commitmentId)&&x.date<e.date).map(x=>x.quantity));requireThat(scaled(done)>=scaled(t.total),'Correction would invalidate an existing successor handoff');}}
  break;
 }
 case 'variance':{const w=s.weeks.find(w=>w.commitments.some(k=>k.id===c.commitmentId));requireThat(w&&w.status==='active','Variance can be recorded in an active week');Object.assign(w.commitments.find(k=>k.id===c.commitmentId)!,{reason:c.reason,learning:c.learning});break;}
 case 'close':{const w=getWeek(s,c.week);requireThat(w.status==='active','Only an active week can be closed');requireThat(addDays(w.key,6)<now,'Close the week after Sunday; live PPC remains a preview until then');requireThat(w.commitments.every(k=>commitmentActual(s,k,k.due)>=k.quantity||(k.reason.trim()&&k.learning.trim())),'Every missed promise needs a reason and improvement action');w.status='closed';w.closedOn=now;break;}
 }
 return s;
}
