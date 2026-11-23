import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addDays,classroomState,commitmentOutcome,dailyPpcSeries,emptyState,metrics,type State,type Week} from '../lib/domain';
const week='2026-11-29',due='2026-12-02',late='2026-12-03';
function fixture():State{
 const s=emptyState('Legacy exercise',week);s.classroom=true;s.calendarStart=week;
 s.tasks=[{id:'A',name:'Excavation',owner:'Lead',trade:'Civil',area:'Zone A',unit:'m³',total:9.3,start:week,finish:due,predecessors:[],milestoneId:'',pull:true}];
 s.weeks=[{key:week,status:'closed',commitments:[{id:'c',taskId:'A',quantity:9.3,due,owner:'Lead',reason:'RC-09',learning:'Confirm equipment',anticipated:false}],frozenOn:week,closedOn:addDays(week,6),readyAtFreeze:1,plannedAtFreeze:1}];
 s.entries=[2,3,1,2.4,.9,0,0].map((quantity,i)=>({commitmentId:'c',date:addDays(week,i),quantity,reason:quantity===0?'RC-09':undefined,note:''}));
 return s;
}
test('a legacy Wednesday promise completed Thursday counts as achieved before and after loading',()=>{
 const s=fixture(),before=structuredClone(s),w=s.weeks[0];assert.equal(commitmentOutcome(s,w,w.commitments[0]).onTime,false);assert.equal(commitmentOutcome(s,w,w.commitments[0]).ppcMet,true);assert.equal(metrics(s,w).ppc,100);
 const loaded=classroomState(s);assert.equal(loaded.weeks[0].performance!.weekly.ppc,100);assert.deepEqual(loaded.weeks[0].weeklyPpcCorrection,{from:0,to:100});assert.equal(loaded.weeks[0].commitments[0].reason,'RC-09');assert.deepEqual(s,before);assert.deepEqual(loaded.entries,s.entries);assert.deepEqual(loaded.tasks,s.tasks);assert.deepEqual(loaded.weeks[0].commitments,s.weeks[0].commitments);
 assert.deepEqual(classroomState(loaded),loaded);assert.equal(JSON.stringify(classroomState(JSON.parse(JSON.stringify(loaded)))),JSON.stringify(loaded));
});
test('a stale locked weekly snapshot cannot override the ledger and repair retains every daily result and reason',()=>{
 const s=fixture(),w=s.weeks[0],daily=dailyPpcSeries(s,w);w.ppcRule='weekly';w.performance={version:1,weekly:{total:1,done:0,ppc:0},daily,shortfalls:[{date:week,commitmentId:'c',taskId:'A',planned:2.325,actual:2,reason:'RC-09',note:'Keep original explanation'}]};
 const original=structuredClone(w.performance);assert.equal(metrics(s,w).ppc,100);const repaired=classroomState(s).weeks[0];assert.deepEqual(repaired.performance!.weekly,{total:1,done:1,ppc:100});assert.deepEqual(repaired.performance!.daily,original.daily);assert.deepEqual(repaired.performance!.shortfalls,original.shortfalls);assert.equal(repaired.closedOn,w.closedOn);assert.deepEqual(w.performance,original);
});
test('correcting legacy scoring never gives full weekly PPC when another commitment is still short',()=>{
 const s=fixture(),w=s.weeks[0];s.tasks.push({...s.tasks[0],id:'B',name:'Footing',total:2.5});w.commitments.push({...w.commitments[0],id:'c2',taskId:'B',quantity:2.5});s.entries.push({commitmentId:'c2',date:late,quantity:.8,note:''});
 const loaded=classroomState(s);assert.equal(metrics(loaded,loaded.weeks[0]).done,1);assert.equal(metrics(loaded,loaded.weeks[0]).ppc,50);assert.equal(commitmentOutcome(loaded,loaded.weeks[0],loaded.weeks[0].commitments[0]).ppcMet,true);
});
test('a later week cannot repair the earlier result and zero promises still have no score',()=>{
 const s=fixture();s.entries=s.entries.filter(e=>e.date!==late);const next:Week={...structuredClone(s.weeks[0]),key:addDays(week,7),commitments:[{...s.weeks[0].commitments[0],id:'next',quantity:.9,due:addDays(week,13)}]};s.weeks.push(next);s.entries.push({commitmentId:'next',date:next.key,quantity:.9,note:''});const loaded=classroomState(s);assert.equal(metrics(loaded,loaded.weeks[0]).ppc,0);assert.equal(metrics(loaded,loaded.weeks[1]).ppc,100);
 const empty=fixture();empty.weeks[0].commitments=[];assert.equal(classroomState(empty).weeks[0].performance!.weekly.ppc,null);
});
