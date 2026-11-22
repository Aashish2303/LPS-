import {emptyState,addDays,weekAllocations,blockers,findTask,remaining} from '../lib/domain';
import assert from 'node:assert/strict';
import {preparePlanningState} from '../lib/planning-index';
import {performance} from 'node:perf_hooks';
const s=emptyState('Synthetic load','2026-11-03');s.classroom=true;s.calendarStart=s.start;
for(let i=0;i<300;i++)s.tasks.push({id:'t'+i,name:'Activity '+i,trade:'Civil',area:'Zone A',owner:'Lead',unit:'m³',total:1000,start:s.start,finish:addDays(s.start,69),predecessors:i%6?['t'+(i-1)]:[],milestoneId:'',pull:true});
for(let w=0;w<4;w++){const key=addDays(s.start,w*7),commitments=s.tasks.map(t=>({id:t.id+':'+w,taskId:t.id,quantity:100,due:addDays(key,6),owner:'Lead',reason:'',learning:'',anticipated:true}));s.weeks.push({key,status:'closed',commitments,frozenOn:key,closedOn:addDays(key,6),readyAtFreeze:300,plannedAtFreeze:300});for(const c of commitments)for(let d=0;d<7;d++)s.entries.push({commitmentId:c.id,date:addDays(key,d),quantity:10,note:'Synthetic',reason:'ON_PLAN'});}
const run=()=>{let n=0;for(let w=0;w<6;w++){const key=addDays(s.start,28+w*7);for(const a of weekAllocations(s,key)){const t=findTask(s,a.taskId);n+=blockers(s,t,addDays(key,6)).length+remaining(s,t)+a.quantity;}}return n;};
const start=performance.now(),baseline=run(),baselineMs=performance.now()-start;
const indexedStart=performance.now();preparePlanningState(s);const indexed=run(),indexedMs=performance.now()-indexedStart;
const repeatStart=performance.now(),repeat=run(),repeatMs=performance.now()-repeatStart;
assert.equal(indexed,baseline);assert.equal(repeat,baseline);
console.log(JSON.stringify({activities:s.tasks.length,entries:s.entries.length,baseline_ms:Math.round(baselineMs),indexed_first_ms:Math.round(indexedMs),indexed_repeat_ms:Math.round(repeatMs),checksum:baseline}));
