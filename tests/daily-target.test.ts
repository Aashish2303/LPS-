import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activityDaysInWeek,emptyState,applyCommand,phaseWeekQuantity} from '../lib/domain';
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
