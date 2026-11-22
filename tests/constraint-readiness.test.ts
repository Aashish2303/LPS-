import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addDays,applyCommand,blockers,currentExerciseWeek,findTask,metrics,ready,taskActual,weeklyCandidates,weekAllocations,type State} from '../lib/domain';
import {parsePhaseCsv} from '../lib/phase-csv';
import {preparePlanningState} from '../lib/planning-index';
const week='2026-11-22',next=addDays(week,7);
const run=(s:State,c:unknown)=>applyCommand(s,c,week);
function fixture(){
 const state={schema:1,name:'Handoff classroom',code:'LC',client:'',location:'',start:week,finish:'2026-12-09',trades:['Structure'],areas:['Zone A'],milestones:[],tasks:[],constraints:[],allocations:[],weeks:[],entries:[]} as State;
 return run(state,parsePhaseCsv('id,name,trade,area,owner,unit,total,early_start,early_finish,predecessors\nA,Excavation,Structure,Zone A,Lead,CuM,25,2026-11-22,2026-11-25,\nB,Footing,Structure,Zone A,Lead,CuM,10,2026-11-26,2026-12-02,A\nC,Column,Structure,Zone A,Lead,CuM,12,2026-12-03,2026-12-09,B\nD,Independent work,Structure,Zone A,Lead,m,18,2026-11-22,2026-12-09,'));
}
function commit(s:State,taskId:string,key=week){const a=weekAllocations(s,key).find(a=>a.taskId===taskId)!;return run(s,{type:'commit',id:taskId+key,taskId,week:key,quantity:a.quantity,due:findTask(s,taskId).finish<addDays(key,6)&&findTask(s,taskId).finish>=key?findTask(s,taskId).finish:addDays(key,6),owner:'Lead'});}
const hold=(taskId='A',affected=week)=>({type:'constraint',id:'hold-'+taskId,taskId,week:affected,category:'Predecessor delay',description:'Handoff at risk: inspection pending',owner:'Lead',due:affected});
function advance(s:State,target:string){while(s.weeks.at(-1)!.dailyDate!<target){const w=s.weeks.at(-1)!;for(const c of w.commitments)if(findTask(s,c.taskId).start<=w.dailyDate!&&!s.entries.some(e=>e.commitmentId===c.id&&e.date===w.dailyDate))s=run(s,{type:'actual',commitmentId:c.id,date:w.dailyDate,quantity:0,reason:'RC-10',note:''});s=run(s,{type:'selectDay',week:w.key,date:addDays(w.dailyDate!,1)});}return s;}

test('excavation and footing can be promised together and footing progress corrected while excavation is incomplete',()=>{
 let s=fixture();assert.deepEqual(blockers(s,findTask(s,'B')),[]);assert.deepEqual(blockers(s,findTask(s,'C')),[]);
 assert.ok(weeklyCandidates(s,week).find(a=>a.task.id==='B')!.eligible);
 s=commit(commit(s,'A'),'B');s=run(s,{type:'freeze',week});
 s=run(s,{type:'actual',commitmentId:'A'+week,date:week,quantity:5,reason:'RC-10',note:''});
 s=advance(s,'2026-11-26');
 s=run(s,{type:'actual',commitmentId:'B'+week,date:'2026-11-26',quantity:2,reason:'RC-10',note:''});
 s=run(s,{type:'actual',commitmentId:'A'+week,date:week,quantity:4,reason:'RC-09',note:'Corrected excavation measurement'});
 s=run(s,{type:'actual',commitmentId:'B'+week,date:'2026-11-26',quantity:2.125,reason:'RC-10',note:'Corrected footing measurement'});
 assert.equal(taskActual(s,'A'),4);assert.equal(taskActual(s,'B'),2.125);
 s=run(s,{type:'close',week,reasons:s.weeks[0].commitments.map(c=>({commitmentId:c.id,reason:'RC-10',learning:'Trade lead to review production rates'}))});
 const closed=structuredClone(s.weeks[0]);assert.equal(metrics(s,closed).ppc,0);assert.equal(currentExerciseWeek(s),next);
 assert.equal(weekAllocations(s,next).find(a=>a.taskId==='B')!.quantity,7.875);
 s=commit(s,'B',next);s=run(s,{type:'freeze',week:next});
 s=run(s,{type:'actual',commitmentId:'B'+next,date:next,quantity:1.1,reason:'RC-10',note:''});
 assert.equal(taskActual(s,'A'),4);assert.equal(taskActual(s,'B'),3.225);assert.deepEqual(s.weeks[0],closed);
});

test('only recorded constraints block an activity and all transitive successors, leaving independent work ready',()=>{
 const before=fixture();const s=preparePlanningState(run(before,hold()));
 for(const id of ['A','B','C']){assert.equal(ready(s,findTask(s,id)),false);assert.match(blockers(s,findTask(s,id)).join(' '),/inspection pending/);}
 assert.equal(ready(s,findTask(s,'D')),true);
 assert.deepEqual(blockers(before,findTask(before,'B')),[]);
 assert.throws(()=>commit(s,'B'),/Clear constraints/);
 const cleared=preparePlanningState(run(s,{type:'resolve',id:'hold-A',date:week,resolution:'Inspection confirmed'}));
 for(const id of ['A','B','C'])assert.equal(ready(cleared,findTask(cleared,id),week),true);
 assert.equal(taskActual(cleared,'A'),0);assert.equal(ready(s,findTask(s,'B')),false);
});

test('a constraint added after commitment blocks week start and successor progress until resolution',()=>{
 let s=commit(fixture(),'B');s=run(s,hold());assert.throws(()=>run(s,{type:'freeze',week}),/no longer ready/);
 s=run(s,{type:'resolve',id:'hold-A',date:week,resolution:'Inspection accepted'});s=run(s,{type:'freeze',week});s=advance(s,'2026-11-26');
 s=run(s,{...hold('B'),description:'Footing pump unavailable'});
 const record={type:'actual',commitmentId:'B'+week,date:'2026-11-26',quantity:1,reason:'RC-10',note:''};
 const before=structuredClone(s);assert.throws(()=>run(s,record),/constraint blocks.*Footing pump unavailable/);assert.deepEqual(s,before);
 assert.match(blockers(s,findTask(s,'C'),'2026-12-03').join(' '),/Footing: Footing pump unavailable/);
 s=run(s,{type:'resolve',id:'hold-B',date:'2026-11-26',resolution:'Pump on site'});s=run(s,record);assert.equal(taskActual(s,'B'),1);assert.equal(taskActual(s,'A'),0);
});

test('constraint week and resolution dates still determine when downstream work is blocked',()=>{
 let s=run(fixture(),hold('A',next));assert.deepEqual(blockers(s,findTask(s,'B'),addDays(next,-1)),[]);
 assert.equal(ready(s,findTask(s,'B'),next),false);
 s=run(s,{type:'resolve',id:'hold-A',date:addDays(next,1),resolution:'Handoff confirmed'});
 assert.equal(ready(s,findTask(s,'B'),next),false);assert.equal(ready(s,findTask(s,'B'),addDays(next,1)),true);
 assert.equal(taskActual(s,'A'),0);
});
