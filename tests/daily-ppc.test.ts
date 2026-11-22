import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addDays,applyCommand,dailyCommitmentPlan,emptyState,metrics,type State} from '../lib/domain';
import {dailyPpc,dailyPpcSeries} from '../lib/daily-ppc';
import {parsePhaseCsv} from '../lib/phase-csv';
import {preparePlanningState} from '../lib/planning-index';

const week='2026-11-22',day2=addDays(week,1),end=addDays(week,6);
const run=(s:State,c:unknown)=>applyCommand(s,c,week);
function fixture(){
 let s=run(emptyState('Daily PPC',week),parsePhaseCsv(`id,name,trade,area,owner,unit,total,early_start,early_finish\nA,Excavation,Civil,Zone A,Lead,m³,21,${week},${end}\nB,Reinforcement,Structure,Zone B,Lead,t,14,${week},${end}`));
 for(const [taskId,quantity] of [['A',21],['B',14]] as const)s=run(s,{type:'commit',id:taskId,taskId,week,quantity,due:end,owner:'Lead'});
 return run(s,{type:'freeze',week});
}
function save(s:State,id:string,date:string,quantity:number,reason?:string){return run(s,{type:'actual',commitmentId:id,date,quantity,reason,note:''});}

test('daily PPC counts activity targets equally across units, not quantity-weighted progress',()=>{
 let s=fixture();s=save(s,'A',week,3);s=save(s,'B',week,1,'RC-09');
 const day=dailyPpc(s,s.weeks[0],week);
 assert.equal(day.total,2);assert.equal(day.done,1);assert.equal(day.missed,1);assert.equal(day.pending,0);assert.equal(day.ppc,50);
 assert.deepEqual(day.activities.map(a=>a.status),['achieved','missed']);
 assert.equal(metrics(s,s.weeks[0]).ppc,0);
});
test('unsaved entries are pending, saved zero is a miss, and no wall-clock gating applies',()=>{
 let s=fixture();const before=dailyPpc(s,s.weeks[0],week);
 assert.equal(before.ppc,null);assert.equal(before.pending,2);assert.equal(before.missed,0);
 s=save(s,'A',week,0,'RC-09');assert.equal(dailyPpc(s,s.weeks[0],week).ppc,null);
 s=save(s,'B',week,0,'RC-09');assert.equal(dailyPpc(s,s.weeks[0],week).ppc,0);
 const future=dailyPpc(s,s.weeks[0],end);assert.equal(future.pending,2);assert.equal(future.missed,0);assert.equal(future.ppc,null);
});
test('early completion removes later daily targets, without inventing extra achievements',()=>{
 let s=fixture();s=save(s,'A',week,21);s=save(s,'B',week,2);s=run(s,{type:'selectDay',week,date:day2});
 s=save(s,'A',day2,0);s=save(s,'B',day2,2);
 const day=dailyPpc(s,s.weeks[0],day2);
 assert.equal(day.scheduled,2);assert.equal(day.excluded,1);assert.equal(day.total,1);assert.equal(day.done,1);assert.equal(day.ppc,100);
 assert.equal(day.activities[0].planned,3);assert.equal(day.activities[0].status,'completed-earlier');
});
test('zero-plan dates and fully completed prior targets have no denominator or fake 100 percent',()=>{
 let s=fixture();s=save(s,'A',week,21);s=save(s,'B',week,14);
 const day=dailyPpc(s,s.weeks[0],day2);assert.equal(day.total,0);assert.equal(day.excluded,2);assert.equal(day.ppc,null);assert.equal(day.status,'no-work');
 const short=fixture();for(const t of short.tasks)t.finish=week;for(const c of short.weeks[0].commitments)c.due=week;
 const off=dailyPpc(short,short.weeks[0],day2);assert.equal(off.scheduled,0);assert.equal(off.total,0);assert.equal(off.ppc,null);
});
test('finishing remaining weekly scope achieves the final work day even below its original daily split',()=>{
 let s=fixture();s=save(s,'A',week,19);s=save(s,'B',week,2);s=run(s,{type:'selectDay',week,date:day2});
 s=save(s,'A',day2,2);s=save(s,'B',day2,2);
 const day=dailyPpc(s,s.weeks[0],day2);assert.equal(day.activities[0].planned,3);assert.equal(day.activities[0].actual,2);assert.equal(day.activities[0].status,'achieved');assert.equal(day.ppc,100);
});
test('late completion can achieve weekly PPC while the original missed daily target stays missed',()=>{
 let s=fixture();s.tasks=s.tasks.slice(0,1);const w=s.weeks[0];w.commitments=w.commitments.slice(0,1);w.commitments[0].due=addDays(week,2);s.tasks[0].finish=addDays(week,2);
 // Three daily targets of seven; only the first two are met on their dates.
 s=save(s,'A',week,7);s=run(s,{type:'selectDay',week,date:day2});s=save(s,'A',day2,7);
 const due=addDays(week,2),late=addDays(week,3);s=run(s,{type:'selectDay',week,date:due});s=save(s,'A',due,0,'RC-09');s=run(s,{type:'selectDay',week,date:late});s=save(s,'A',late,7);
 assert.equal(metrics(s,s.weeks[0]).ppc,100);assert.equal(dailyPpc(s,s.weeks[0],due).ppc,0);assert.equal(dailyPpc(s,s.weeks[0],late).ppc,null);
 assert.equal(dailyPpc(s,s.weeks[0],week).ppc,100);
});
test('same-date replacement and early-quantity corrections recompute daily PPC and exclusions',()=>{
 let s=fixture();s=save(s,'A',week,21);s=save(s,'B',week,2);s=run(s,{type:'selectDay',week,date:day2});s=save(s,'A',day2,0);s=save(s,'B',day2,2);
 assert.equal(dailyPpc(s,s.weeks[0],day2).excluded,1);
 s=save(s,'A',week,3);const day=dailyPpc(s,s.weeks[0],day2);
 assert.equal(day.excluded,0);assert.equal(day.total,2);assert.equal(day.ppc,50);
 s=save(s,'B',day2,1,'RC-09');assert.equal(dailyPpc(s,s.weeks[0],day2).ppc,0);
 assert.equal(s.entries.filter(e=>e.commitmentId==='B'&&e.date===day2).length,1);
});
test('closing a week counts missing planned entries as misses but retains missing actuals as null',()=>{
 let s=fixture();s=save(s,'A',week,3);s=save(s,'B',week,2);
 s=run(s,{type:'close',week,reasons:['A','B'].map(commitmentId=>({commitmentId,reason:'RC-09',learning:'Lead to confirm equipment'}))});
 const day=dailyPpc(s,s.weeks[0],day2);assert.equal(day.ppc,0);assert.equal(day.missed,2);assert.equal(day.pending,0);assert.equal(day.status,'complete');assert.equal(day.activities[0].actual,null);
 assert.throws(()=>save(s,'A',day2,3),/locked/);
});
test('daily calculations preserve exact thousandths, seven project dates, and immutable indexed parity',()=>{
 const s=fixture();s.tasks[0].total=.007;s.weeks[0].commitments[0].quantity=.007;s.entries=[{commitmentId:'A',date:week,quantity:0,note:'Shortfall',reason:'RC-09'},{commitmentId:'B',date:week,quantity:2,note:''}];
 assert.equal(dailyPpc(s,s.weeks[0],week).ppc,50);
 const before=JSON.stringify(s),indexed=preparePlanningState(structuredClone(s));
 assert.deepEqual(dailyPpcSeries(indexed,indexed.weeks[0]),dailyPpcSeries(s,s.weeks[0]));assert.equal(JSON.stringify(s),before);
 assert.deepEqual(dailyPpcSeries(s,s.weeks[0]).map(d=>d.date),Array.from({length:7},(_,i)=>addDays(week,i)));
 assert.equal(dailyCommitmentPlan(s.tasks[0],week,s.weeks[0].commitments[0]).days[0].quantity,.001);
 assert.throws(()=>dailyPpc(s,s.weeks[0],addDays(week,7)),/within/);
});
test('draft plans and no-work weeks have no published daily score',()=>{
 const s=fixture();s.weeks[0].status='draft';assert.equal(dailyPpc(s,s.weeks[0],week).status,'not-started');assert.equal(dailyPpc(s,s.weeks[0],week).ppc,null);
 s.weeks[0].status='active';s.weeks[0].commitments=[];assert.equal(dailyPpc(s,s.weeks[0],week).status,'no-work');assert.equal(dailyPpc(s,s.weeks[0],week).ppc,null);
});
