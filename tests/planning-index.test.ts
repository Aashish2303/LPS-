import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoState} from '../lib/demo';
import {preparePlanningState,planningIndex} from '../lib/planning-index';
import {sameWorkspaceRoute} from '../lib/routes';
import {addDays,applyCommand,available,blockers,commitmentActual,currentExerciseWeek,metrics,remaining,taskActual,unitTotals,weekAllocations,type State} from '../lib/domain';
function results(s:State){const week=currentExerciseWeek(s),dates=[addDays(s.start,-1),s.start,addDays(week,-1),week,addDays(week,6),'9999-12-31'];return {
 actuals:s.tasks.map(t=>dates.map(date=>taskActual(s,t.id,date))),
 commitments:s.weeks.flatMap(w=>w.commitments.map(c=>dates.map(date=>commitmentActual(s,c,date)))),
 readiness:s.tasks.map(t=>dates.map(date=>blockers(s,t,date))),
 quantities:s.tasks.map(t=>[remaining(s,t),available(s,t)]),
 allocations:Array.from({length:8},(_,i)=>weekAllocations(s,addDays(s.start,i*7))),
 metrics:s.weeks.map(w=>metrics(s,w)),totals:unitTotals(s),
};}

test('indexed immutable snapshots preserve dates, decimal totals, blocker ordering, forecasts and PPC',()=>{
 const s=demoState('2026-11-22'),expected=results(s),before=structuredClone(s);
 assert.equal(preparePlanningState(s),s);assert.deepEqual(results(s),expected);assert.deepEqual(s,before);
 const first=planningIndex(s);preparePlanningState(s);assert.equal(planningIndex(s),first);
});

test('same-day corrections after preparing a snapshot use a fresh mutable command ledger',()=>{
 const before=preparePlanningState(demoState('2026-11-22')),week=currentExerciseWeek(before);
 assert.equal(taskActual(before,'t1'),80);
 const after=applyCommand(before,{type:'actual',commitmentId:'cc0',date:week,quantity:25.125,note:'Correction',reason:'ON_PLAN'},'2026-11-22');
 assert.equal(planningIndex(after),undefined);assert.equal(taskActual(after,'t1'),85.125);assert.equal(taskActual(before,'t1'),80);
 assert.deepEqual(results(preparePlanningState(after)),results(structuredClone(after)));
});

test('constraint commands invalidate readiness through snapshot replacement without altering cached history',()=>{
 const before=preparePlanningState(demoState('2026-11-22')),week=currentExerciseWeek(before),t=before.tasks.find(t=>t.id==='t1')!;
 assert.deepEqual(blockers(before,t,week),[]);
 const after=applyCommand(before,{type:'constraint',id:'new',taskId:'t1',week,category:'Safety',description:'Inspection hold',owner:'Lead',due:week},'2026-11-22');
 preparePlanningState(after);assert.deepEqual(blockers(after,t,week),['Inspection hold']);assert.deepEqual(blockers(before,t,week),[]);
});

test('projects with matching activity and commitment IDs do not share cached actuals',()=>{
 const a=demoState('2026-11-22'),b=structuredClone(a);b.entries.find(e=>e.commitmentId==='cc0')!.quantity=1;
 preparePlanningState(a);preparePlanningState(b);assert.equal(taskActual(a,'t1'),80);assert.equal(taskActual(b,'t1'),61);
 assert.equal(taskActual(a,'missing'),0);
});

test('local routing is restricted to known sections of the loaded workspace',()=>{
 const a='bdcd6acc-8592-4561-a72f-7971c4f57d8c',b='5a3908e5-1e88-44e1-88a9-f92c606a5f15';
 assert.equal(sameWorkspaceRoute('/projects/'+a+'/phase','/projects/'+a+'/daily',a),true);
 assert.equal(sameWorkspaceRoute('/demo/phase','/demo/lookahead',''),true);
 for(const target of ['/projects/'+b+'/daily','/login','/demo/overview','/projects/'+a+'/admin','https://evil.test'])assert.equal(sameWorkspaceRoute('/projects/'+a+'/phase',target,a),false);
 assert.equal(sameWorkspaceRoute('/projects/'+a+'/phase','/projects/'+a+'/daily',b),false);
});
