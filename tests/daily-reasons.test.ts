import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addDays,applyCommand,classroomState,dailyCommitmentPlan,dayComplete,emptyState,type State} from '../lib/domain';
import {parsePhaseCsv} from '../lib/phase-csv';
const week='2026-11-22';
const run=(s:State,c:unknown)=>applyCommand(s,c,week);
function fixture(){
 let s=run(emptyState('Daily reasons',week),parsePhaseCsv('id,name,trade,area,owner,unit,total,early_start,early_finish\nA,Excavation,Civil,Zone A,Lead,CuM,15.909,2026-11-22,2026-11-24'));
 s=run(s,{type:'commit',id:'c',taskId:'A',week,quantity:15.909,due:'2026-11-24',owner:'Lead'});
 return run(s,{type:'freeze',week});
}
const record=(s:State,quantity:number,reason?:string,note='',date=week)=>run(s,{type:'actual',commitmentId:'c',date,quantity,reason,note});

test('meeting or exceeding the exact daily plan saves with no reason and allows day advance',()=>{
 for(const quantity of [5.303,6]){
  const s=record(fixture(),quantity);assert.equal(s.entries[0].reason,undefined);assert.equal(dayComplete(s,s.weeks[0],week),true);
  assert.equal(run(s,{type:'selectDay',week,date:addDays(week,1)}).weeks[0].dailyDate,addDays(week,1));
 }
});
test('shortfalls reject omitted, blank, ON_PLAN and invalid reasons on the server',()=>{
 const s=fixture(),before=structuredClone(s);
 for(const reason of [undefined,'','ON_PLAN','Work as planned','invalid'])assert.throws(()=>record(s,5.302,reason),/daily reason/);
 assert.deepEqual(s,before);assert.equal(dayComplete(s,s.weeks[0],week),false);
});
test('a shortfall saves only with a valid reason and Other requires an explanation',()=>{
 let s=fixture();assert.throws(()=>record(s,1,'RC-16','   '),/Explain/);
 s=record(s,1,'RC-16','Excavator broke down during the lesson');assert.equal(s.entries[0].reason,'RC-16');assert.equal(dayComplete(s,s.weeks[0],week),true);
 s=record(s,2,'RC-09');assert.equal(s.entries.length,1);assert.equal(s.entries[0].reason,'RC-09');
});
test('correcting a met target to a shortfall requires a reason; recovering clears the old delay reason',()=>{
 let s=record(fixture(),5.303),before=structuredClone(s);
 assert.throws(()=>record(s,4),/daily reason/);assert.deepEqual(s,before);
 s=record(s,4,'RC-07');assert.equal(s.entries[0].reason,'RC-07');
 s=record(s,5.303);assert.equal(s.entries[0].reason,undefined);assert.equal(s.entries.length,1);assert.equal(dayComplete(s,s.weeks[0],week),true);
 // A stale client reason must not create a delay when the target has been met.
 s=record(s,6,'RC-16');assert.equal(s.entries[0].reason,undefined);
});
test('a saved zero quantity needs no reason when that day has no planned work',()=>{
 let s=fixture();
 for(let i=0;i<3;i++){if(i)s=run(s,{type:'selectDay',week,date:addDays(week,i)});s=record(s,5.303,undefined,'',addDays(week,i));}
 const date=addDays(week,3);s=run(s,{type:'selectDay',week,date});s=record(s,0,undefined,'',date);
 assert.equal(s.entries.at(-1)!.reason,undefined);assert.equal(dayComplete(s,s.weeks[0],date),true);
});
test('old ON_PLAN shortfalls cannot count as a saved day; met targets with no reason can',()=>{
 let s=fixture();s.entries.push({commitmentId:'c',date:week,quantity:1,reason:'ON_PLAN',note:''});
 s=classroomState(s);assert.equal(dayComplete(s,s.weeks[0],week),false);
 assert.throws(()=>run(s,{type:'selectDay',week,date:addDays(week,1)}),/shortfall reasons/);
 s=record(s,1,'RC-10');assert.equal(dayComplete(s,s.weeks[0],week),true);
 s=record(s,5.303);assert.equal(dayComplete(s,s.weeks[0],week),true);
});
test('shortfall validation applies to classroom weeks even if an older flag is absent',()=>{
 const s=fixture();delete s.weeks[0].dailyReasonsRequired;
 assert.throws(()=>record(s,1,'ON_PLAN'),/daily reason/);
 const plan=dailyCommitmentPlan(s.tasks[0],week,s.weeks[0].commitments[0]);assert.equal(plan.days[0].quantity,5.303);
});
