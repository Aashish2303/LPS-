import { z } from 'zod';
import {planningIndex} from './planning-index';
import { otherReason, reasonCode } from './reason-codes';

export type Milestone={id:string;name:string;date:string;owner:string};
export type Schedule={lateStart?:string;lateFinish?:string;float?:number;importedOn?:string};
export type Task={id:string;name:string;trade:string;area:string;owner:string;unit:string;total:number;start:string;finish:string;predecessors:string[];milestoneId:string;pull:boolean;schedule?:Schedule};
export type Constraint={id:string;taskId:string;category:string;description:string;owner:string;due:string;week?:string;resolvedOn:string|null;resolution:string};
export type Allocation={id:string;taskId:string;week:string;quantity:number;createdOn:string;carry?:number};
export type Commitment={id:string;taskId:string;quantity:number;due:string;owner:string;reason:string;reasonNote?:string;learning:string;anticipated:boolean};
export type Week={key:string;status:'draft'|'active'|'closed';commitments:Commitment[];frozenOn:string|null;closedOn:string|null;readyAtFreeze:number;plannedAtFreeze:number;plan?:Allocation[];dailyDate?:string;dailyReasonsRequired?:boolean;noWorkReason?:string;ppcRule?:'weekly'};
export type Entry={commitmentId:string;date:string;quantity:number;note:string;reason?:string};
export type State={schema:1;calendarStart?:string;classroom?:boolean;name:string;code:string;client:string;location:string;start:string;finish:string;trades:string[];areas:string[];milestones:Milestone[];tasks:Task[];constraints:Constraint[];allocations:Allocation[];weeks:Week[];entries:Entry[]};
export class DomainError extends Error { constructor(message:string,public status=422){super(message);} }
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !isNaN(+d)&&d.toISOString().slice(0,10)===v;},'Enter a valid calendar date');
const text=z.string().trim().min(1).max(200);
const qty=z.number().finite().positive().max(1e9).refine(v=>Math.abs(v*1000-Math.round(v*1000))<0.0001,'Use at most three decimal places');
const id=z.string().min(1).max(100);
const scheduleSchema=z.strictObject({
 lateStart:dateSchema.optional(),lateFinish:dateSchema.optional(),
 float:z.number().finite().min(-1000000).max(1000000).optional(),
});
const taskFields={
 id,name:text,trade:text,area:text,owner:text,unit:text,total:qty,start:dateSchema,finish:dateSchema,
 predecessors:z.array(id).max(100),milestoneId:z.string().max(100).default(''),pull:z.boolean().default(true),
 schedule:scheduleSchema.optional(),
};
const importedTask=z.strictObject({
 type:z.literal('task'),...taskFields,
 constraints:z.array(z.strictObject({description:text,category:text,owner:text,due:dateSchema})).max(20).optional(),
});
const varianceFields={
 commitmentId:id,reason:text,reasonNote:z.string().trim().max(1000).optional(),learning:text,
};
export const commandSchema=z.discriminatedUnion('type',[
 z.strictObject({type:z.literal('settings'),name:text,code:text,client:z.string().max(200),location:z.string().max(200),start:dateSchema,finish:dateSchema,trades:z.array(text).min(1).max(50),areas:z.array(text).min(1).max(100)}),
 z.strictObject({type:z.literal('milestone'),id:id,name:text,date:dateSchema,owner:text}),
 z.strictObject({type:z.literal('task'),...taskFields}),
 z.strictObject({type:z.literal('editTask'),task:z.strictObject(taskFields)}),
 z.strictObject({type:z.literal('importTasks'),tasks:z.array(importedTask).min(1).max(500)}),
 z.strictObject({type:z.literal('pull'),taskId:id,selected:z.boolean()}),
 z.strictObject({type:z.literal('constraint'),id:id,taskId:id,category:text,description:text,owner:text,due:dateSchema,week:dateSchema.optional()}),
 z.strictObject({type:z.literal('resolve'),id:id,resolution:text,date:dateSchema}),
 z.strictObject({type:z.literal('allocate'),id:id,taskId:id,week:dateSchema,quantity:qty}),
 z.strictObject({type:z.literal('unallocate'),id:id}),
 z.strictObject({type:z.literal('commit'),id:id,taskId:id,week:dateSchema,quantity:qty,due:dateSchema,owner:text}),
 z.strictObject({type:z.literal('uncommit'),id:id,week:dateSchema}),
 z.strictObject({type:z.literal('freeze'),week:dateSchema,emptyReason:text.optional()}),
 z.strictObject({type:z.literal('reopenEmptyWeek'),week:dateSchema}),
 z.strictObject({type:z.literal('actual'),commitmentId:id,date:dateSchema,quantity:qty.or(z.literal(0)),note:z.string().max(1000),reason:z.string().max(30).optional()}),
 z.strictObject({type:z.literal('selectDay'),week:dateSchema,date:dateSchema}),
 z.strictObject({type:z.literal('variance'),...varianceFields}),
 z.strictObject({type:z.literal('close'),week:dateSchema,reasons:z.array(z.strictObject(varianceFields)).max(1000).optional()})
]);
export type Command=z.infer<typeof commandSchema>;
const indiaDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'});
export const today=()=>indiaDate.format(new Date());
export const addDays=(d:string,n:number)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function monday(d:string){dateSchema.parse(d);const dow=new Date(d+'T00:00:00Z').getUTCDay();return addDays(d,-((dow+6)%7));}
export function calendarAnchor(s:State){
 if(s.calendarStart)return s.calendarStart;
 const existing=s.weeks.map(w=>w.key).sort()[0];
 return existing??(s.classroom?s.start:monday(s.start));
}
export function projectWeek(s:State,date:string){
 dateSchema.parse(date);
 const anchor=calendarAnchor(s);
 const days=(Date.parse(date)-Date.parse(anchor))/86400000;
 return addDays(anchor,Math.floor(days/7)*7);
}
export function weekNumber(s:State,week:string){
 return Math.round((Date.parse(week)-Date.parse(calendarAnchor(s)))/604800000)+1;
}
export function currentExerciseWeek(s:State){
 const active=s.weeks.filter(w=>w.status==='active').map(w=>w.key).sort()[0];
 if(active)return active;
 let key=calendarAnchor(s);
 const closed=new Set(s.weeks.filter(w=>w.status==='closed').map(w=>w.key));
 while(closed.has(key))key=addDays(key,7);
 return key;
}
// Upgrade old aggregates without moving any already recorded weekly boundary.
export function classroomState(input:State):State{
 const s=structuredClone(input);
 if(!s.classroom){s.calendarStart=s.weeks.map(w=>w.key).sort()[0]??s.start;s.classroom=true;}
 for(const w of s.weeks)if(w.status==='active'){w.dailyReasonsRequired=true;w.dailyDate??=w.key;}
 return s;
}
function checkWeek(s:State,key:string){
 if(!s.classroom){requireThat(monday(key)===key,'Weeks start on Monday');return;}
 requireThat(key>=calendarAnchor(s)&&projectWeek(s,key)===key,'Use a seven-day week from the project start');
}
export function dayComplete(s:State,w:Week,date:string){
 return w.commitments.length>0&&w.commitments.every(c=>{
  const task=findTask(s,c.taskId);
  if(date<task.start)return true;
  const planned=dailyCommitmentPlan(task,w.key,c).days.find(d=>d.date===date)?.quantity??0;
  const entry=s.entries.find(e=>e.commitmentId===c.id&&e.date===date);
  return dailyEntryComplete(planned,entry,!!entry&&!dailyReasonRequired(s,w,c,date,entry.quantity));
 });
}
export function dailyCursor(w:Week){return w.dailyDate??w.key;}
const scaled=(n:number)=>Math.round(n*1000);
export const sum=(xs:number[])=>xs.reduce((s,n)=>s+scaled(n),0)/1000;
const quantityFormat=new Intl.NumberFormat('en-IN',{maximumFractionDigits:3});
export const fmt=(n:number)=>quantityFormat.format(n);
export const pct=(a:number,b:number)=>b>0?Math.round(a/b*1000)/10:null;
export function emptyState(name='Untitled project',date=today()):State{return {schema:1,name,code:'LC-001',client:'',location:'',start:date,finish:addDays(date,180),trades:['Civil','Structure','MEP','Finishes'],areas:['Zone A','Zone B'],milestones:[],tasks:[],constraints:[],allocations:[],weeks:[],entries:[]};}
function requireThat(ok:unknown,msg:string):asserts ok{if(!ok)throw new DomainError(msg);}
export function findTask(s:State,id:string){const index=planningIndex(s),t=index?index.tasks.get(id):s.tasks.find(t=>t.id===id);requireThat(t,'Activity not found');return t;}
export function commitmentActual(s:State,c:Commitment,through='9999-12-31'){const index=planningIndex(s);return index?index.commitmentActual(c.id,through):sum(s.entries.filter(e=>e.commitmentId===c.id&&e.date<=through).map(e=>e.quantity));}
export function taskActual(s:State,taskId:string,through='9999-12-31'){const index=planningIndex(s);if(index)return index.taskActual(taskId,through);const ids=new Set(s.weeks.flatMap(w=>w.commitments).filter(c=>c.taskId===taskId).map(c=>c.id));return sum(s.entries.filter(e=>ids.has(e.commitmentId)&&e.date<=through).map(e=>e.quantity));}
export function remaining(s:State,t:Task){return (scaled(t.total)-scaled(taskActual(s,t.id)))/1000;}
export function blockers(s:State,t:Task,date?:string){
 const index=planningIndex(s),cached=index?.issues.get(t.id);
 if(cached?.has(date))return cached.get(date)!;
 const result=calculateBlockers(s,t,date);
 if(index){let values=cached;if(!values){values=new Map();index.issues.set(t.id,values);}values.set(date,result);}
 return result;
}
function calculateBlockers(s:State,t:Task,date?:string){
 const index=planningIndex(s),taskById=index?.tasks??new Map(s.tasks.map(task=>[task.id,task]));
 const ancestors=new Map<string,Task>();
 const pending=index?[]:[...t.predecessors];
 if(index)for(const predecessor of index.ancestorTasks(t))ancestors.set(predecessor.id,predecessor);
 while(pending.length){
  const task=taskById.get(pending.pop()!);
  if(!task||ancestors.has(task.id))continue;
  ancestors.set(task.id,task);
  pending.push(...task.predecessors);
 }
 // Classroom readiness follows recorded constraints, not predecessor actual completion.
 // Keep ancestor traversal so a constraint still blocks every downstream activity.
 return s.constraints.filter(c=>
  (c.taskId===t.id||ancestors.has(c.taskId))&&(!c.week||!date||c.week<=date)&&(!c.resolvedOn||(date&&c.resolvedOn>date)),
 ).map(c=>c.taskId===t.id?c.description:taskById.get(c.taskId)?.name+': '+c.description);
}
export function ready(s:State,t:Task,date?:string){
 return remaining(s,t)>0&&blockers(s,t,date).length===0;
}

const daysBetween=(start:string,end:string)=>(Date.parse(end)-Date.parse(start))/86400000;
function phaseQuantityThrough(task:Task,date:string){
 const duration=daysBetween(task.start,task.finish)+1;
 const days=Math.max(0,Math.min(duration,daysBetween(task.start,date)+1));
 // Round cumulative quantities in integer thousandths, then take weekly differences.
 const numerator=BigInt(scaled(task.total))*BigInt(days);
 return Number((2n*numerator+BigInt(duration))/(2n*BigInt(duration)));
}
export function activityDaysInWeek(task:Task,week:string){
 const start=task.start>week?task.start:week;
 const weekEnd=addDays(week,6),finish=task.finish<weekEnd?task.finish:weekEnd;
 return {start,finish,days:Math.max(0,daysBetween(start,finish)+1)};
}
// Split the fixed weekly promise over its planned work dates using cumulative
// thousandths, so rounding never creates or loses weekly scope.
export function dailyCommitmentPlan(task:Task,week:string,commitment:Pick<Commitment,'quantity'|'due'>){
 const carryover=task.finish<week;
 const scheduled=activityDaysInWeek(task,week);
 const start=carryover?week:scheduled.start;
 const targetFinish=carryover?addDays(week,6):scheduled.finish;
 const finish=commitment.due<targetFinish?commitment.due:targetFinish;
 const workingDays=Math.max(0,daysBetween(start,finish)+1);
 const units=BigInt(scaled(commitment.quantity));
 const through=(n:number)=>workingDays?Number((2n*units*BigInt(n)+BigInt(workingDays))/(2n*BigInt(workingDays))):0;
 const days=Array.from({length:7},(_,i)=>{
  const date=addDays(week,i),n=daysBetween(start,date)+1;
  return {date,quantity:date<start||date>finish?0:(through(n)-through(n-1))/1000};
 });
 return {start,finish,workingDays,carryover,average:workingDays?commitment.quantity/workingDays:0,days};
}
export function dailyEntryComplete(planned:number,entry?:Entry,quantityAlreadyComplete=false){
 if(!entry)return false;
 if(quantityAlreadyComplete||scaled(entry.quantity)>=scaled(planned))return true;
 const code=reasonCode(entry.reason??'');
 return !!code&&(code!==otherReason||!!entry.note.trim());
}
// Compare a candidate replacement against work completed by this date only.
// Future entries must never waive an earlier day's shortfall reason.
export function dailyReasonRequired(s:State,w:Week,c:Commitment,date:string,quantity:number){
 const task=findTask(s,c.taskId),previous=addDays(date,-1),units=scaled(quantity);
 if(scaled(commitmentActual(s,c,previous))+units>=scaled(c.quantity))return false;
 if(scaled(taskActual(s,task.id,previous))+units>=scaled(task.total))return false;
 const planned=dailyCommitmentPlan(task,w.key,c).days.find(d=>d.date===date)?.quantity??0;
 return units<scaled(planned);
}
export function weeklyPpcRule(w:Week){return w.ppcRule==='weekly'||w.status!=='closed';}
export function commitmentOutcome(s:State,w:Week,c:Commitment){
 const byDue=commitmentActual(s,c,c.due),byWeek=commitmentActual(s,c,addDays(w.key,6));
 const completed=scaled(byWeek)>=scaled(c.quantity),onTime=scaled(byDue)>=scaled(c.quantity);
 return {byDue,byWeek,completed,onTime,late:completed&&!onTime,ppcMet:weeklyPpcRule(w)?completed:onTime,requiresReason:!onTime};
}
export function phaseWeekQuantity(task:Task,week:string){
 return (phaseQuantityThrough(task,addDays(week,6))-phaseQuantityThrough(task,addDays(week,-1)))/1000;
}
export function weekAllocations(s:State,week:string):Allocation[]{
 const index=planningIndex(s),cached=index?.forecasts.get(week);if(cached)return cached;
 const result=calculateWeekAllocations(s,week);index?.forecasts.set(week,result);return result;
}
function calculateWeekAllocations(s:State,week:string):Allocation[]{
 const record=s.weeks.find(w=>w.key===week);
 if(record?.plan)return record.plan;
 const overrides=s.allocations.filter(a=>a.week===week);
 if(record&&record.status!=='draft')return overrides;
 const byTask=new Map(overrides.map(a=>[a.taskId,a]));
 const prior=addDays(week,-7);
 const canCarry=s.weeks.some(w=>w.key===prior&&w.status==='closed');
 return s.tasks.flatMap(task=>{
  const manual=byTask.get(task.id);
  if(manual)return [manual];
  const base=phaseWeekQuantity(task,week);
  let quantity=base;
  if(canCarry){
   const cutoff=addDays(week,-1);
   const actual=scaled(taskActual(s,task.id,cutoff));
   const target=phaseQuantityThrough(task,addDays(week,6));
   quantity=Math.max(0,target-actual)/1000;
  }
  if(quantity<=0)return [];
  return [{id:'phase:'+task.id+':'+week,taskId:task.id,week,quantity,
   createdOn:task.schedule?.importedOn??week,carry:Math.max(0,sum([quantity,-base]))}];
 });
}
export function forecastDue(task:Task,week:string){
 const sunday=addDays(week,6);
 return task.finish<week?sunday:task.finish<sunday?task.finish:sunday;
}
function getWeek(s:State,key:string,create=false){checkWeek(s,key);let w=s.weeks.find(w=>w.key===key);if(!w&&create){w={key,status:'draft',commitments:[],frozenOn:null,closedOn:null,readyAtFreeze:0,plannedAtFreeze:0};s.weeks.push(w);}requireThat(w,'Create commitments before starting this week');return w;}
export function metrics(s:State,w:Week){const done=w.commitments.filter(c=>commitmentOutcome(s,w,c).ppcMet).length;return {total:w.commitments.length,done,ppc:pct(done,w.commitments.length),ta:pct(w.commitments.filter(c=>c.anticipated).length,w.commitments.length),tmr:w.frozenOn?pct(w.readyAtFreeze,w.plannedAtFreeze):null};}
function reserved(s:State,taskId:string,except?:string){return sum(s.weeks.filter(w=>w.status!=='closed').flatMap(w=>w.commitments).filter(c=>c.taskId===taskId&&c.id!==except).map(c=>Math.max(0,(scaled(c.quantity)-scaled(commitmentActual(s,c)))/1000)))}
export function available(s:State,t:Task){return (scaled(remaining(s,t))-scaled(reserved(s,t.id)))/1000;}
// Use the same eligibility rules for the planning controls and deliberate no-work weeks.
export function weeklyCandidates(s:State,week:string){
 const committed=new Set(s.weeks.find(w=>w.key===week)?.commitments.map(c=>c.taskId));
 return weekAllocations(s,week).filter(a=>a.quantity>0&&!committed.has(a.taskId)).map(a=>{
  const task=findTask(s,a.taskId),due=forecastDue(task,week),issues=[...blockers(s,task,due)];
  if(remaining(s,task)<=0)issues.push('Activity scope is already complete');
  else if(scaled(a.quantity)>scaled(available(s,task)))issues.push('Forecast exceeds unreserved remaining scope');
  return {task,quantity:a.quantity,due,issues,eligible:issues.length===0};
 });
}
function sameUnitTotals(s:State,which:'actual'|'total'){const r:Record<string,number[]>=Object.create(null);s.tasks.forEach(t=>(r[t.unit]??=[]).push(which==='actual'?taskActual(s,t.id):t.total));return Object.fromEntries(Object.entries(r).map(([k,v])=>[k,sum(v)]));}
export const unitTotals=(s:State)=>({actual:sameUnitTotals(s,'actual'),total:sameUnitTotals(s,'total')});

export function network(s:State){
 const visiting=new Set<string>(),seen=new Set<string>(),order:Task[]=[];
 function visit(t:Task){requireThat(!visiting.has(t.id),'Dependency cycle detected');if(seen.has(t.id))return;visiting.add(t.id);for(const p of t.predecessors){requireThat(p!==t.id,'An activity cannot depend on itself');visit(findTask(s,p));}visiting.delete(t.id);seen.add(t.id);order.push(t);}
 s.tasks.forEach(visit);
 const result:Record<string,{es:string;ef:string;ls:string;lf:string;float:number;duration:number}>=Object.create(null);
 for(const t of order){const duration=Math.round((Date.parse(t.finish)-Date.parse(t.start))/86400000)+1;let es=s.start;for(const p of t.predecessors){const next=addDays(result[p].ef,1);if(next>es)es=next;}const ef=addDays(es,duration-1);result[t.id]={es,ef,ls:es,lf:ef,float:0,duration};}
 const end=order.reduce((end,t)=>result[t.id].ef>end?result[t.id].ef:end,s.start);
 for(const t of [...order].reverse()){const successors=order.filter(u=>u.predecessors.includes(t.id));const lf=successors.length?successors.map(u=>addDays(result[u.id].ls,-1)).sort()[0]:end;const ls=addDays(lf,1-result[t.id].duration);result[t.id]={...result[t.id],ls,lf,float:Math.round((Date.parse(ls)-Date.parse(result[t.id].es))/86400000)};}
 return result;
}

function phaseDateRange(tasks:Task[]){
 const start=tasks.map(task=>task.start).sort()[0];
 const finish=tasks.map(task=>task.schedule?.lateFinish??task.finish).sort().at(-1)!;
 requireThat(finish>=start,'Latest late finish must be on or after the earliest early start');
 return {start,finish};
}

function saveVariance(commitment:Commitment, details:{reason:string;reasonNote?:string;learning:string}){
 const code=reasonCode(details.reason);
 requireThat(code,'Select a reason code');
 requireThat(code!==otherReason||details.reasonNote,'Explain the reason when selecting RC-16');
 Object.assign(commitment,{reason:code,reasonNote:details.reasonNote??'',learning:details.learning});
}

export function applyCommand(input:State,raw:unknown,now=today()):State{
 const parsed=commandSchema.safeParse(raw);if(!parsed.success)throw new DomainError(parsed.error.issues.map(x=>x.path.join('.')+': '+x.message).join('; '));
 const c=parsed.data,s=structuredClone(input);
 switch(c.type){
 case 'settings':requireThat(!s.weeks.some(w=>w.status!=='draft')||c.start===s.start,'Project start is fixed after a week starts');if(s.classroom&&!s.weeks.some(w=>w.status!=='draft'))s.calendarStart=c.start;requireThat(c.finish>=c.start,'Project finish must follow its start');requireThat(s.tasks.every(t=>t.start>=c.start&&(t.schedule?.lateFinish??t.finish)<=c.finish),'Project dates must contain every activity');requireThat(s.tasks.every(t=>c.trades.includes(t.trade)&&c.areas.includes(t.area)),'Keep trades and areas used by activities');Object.assign(s,{name:c.name,code:c.code,client:c.client,location:c.location,start:c.start,finish:c.finish,trades:[...new Set(c.trades)],areas:[...new Set(c.areas)]});break;
 case 'importTasks':{
  const ids=new Set(s.tasks.map(task=>task.id));
  for(const row of c.tasks){
   requireThat(!ids.has(row.id),'Duplicate activity ID: '+row.id);
   requireThat(row.finish>=row.start,'Early finish precedes early start for '+row.id);
   requireThat(!row.schedule?.lateStart||!row.schedule.lateFinish||row.schedule.lateStart<=row.schedule.lateFinish,
    'Late finish precedes late start for '+row.id);
   ids.add(row.id);
   const {type,constraints,...task}=row;
   s.tasks.push({...task,pull:true,milestoneId:'',predecessors:[...new Set(row.predecessors)],
    schedule:{...row.schedule,importedOn:now}});
   for(const constraint of constraints??[]){
    let sequence=s.constraints.length+1;
    while(s.constraints.some(k=>k.id==='import:'+sequence))sequence++;
    const constraintId='import:'+sequence;
    s.constraints.push({...constraint,id:constraintId,taskId:row.id,resolvedOn:null,resolution:''});
   }
  }
  const trades=[...new Set([...s.trades,...c.tasks.map(task=>task.trade)])];
  const areas=[...new Set([...s.areas,...c.tasks.map(task=>task.area)])];
  requireThat(trades.length<=50&&areas.length<=100,'Project exceeds the trade or area limit');
  for(const row of c.tasks)for(const predecessor of row.predecessors){
   requireThat(ids.has(predecessor),row.id+' references unknown predecessor '+predecessor);
  }
  const range=phaseDateRange(s.tasks);
  if(!s.weeks.some(w=>w.status!=='draft')){s.calendarStart=range.start;s.classroom=true;}
  Object.assign(s,range,{trades,areas});
  network(s);
  break;
 }
 case 'milestone':requireThat(!s.milestones.some(m=>m.id===c.id),'Milestone already exists');requireThat(c.date>=s.start&&c.date<=s.finish,'Milestone must fall within the project');s.milestones.push({id:c.id,name:c.name,date:c.date,owner:c.owner});break;
 case 'task':{
  requireThat(c.start>=s.start&&c.finish<=s.finish&&c.finish>=c.start,'Activity dates must be ordered and within the project');requireThat(s.trades.includes(c.trade)&&s.areas.includes(c.area),'Select an existing trade and area');requireThat(!c.milestoneId||s.milestones.some(m=>m.id===c.milestoneId),'Milestone not found');requireThat(!s.tasks.some(t=>t.id===c.id),'Activity already exists');
  s.tasks.push({id:c.id,name:c.name,trade:c.trade,area:c.area,owner:c.owner,unit:c.unit,total:c.total,start:c.start,finish:c.finish,predecessors:[...new Set(c.predecessors)],milestoneId:c.milestoneId,pull:c.pull,schedule:c.schedule});network(s);for(const p of c.predecessors)requireThat(findTask(s,p).finish<c.start,'Finish-to-start predecessor must finish before this activity starts');if(c.milestoneId)requireThat(c.finish<=s.milestones.find(m=>m.id===c.milestoneId)!.date,'Activity finishes after its milestone');break;
 }
 case 'editTask':{const old=findTask(s,c.task.id);requireThat(!s.weeks.some(w=>w.commitments.some(k=>k.taskId===old.id)),'An activity with a promise has a frozen scope and baseline');requireThat(!s.allocations.some(a=>a.taskId===old.id),'Remove forecast allocations before editing this activity');const next=structuredClone(s);next.tasks=next.tasks.filter(t=>t.id!==old.id);return applyCommand(next,{type:'task',...c.task},now);}
 case 'pull':{const t=findTask(s,c.taskId);requireThat(c.selected||!s.allocations.some(a=>a.taskId===t.id)&&!s.weeks.some(w=>w.commitments.some(k=>k.taskId===t.id)),'An allocated or committed activity must remain in the pull plan');t.pull=c.selected;break;}
 case 'constraint':if(c.week){checkWeek(s,c.week);requireThat(!s.weeks.some(w=>w.key===c.week&&w.status==='closed'),'Closed weeks are locked');}findTask(s,c.taskId);requireThat(!s.constraints.some(k=>k.id===c.id),'Constraint already exists');s.constraints.push({id:c.id,taskId:c.taskId,category:c.category,description:c.description,owner:c.owner,due:c.due,week:c.week,resolvedOn:null,resolution:''});break;
 case 'resolve':{const k=s.constraints.find(k=>k.id===c.id);requireThat(k,'Constraint not found');requireThat(!k.resolvedOn,'Constraint is already resolved');k.resolvedOn=c.date;k.resolution=c.resolution;break;}
 case 'allocate':{
  checkWeek(s,c.week);const t=findTask(s,c.taskId);requireThat(c.week<=t.finish&&addDays(c.week,6)>=t.start,'Allocation week must overlap the activity schedule');requireThat(!s.weeks.some(w=>w.key===c.week&&w.status!=='draft'),'Started weeks cannot be replanned');const existing=s.allocations.find(a=>a.id===c.id);requireThat(!existing||existing.taskId===c.taskId&&existing.week===c.week,'An allocation cannot be moved to another activity or week');requireThat(!s.allocations.some(a=>a.id!==c.id&&a.taskId===t.id&&a.week===c.week),'This activity already has an allocation for that week');const promise=s.weeks.find(w=>w.key===c.week)?.commitments.find(k=>k.taskId===t.id);requireThat(!promise||c.quantity>=promise.quantity,'Allocation cannot be less than its draft promise');
  const pending=sum(s.allocations.filter(a=>a.id!==c.id&&a.taskId===t.id&&!s.weeks.some(w=>w.key===a.week&&w.status==='closed')).map(a=>{const comm=s.weeks.find(w=>w.key===a.week)?.commitments.find(k=>k.taskId===t.id);return Math.max(0,(scaled(a.quantity)-scaled(comm?commitmentActual(s,comm):0))/1000);}));
  requireThat(scaled(c.quantity)+scaled(pending)<=scaled(remaining(s,t)),'Lookahead allocations exceed remaining scope');if(existing)existing.quantity=c.quantity;else s.allocations.push({id:c.id,taskId:t.id,week:c.week,quantity:c.quantity,createdOn:now});break;
 }
 case 'unallocate':{const a=s.allocations.find(x=>x.id===c.id);requireThat(a,'Allocation not found');const w=s.weeks.find(w=>w.key===a.week);requireThat(!w||w.status==='draft','Started weeks cannot be replanned');requireThat(!w?.commitments.some(k=>k.taskId===a.taskId),'Remove the draft promise before its allocation');s.allocations=s.allocations.filter(x=>x.id!==c.id);break;}
 case 'commit':{
  const t=findTask(s,c.taskId),w=getWeek(s,c.week,true);if(s.classroom)requireThat(c.week===currentExerciseWeek(s),'Make promises for the current exercise week');requireThat(w.status==='draft','Commitments are frozen once a week starts');requireThat(!s.weeks.some(w=>w.commitments.some(k=>k.id===c.id)),'Commitment already exists');requireThat(!w.commitments.some(k=>k.taskId===t.id),'Only one commitment per activity per week');requireThat(ready(s,t,c.due),'Clear constraints on this activity and its predecessors first');
  const a=weekAllocations(s,c.week).find(a=>a.taskId===t.id);requireThat(a,'No forecast quantity is scheduled for this activity in this week');requireThat(scaled(c.quantity)===scaled(a.quantity),'Promise must equal the full weekly forecast quantity');requireThat(c.due>=c.week&&c.due<addDays(c.week,7)&&c.due>=t.start&&c.due<=forecastDue(t,c.week),'Promise due date must be inside its week and activity schedule');requireThat(scaled(c.quantity)<=scaled(available(s,t)),'Promise exceeds unreserved remaining scope');
  w.commitments.push({id:c.id,taskId:t.id,quantity:c.quantity,due:c.due,owner:c.owner,reason:'',learning:'',anticipated:a.createdOn<c.week});break;
 }
 case 'uncommit':{const w=getWeek(s,c.week);requireThat(w.status==='draft','Frozen promises cannot be removed');requireThat(w.commitments.some(k=>k.id===c.id),'Commitment not found');w.commitments=w.commitments.filter(k=>k.id!==c.id);break;}
 case 'freeze':{
  const w=getWeek(s,c.week,true);
  requireThat(w.status==='draft','Week already started');
  if(s.classroom)requireThat(c.week===currentExerciseWeek(s),'Close the current exercise week before starting the next week');
  if(!w.commitments.length){
   requireThat(c.emptyReason,'Commit at least one activity before starting the week');
   requireThat(!weeklyCandidates(s,w.key).some(a=>a.eligible),'Ready activities are available. Commit activities before starting the week');
   w.noWorkReason=c.emptyReason;
  }else requireThat(!c.emptyReason,'A week with commitments cannot be marked as no work');
  requireThat(w.commitments.every(k=>ready(s,findTask(s,k.taskId),k.due)),'A promised activity is no longer ready');
  const items=weekAllocations(s,w.key);
  requireThat(w.commitments.every(k=>items.some(a=>a.taskId===k.taskId&&scaled(a.quantity)===scaled(k.quantity))),'A forecast has changed. Remove and remake the affected promise before starting the week');
  w.plan=items;w.dailyDate=w.key;w.dailyReasonsRequired=!!s.classroom;w.status='active';w.frozenOn=now;w.ppcRule='weekly';
  w.plannedAtFreeze=items.length;w.readyAtFreeze=items.filter(a=>ready(s,findTask(s,a.taskId),forecastDue(findTask(s,a.taskId),w.key))).length;
  break;
 }
 case 'reopenEmptyWeek':{
  const w=getWeek(s,c.week);
  requireThat(w.status==='active'&&!w.commitments.length,'Only an active week without commitments can return to planning');
  requireThat(!s.entries.some(e=>e.date>=w.key&&e.date<addDays(w.key,7)),'A week with recorded entries cannot return to planning');
  w.status='draft';w.frozenOn=null;w.closedOn=null;w.readyAtFreeze=0;w.plannedAtFreeze=0;
  delete w.plan;delete w.dailyDate;delete w.dailyReasonsRequired;delete w.noWorkReason;
  break;
 }
 case 'actual':{
  const w=s.weeks.find(w=>w.commitments.some(k=>k.id===c.commitmentId));requireThat(w,'Commitment not found');requireThat(w.status==='active','Start the week before logging; closed weeks are locked');requireThat(c.date>=w.key&&c.date<addDays(w.key,7),'Entry must be inside its commitment week');const k=w.commitments.find(k=>k.id===c.commitmentId)!,t=findTask(s,k.taskId);requireThat(c.date>=t.start||c.quantity===0,'Cannot record work before the activity start');
  let savedReason:string|undefined;
  if(s.classroom||w.dailyReasonsRequired){
   requireThat(c.date<=dailyCursor(w),'Save the current day’s quantities and required reasons before advancing');
   if(dailyReasonRequired(s,w,k,c.date,c.quantity)){
    const code=reasonCode(c.reason??'');
    requireThat(code,'Select a daily reason when actual is below the daily plan');
    requireThat(code!==otherReason||!!c.note.trim(),'Explain the daily reason when selecting RC-16');
    savedReason=code;
   }
  }else savedReason=c.reason;
  const old=s.entries.find(e=>e.commitmentId===k.id&&e.date===c.date);const others=(scaled(taskActual(s,t.id))-scaled(old?.quantity??0))/1000;requireThat(scaled(others)+scaled(c.quantity)<=scaled(t.total),'Cumulative actual exceeds activity scope');requireThat(scaled(others)+scaled(c.quantity)+scaled(reserved(s,t.id,k.id))<=scaled(t.total),'Actual would consume scope reserved for another open promise');
  if(c.quantity>(old?.quantity??0)){
   const issues=blockers(s,t,c.date);
   requireThat(issues.length===0,'A constraint blocks work on this date: '+issues.join(' · '));
  }
  const next={commitmentId:k.id,date:c.date,quantity:c.quantity,note:c.note,reason:savedReason};if(old)Object.assign(old,next);else s.entries.push(next);
  if(s.classroom||w.dailyReasonsRequired){
   for(let date=addDays(c.date,1);date<=dailyCursor(w);date=addDays(date,1)){
    if(!dayComplete(s,w,date)){w.dailyDate=date;break;}
   }
  }
  break;
 }
 case 'selectDay':{
  const w=getWeek(s,c.week);
  requireThat(w.status==='active','Daily review is available in an active week');
  requireThat(w.commitments.length,'Return to weekly planning and commit activities before daily check-in');
  requireThat(c.date>=w.key&&c.date<=addDays(w.key,6),'Choose a day inside this week');
  const cursor=dailyCursor(w);
  requireThat(c.date<=addDays(cursor,1),'Advance one day at a time');
  if(c.date>cursor)requireThat(dayComplete(s,w,cursor),'Save quantities and required shortfall reasons for every activity before the next day');
  if(c.date>cursor)w.dailyDate=c.date;
  break;
 }
 case 'variance':{
  const w=s.weeks.find(w=>w.commitments.some(k=>k.id===c.commitmentId));
  requireThat(w&&w.status==='active','Variance can be recorded in an active week');
  saveVariance(w.commitments.find(k=>k.id===c.commitmentId)!,c);
  break;
 }
 case 'close':{
  const w=getWeek(s,c.week);
  requireThat(w.status==='active','Only an active week can be closed');
  const missed=w.commitments.filter(k=>commitmentOutcome(s,w,k).requiresReason);
  const byId=new Map(missed.map(k=>[k.id,k]));
  const evaluated=new Set<string>();
  for(const details of c.reasons??[]){
   const commitment=byId.get(details.commitmentId);
   requireThat(commitment&&!evaluated.has(details.commitmentId),'Choose one primary reason for each delayed or incomplete commitment in this week');
   saveVariance(commitment,details);
   evaluated.add(details.commitmentId);
  }
  requireThat(missed.every(k=>reasonCode(k.reason)&&k.learning.trim()&&(reasonCode(k.reason)!==otherReason||k.reasonNote?.trim())),'Every delayed or incomplete commitment needs a reason and improvement action');
  w.ppcRule='weekly';
  w.status='closed';
  w.closedOn=now;
  break;
 }
 }
 return s;
}
