import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand,emptyState,addDays,currentExerciseWeek,calendarAnchor,weekNumber,weekAllocations,projectWeek,taskActual,metrics,blockers,classroomState,sum,type State} from '../lib/domain';
import {parsePhaseCsv} from '../lib/phase-csv';
const start='2027-02-02'; // Tuesday, deliberately in the future relative to the exercise clock.
const now='2026-11-22';
const run=(s:State,c:unknown)=>applyCommand(s,c,now);
function fixture(){return run(emptyState('Classroom',now),parsePhaseCsv('id,name,trade,area,owner,unit,total,early_start,early_finish,late_finish,float,predecessors\nA,Excavation,Civil,Zone A,Lead,m³,10.001,2027-02-02,2027-02-15,2027-02-16,-1,\nB,Reinforcement,Structure,Zone B,Lead,t,20,2027-02-02,2027-02-15,2027-02-15,0,'));}
function promiseAll(s:State,key=currentExerciseWeek(s)){for(const a of weekAllocations(s,key))s=run(s,{type:'commit',id:a.taskId+key,taskId:a.taskId,week:key,quantity:a.quantity,due:addDays(key,6),owner:'Lead'});return run(s,{type:'freeze',week:key});}
function record(s:State,id:string,date:string,quantity:number,reason='ON_PLAN',note=''){return run(s,{type:'actual',commitmentId:id+projectWeek(s,date),date,quantity,reason,note});}
function recordDay(s:State,date:string,quantities:[number,number]){s=record(s,'A',date,quantities[0]);return record(s,'B',date,quantities[1]);}

test('project-start calendar uses seven days from a Tuesday across year and month boundaries',()=>{
 const s=fixture();assert.equal(calendarAnchor(s),start);assert.equal(currentExerciseWeek(s),start);assert.equal(projectWeek(s,'2027-02-08'),start);assert.equal(projectWeek(s,'2027-02-09'),'2027-02-09');assert.equal(weekNumber(s,'2027-03-16'),7);
 assert.equal(s.finish,'2027-02-16');assert.equal(s.tasks[0].schedule?.float,-1);
 const a=[start,addDays(start,7)].map(w=>weekAllocations(s,w).find(a=>a.taskId==='A')!.quantity);
 assert.deepEqual(a,[5.001,5]);assert.equal(sum(a),10.001);
 assert.throws(()=>run(s,{type:'freeze',week:'2027-02-01'}),/seven-day/);
});

test('promise quantity cannot be edited and exercise cannot skip an unclosed week',()=>{
 const s=fixture(),base={type:'commit',id:'c',taskId:'A',week:start,due:addDays(start,6),owner:'Lead'};
 assert.throws(()=>run(s,{...base,quantity:4}),/full weekly forecast/);
 assert.throws(()=>run(s,{...base,week:addDays(start,7),due:addDays(start,13),quantity:5}),/current exercise week/);
 assert.throws(()=>run(s,{type:'freeze',week:addDays(start,7)}),/current exercise week/);
});

test('per-cell constraints persist affected week, defer blocking until that week and propagate downstream',()=>{
 let s=fixture();s.finish=addDays(start,20);s=run(s,{type:'task',id:'C',name:'Follow-on',trade:'Civil',area:'Zone A',owner:'Lead',unit:'m²',total:5,start:addDays(start,14),finish:addDays(start,20),predecessors:['A'],milestoneId:'',pull:true});
 s=run(s,{type:'constraint',id:'k',taskId:'A',week:addDays(start,7),category:'Equipment',description:'Excavator unavailable in week two',owner:'Lead',due:addDays(start,7)});
 assert.equal(s.constraints[0].week,addDays(start,7));assert.equal(blockers(s,s.tasks[0],addDays(start,6)).length,0);
 assert.ok(blockers(s,s.tasks[0],addDays(start,7)).some(x=>x.includes('Excavator')));
 assert.ok(blockers(s,s.tasks[2],addDays(start,14)).some(x=>x.includes('Excavation: Excavator')));
 s=run(s,{type:'resolve',id:'k',date:addDays(start,7),resolution:'Replacement confirmed'});
 assert.equal(blockers(s,s.tasks[0],addDays(start,7)).length,0);
});

test('second day waits for saved reasons on all activities then saves and replaces exact decimal totals',()=>{
 let s=promiseAll(fixture());
 const next={type:'selectDay',week:start,date:addDays(start,1)};
 assert.throws(()=>run(s,next),/every activity/);
 assert.throws(()=>run(s,{type:'actual',commitmentId:'A'+start,date:start,quantity:.1,note:''}),/daily reason/);
 assert.throws(()=>record(s,'A',start,.1,'RC-16'),/Explain/);
 assert.throws(()=>record(s,'A',addDays(start,1),.2),/before advancing/);
 s=record(s,'A',start,.1);assert.throws(()=>run(s,next),/every activity/);
 s=record(s,'B',start,.2,'RC-07');s=run(s,next);
 s=recordDay(s,addDays(start,1),[.2,.3]);assert.equal(taskActual(s,'A'),.3);assert.equal(taskActual(s,'B'),.5);
 s=record(s,'A',addDays(start,1),.15,'RC-16','Partial excavation after equipment repair');
 assert.equal(taskActual(s,'A'),.25);assert.equal(taskActual(s,'B'),.5);assert.equal(s.entries.length,4);
 assert.throws(()=>run(s,{type:'selectDay',week:start,date:addDays(start,3)}),/one day/);
});

test('two simulated future weeks carry scope once, advance automatically and preserve immutable closed data',()=>{
 let s=promiseAll(fixture());
 for(let day=0;day<7;day++){const date=addDays(start,day);if(day)s=run(s,{type:'selectDay',week:start,date});s=recordDay(s,date,day===0?[2,10]:[0,0]);}
 const reasons=[{commitmentId:'A'+start,reason:'RC-09',learning:'Book excavator before starting'}];
 s=run(s,{type:'close',week:start,reasons});const first=structuredClone(s.weeks[0]);
 assert.equal(metrics(s,first).ppc,50);assert.equal(currentExerciseWeek(s),addDays(start,7));assert.equal(weekNumber(s,currentExerciseWeek(s)),2);
 const quantities=Object.fromEntries(weekAllocations(s,addDays(start,7)).map(a=>[a.taskId,a.quantity]));assert.deepEqual(quantities,{A:8.001,B:10});
 assert.equal(weekAllocations(s,addDays(start,7)).find(a=>a.taskId==='A')!.carry,3.001);
 assert.throws(()=>record(s,'A',start,3),/locked/);
 assert.throws(()=>run(s,{type:'constraint',id:'closed',taskId:'A',week:start,category:'Equipment',description:'Changed history',owner:'Lead',due:start}),/closed/i);
 s=promiseAll(s);
 s=recordDay(s,addDays(start,7),[8.001,10]);
 s=run(s,{type:'close',week:addDays(start,7)});
 assert.equal(taskActual(s,'A'),10.001);assert.equal(taskActual(s,'B'),20);assert.equal(metrics(s,s.weeks[1]).ppc,100);assert.deepEqual(s.weeks[0],first);
 assert.equal(currentExerciseWeek(s),addDays(start,14));assert.equal(weekNumber(s,addDays(currentExerciseWeek(s),35)),8);
 assert.deepEqual(weekAllocations(s,currentExerciseWeek(s)),[]);
});

test('a fully blocked or empty teaching week can start and close without fabricated PPC',()=>{
 let s=fixture();s=run(s,{type:'constraint',id:'k',taskId:'A',week:start,category:'Safety',description:'Permit missing',owner:'Lead',due:start});
 s=run(s,{type:'freeze',week:start});s=run(s,{type:'close',week:start});assert.equal(metrics(s,s.weeks[0]).ppc,null);assert.equal(currentExerciseWeek(s),addDays(start,7));
});

test('legacy upgrade preserves closed calendars and makes active day reasoning mandatory',()=>{
 const s=emptyState('Old','2026-10-01');s.weeks=[{key:'2026-10-05',status:'closed',commitments:[],frozenOn:'2026-10-05',closedOn:'2026-10-06',readyAtFreeze:0,plannedAtFreeze:0},{key:'2026-10-12',status:'active',commitments:[],frozenOn:'2026-10-12',closedOn:null,readyAtFreeze:0,plannedAtFreeze:0}];
 const upgraded=classroomState(s);assert.equal(upgraded.calendarStart,'2026-10-05');assert.equal(upgraded.weeks[1].dailyReasonsRequired,true);assert.deepEqual(upgraded.weeks[0],s.weeks[0]);assert.equal(s.classroom,undefined);
});
