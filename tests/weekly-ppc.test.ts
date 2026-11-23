import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addDays,applyCommand,commitmentActual,commitmentOutcome,dailyCommitmentPlan,dailyReasonRequired,dayComplete,emptyState,metrics,taskActual,weekAllocations,weeklyPpcRule,type State} from '../lib/domain';
import {parsePhaseCsv} from '../lib/phase-csv';
import {preparePlanningState} from '../lib/planning-index';
const week='2026-11-22',mon=addDays(week,1),tue=addDays(week,2),wed=addDays(week,3),thu=addDays(week,4),end=addDays(week,6);
const run=(s:State,c:unknown)=>applyCommand(s,c,week);
function fixture(total=18,finish=wed){
 let s=run(emptyState('Weekly PPC',week),parsePhaseCsv(`id,name,trade,area,owner,unit,total,early_start,early_finish\nA,Excavation,Civil,Zone A,Lead,m³,${total},${mon},${finish}\nZ,Project setup,Civil,Zone A,Lead,lot,1,${week},${week}`));
 const quantity=weekAllocations(s,week)[0].quantity;
 s=run(s,{type:'commit',id:'c',taskId:'A',week,quantity,due:wed,owner:'Lead'});
 return run(s,{type:'freeze',week});
}
function select(s:State,date:string){return run(s,{type:'selectDay',week,date});}
function record(s:State,date:string,quantity:number,reason?:string){return run(s,{type:'actual',commitmentId:'c',date,quantity,reason,note:''});}
function early(total=18,finish=wed){let s=fixture(total,finish),q=s.weeks[0].commitments[0].quantity;s=select(s,mon);s=record(s,mon,q/3);s=select(s,tue);return record(s,tue,q*2/3);}
function late(){let s=fixture();s=select(s,mon);s=record(s,mon,6);s=select(s,tue);s=record(s,tue,6);s=select(s,wed);s=record(s,wed,0,'RC-09');s=select(s,thu);return record(s,thu,6);}
const evaluations=[{commitmentId:'c',reason:'RC-09',learning:'Lead to confirm equipment before the promised day'}];

test('Wednesday promise completed Thursday achieves weekly PPC and requires a closeout delay reason',()=>{
 let s=late();const w=s.weeks[0],c=w.commitments[0],outcome=commitmentOutcome(s,w,c);
 assert.equal(outcome.byDue,12);assert.equal(outcome.byWeek,18);assert.equal(outcome.late,true);assert.equal(outcome.ppcMet,true);assert.equal(outcome.requiresReason,true);assert.equal(metrics(s,w).ppc,100);
 const before=structuredClone(s);assert.throws(()=>run(s,{type:'close',week}),/delayed or incomplete.*reason/);assert.deepEqual(s,before);
 s=run(s,{type:'close',week,reasons:evaluations});assert.equal(s.weeks[0].commitments[0].reason,'RC-09');assert.equal(metrics(s,s.weeks[0]).ppc,100);assert.equal(s.weeks[0].ppcRule,'weekly');
 assert.throws(()=>record(s,thu,5),/locked/);
});
test('Tuesday completion permits Wednesday zero without a daily reason and needs no closeout delay reason',()=>{
 let s=early();assert.equal(taskActual(s,'A'),18);s=select(s,wed);
 assert.equal(dailyCommitmentPlan(s.tasks[0],week,s.weeks[0].commitments[0]).days[3].quantity,6);
 assert.equal(dailyReasonRequired(s,s.weeks[0],s.weeks[0].commitments[0],wed,0),false);
 s=record(s,wed,0);assert.equal(s.entries.at(-1)!.reason,undefined);assert.equal(dayComplete(s,s.weeks[0],wed),true);
 s=run(s,{type:'close',week});assert.equal(metrics(s,s.weeks[0]).ppc,100);assert.equal(s.weeks[0].commitments[0].reason,'');
});
test('completing this week’s quantity waives later reasons even when the full activity spans more weeks',()=>{
 let s=early(60,'2026-12-02');assert.equal(commitmentActual(s,s.weeks[0].commitments[0]),36);assert.equal(taskActual(s,'A'),36);
 s=select(s,wed);s=record(s,wed,0);assert.equal(dayComplete(s,s.weeks[0],wed),true);assert.equal(s.entries.at(-1)!.reason,undefined);
});
test('future completion cannot waive an earlier daily shortfall',()=>{
 let s=fixture();s=select(s,mon);s.entries.push({commitmentId:'c',date:tue,quantity:18,note:''});
 assert.equal(dailyReasonRequired(s,s.weeks[0],s.weeks[0].commitments[0],mon,0),true);
 assert.throws(()=>record(s,mon,0),/daily reason/);assert.equal(dayComplete(s,s.weeks[0],mon),false);
});
test('correcting early completion reopens later shortfalls and returns the cursor for reason review',()=>{
 let s=early();s=select(s,wed);s=record(s,wed,0);s=select(s,thu);
 s=record(s,tue,6);assert.equal(s.weeks[0].dailyDate,wed);assert.equal(dayComplete(s,s.weeks[0],wed),false);
 assert.throws(()=>record(s,wed,0),/daily reason/);assert.throws(()=>select(s,thu),/shortfall reasons/);
 s=record(s,wed,0,'RC-10');s=select(s,thu);assert.equal(s.weeks[0].dailyDate,thu);
});
test('a fractional weekly shortfall is PPC zero and a later week cannot repair that historical result',()=>{
 let s=fixture();s=select(s,mon);s=record(s,mon,17.999);s=run(s,{type:'close',week,reasons:evaluations});const first=structuredClone(s.weeks[0]);assert.equal(metrics(s,first).ppc,0);
 const next=addDays(week,7),quantity=weekAllocations(s,next)[0].quantity;assert.equal(quantity,.001);
 s=run(s,{type:'commit',id:'c2',taskId:'A',week:next,quantity,due:addDays(next,6),owner:'Lead'});s=run(s,{type:'freeze',week:next});s=run(s,{type:'actual',commitmentId:'c2',date:next,quantity:.001,note:''});
 assert.equal(taskActual(s,'A'),18);assert.equal(metrics(s,s.weeks[0]).ppc,0);assert.equal(metrics(s,s.weeks[1]).ppc,100);assert.deepEqual(s.weeks[0],first);
});
test('legacy locked weeks use weekly quantity just like active and newly closed weeks',()=>{
 const s=late();const legacy=structuredClone(s);legacy.weeks[0].status='closed';delete legacy.weeks[0].ppcRule;
 assert.equal(weeklyPpcRule(legacy.weeks[0]),true);assert.equal(metrics(legacy,legacy.weeks[0]).ppc,100);assert.equal(metrics(s,s.weeks[0]).ppc,100);
 assert.equal(commitmentOutcome(legacy,legacy.weeks[0],legacy.weeks[0].commitments[0]).late,true);
});
test('indexed immutable snapshots agree on early completion waivers and weekly versus promised-day results',()=>{
 for(const raw of [early(),late()]){
  const plain=structuredClone(raw),indexed=preparePlanningState(raw),w=indexed.weeks[0],c=w.commitments[0];
  assert.deepEqual(commitmentOutcome(indexed,w,c),commitmentOutcome(plain,plain.weeks[0],plain.weeks[0].commitments[0]));
  for(const date of [mon,tue,wed,thu,end])assert.equal(dailyReasonRequired(indexed,w,c,date,0),dailyReasonRequired(plain,plain.weeks[0],plain.weeks[0].commitments[0],date,0));
 }
});
