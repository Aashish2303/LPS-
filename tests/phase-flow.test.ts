import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 applyCommand, blockers, commitmentActual, emptyState, findTask, metrics, phaseWeekQuantity,
 ready, sum, taskActual, weekAllocations, type State,
} from '../lib/domain';
import {parsePhaseCsv,phaseCsvTemplate} from '../lib/phase-csv';

const now='2026-11-12';
const week='2026-11-02';
const next='2026-11-09';
const run=(state:State,command:unknown)=>applyCommand(state,command,now);
const fixture=()=>emptyState('Test phase',now);
const firstLine='id,name,trade,area,owner,unit,total,early_start,early_finish,late_finish,float,predecessors,constraints';

test('phase import accepts legacy dates and float, adds classifications, and replaces provisional dates',()=>{
 const input='\uFEFFSl. No.,Name,Planned Start,Planned Finish,EPS,EPF,LPF,Float,Predecessor,Quantity,UOM\r\n'
  +'2,Footings,2026-11-05,2026-11-06,5-Nov-2026,06/11/2026,2026-11-15,0,1,5,m³\r\n'
  +'1,"Excavate, Zone A",2026-11-02,2026-11-04,2026-11-02,2026-11-04,2026-11-03,-1,,12,m³\r\n';
 const before=fixture();
 const state=run(before,parsePhaseCsv(input));
 assert.equal(state.start,'2026-11-02');
 assert.equal(state.finish,'2026-11-15');
 assert.equal(state.tasks[1].name,'Excavate, Zone A');
 assert.equal(state.tasks[1].schedule?.float,-1);
 assert.equal(state.tasks[0].schedule?.float,0);
 assert.equal(state.tasks[0].schedule?.importedOn,now);
 assert.ok(state.trades.includes('Phase Schedule'));
 assert.equal(before.tasks.length,0);
 assert.equal(before.start,now);
});

test('invalid dependency or duplicate leaves the entire import unapplied',()=>{
 const state=fixture();
 const row='A,Drain,Civil,Zone C,Lead,m,3,2026-11-02,2026-11-03,2026-11-04,-1';
 assert.throws(()=>run(state,parsePhaseCsv(firstLine+'\n'+row+',missing,Approval')),/unknown predecessor/);
 assert.throws(()=>run(state,parsePhaseCsv(firstLine+'\n'+row+',A,')),/depend on itself|cycle/);
 assert.throws(()=>run(state,parsePhaseCsv(firstLine+'\n'+row+',,\n'+row+',,')),/Duplicate/);
 assert.equal(state.tasks.length,0);
 assert.equal(state.constraints.length,0);
});

test('automatic forecast conserves fractional scope over partial and complete weeks',()=>{
 const state=run(fixture(),parsePhaseCsv(firstLine+'\nA,Drain,Civil,Zone A,Lead,m,10.001,2026-11-05,2026-11-17,2026-11-20,-2,,'));
 const task=state.tasks[0];
 const dates=[week,next,'2026-11-16'];
 const quantities=dates.map(date=>phaseWeekQuantity(task,date));
 assert.deepEqual(quantities,[3.077,5.385,1.539]);
 assert.equal(sum(quantities),task.total);
 assert.deepEqual(dates.map(date=>weekAllocations(state,date)[0].quantity),quantities);
 assert.equal(state.allocations.length,0);
});

test('imported and newly added constraints propagate to all downstream activities',()=>{
 let state=run(fixture(),parsePhaseCsv(phaseCsvTemplate(week)));
 assert.equal(ready(state,findTask(state,'A01')),true);
 assert.ok(blockers(state,findTask(state,'A03')).includes('Footing concrete: Footing drawing approval pending'));
 assert.equal(ready(state,findTask(state,'A03')),false);
 assert.throws(()=>run(state,{type:'commit',id:'blocked',taskId:'A02',week:next,quantity:1,due:'2026-11-14',owner:'Lead'}),/Clear constraints/);
 state=run(state,{type:'constraint',id:'test-k',taskId:'A01',category:'Equipment',description:'Excavator delayed',owner:'Lead',due:week});
 assert.ok(blockers(state,findTask(state,'A03')).includes('Foundation excavation: Excavator delayed'));
 assert.equal(ready(state,findTask(state,'B01')),true);
});

test('a constraint raised after freeze blocks successor actuals even when the predecessor was complete',()=>{
 let state=run(fixture(),parsePhaseCsv(firstLine+'\nA,First,Civil,Zone A,Lead,m,2,2026-11-02,2026-11-03,2026-11-03,0,,\nB,Second,Civil,Zone A,Lead,m,3,2026-11-09,2026-11-10,2026-11-10,0,A,'));
 const commit=(taskId:string,key:string,quantity:number,due:string)=>{
  state=run(state,{type:'commit',id:'commit-'+taskId,taskId,week:key,quantity,due,owner:'Lead'});
  state=run(state,{type:'freeze',week:key});
 };
 commit('A',week,2,'2026-11-03');
 state=run(state,{type:'actual',commitmentId:'commit-A',date:week,quantity:2,note:''});
 state=run(state,{type:'close',week});
 commit('B',next,3,'2026-11-10');
 state=run(state,{type:'constraint',id:'inspection',taskId:'A',category:'Quality',description:'Handoff inspection reopened',owner:'Lead',due:next});
 const record={type:'actual',commitmentId:'commit-B',date:'2026-11-10',quantity:3,note:''};
 assert.throws(()=>run(state,record),/constraint blocks.*First: Handoff inspection reopened/);
 state=run(state,{type:'resolve',id:'inspection',date:next,resolution:'Inspection accepted'});
 assert.equal(taskActual(run(state,record),'B'),3);
});

test('forecast, decimal corrections, reason codes, closeout and carryover share one ledger',()=>{
 let state=run(fixture(),parsePhaseCsv(firstLine+'\nA,Drain,Civil,Zone A,Lead,m,10,2026-11-02,2026-11-15,2026-11-15,0,,'));
 state=run(state,{type:'commit',id:'c1',taskId:'A',week,quantity:5,due:'2026-11-06',owner:'Lead'});
 state=run(state,{type:'freeze',week});
 const record=(date:string,quantity:number)=>run(state,{type:'actual',commitmentId:'c1',date,quantity,note:''});
 state=record(week,1.125);
 state=record('2026-11-05',1.875);
 state=record('2026-11-05',1.375);
 state=record('2026-11-07',.25);
 const close=(reason:string,reasonNote='')=>run(state,{type:'close',week,reasons:[
  {commitmentId:'c1',reason,reasonNote,learning:'Check delivery on Thursday'},
 ]});
 assert.throws(()=>close('Unknown'),/reason code/);
 assert.throws(()=>close('RC-16'),/Explain/);
 assert.equal(state.weeks[0].status,'active');
 assert.equal(state.weeks[0].commitments[0].reason,'');
 state=close('RC-07');
 const closed=state.weeks[0];
 assert.equal(closed.status,'closed');
 assert.equal(closed.commitments[0].reason,'RC-07');
 assert.equal(commitmentActual(state,closed.commitments[0],closed.commitments[0].due),2.5);
 assert.equal(taskActual(state,'A'),2.75);
 assert.equal(state.entries.length,3);
 assert.equal(metrics(state,closed).ppc,0);
 assert.equal(weekAllocations(state,week)[0].quantity,5);
 const carried=weekAllocations(state,next)[0];
 assert.equal(carried.quantity,7.25);
 assert.equal(carried.carry,2.25);
 assert.throws(()=>record(week,1),/locked/);
 assert.throws(()=>run(state,{type:'variance',commitmentId:'c1',reason:'RC-06',learning:'Change'}),/active week/);
});
