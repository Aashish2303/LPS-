import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activityDaysInWeek,dailyCommitmentPlan,sum,emptyState,applyCommand,phaseWeekQuantity} from '../lib/domain';
const week='2026-11-22';
function task(start:string,finish:string,total=30){const s=emptyState('Daily targets',week);s.start='2026-01-01';s.finish='2027-12-31';return applyCommand(s,{type:'task',id:'a',name:'Excavation',trade:'Civil',area:'Zone A',owner:'Lead',unit:'CuM',total,start,finish,predecessors:[],milestoneId:'',pull:true}).tasks[0];}
test('planned activity days use inclusive overlap with the selected project week',()=>{
 assert.equal(activityDaysInWeek(task('2026-11-22','2026-11-24'),week).days,3);
 assert.equal(activityDaysInWeek(task('2026-11-27','2026-12-02'),week).days,2);
 assert.equal(activityDaysInWeek(task('2026-11-18','2026-11-24'),week).days,3);
 assert.equal(activityDaysInWeek(task('2026-11-18','2026-12-02'),week).days,7);
 assert.equal(activityDaysInWeek(task('2026-11-28','2026-11-28'),week).days,1);
 assert.equal(activityDaysInWeek(task('2026-11-18','2026-11-21'),week).days,0);
 assert.equal(activityDaysInWeek(task('2026-11-29','2026-12-02'),week).days,0);
});
test('an activity spanning weeks retains the same planned daily rate in each partial week',()=>{
 const t=task('2026-11-27','2026-12-06',100);
 for(const key of [week,'2026-11-29','2026-12-06'])assert.equal(phaseWeekQuantity(t,key)/activityDaysInWeek(t,key).days,10);
});
test('planned activity day counts handle year boundaries without weekday assumptions',()=>{
 assert.deepEqual(activityDaysInWeek(task('2026-12-31','2027-01-03'),'2026-12-29'),{start:'2026-12-31',finish:'2027-01-03',days:4});
});

test('the daily plan gives zero outside activity dates and conserves the weekly target exactly',()=>{
 const t=task('2026-11-24','2026-11-26');
 const plan=dailyCommitmentPlan(t,week,{quantity:15.909,due:'2026-11-28'});
 assert.equal(plan.workingDays,3);assert.equal(plan.average,5.303);
 assert.deepEqual(plan.days.map(d=>d.quantity),[0,0,5.303,5.303,5.303,0,0]);
 assert.equal(sum(plan.days.map(d=>d.quantity)),15.909);
});
test('fractional targets use cumulative thousandths so rounding never changes the promise',()=>{
 const t=task('2026-11-22','2026-11-28');
 for(const quantity of [.001,.01,1,15.909,1000000000]){
  const plan=dailyCommitmentPlan(t,week,{quantity,due:'2026-11-28'});
  assert.equal(sum(plan.days.map(d=>d.quantity)),quantity);
  assert.ok(plan.days.every(d=>d.quantity>=0));
  const units=plan.days.map(d=>Math.round(d.quantity*1000));assert.ok(Math.max(...units)-Math.min(...units)<=1);
 }
});
test('an earlier weekly promise due date finishes the daily plan before that deadline',()=>{
 const plan=dailyCommitmentPlan(task('2026-11-22','2026-12-05'),week,{quantity:12,due:'2026-11-24'});
 assert.equal(plan.workingDays,3);assert.deepEqual(plan.days.map(d=>d.quantity),[4,4,4,0,0,0,0]);
});
test('overdue carryover uses the current week through the promise date without division by zero',()=>{
 const plan=dailyCommitmentPlan(task('2026-11-18','2026-11-20'),week,{quantity:7.001,due:'2026-11-25'});
 assert.equal(plan.carryover,true);assert.equal(plan.workingDays,4);assert.equal(plan.start,week);assert.equal(plan.finish,'2026-11-25');
 assert.equal(sum(plan.days.map(d=>d.quantity)),7.001);assert.deepEqual(plan.days.slice(4).map(d=>d.quantity),[0,0,0]);
});
