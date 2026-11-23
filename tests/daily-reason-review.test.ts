import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addDays,applyCommand,dailyPpc,dailyPpcSeries,dailyShortfalls,emptyState,metrics,type State} from '../lib/domain';
import {dailyReasonReport} from '../lib/daily-reasons';
import {parsePhaseCsv} from '../lib/phase-csv';
import {preparePlanningState} from '../lib/planning-index';

const week='2026-11-23',tue=addDays(week,1),wed=addDays(week,2),thu=addDays(week,3);
const run=(s:State,c:unknown)=>applyCommand(s,c,week);
function fixture(two=false){
 const rows=`A,Excavation,Civil,Zone A,Lead,m³,18,${week},${wed}`+(two?`\nB,Reinforcement,Structure,Zone B,Lead,t,18,${week},${wed}`:'');
 let s=run(emptyState('Daily reason review',week),parsePhaseCsv('id,name,trade,area,owner,unit,total,early_start,early_finish\n'+rows));
 for(const taskId of two?['A','B']:['A'])s=run(s,{type:'commit',id:taskId,taskId,week,quantity:18,due:wed,owner:'Lead'});
 return run(s,{type:'freeze',week});
}
const select=(s:State,date:string)=>run(s,{type:'selectDay',week,date});
const save=(s:State,date:string,quantity:number,reason?:string,id='A',note='')=>run(s,{type:'actual',commitmentId:id,date,quantity,reason,note});
function late(){let s=fixture();s=save(s,week,6);s=select(s,tue);s=save(s,tue,6);s=select(s,wed);s=save(s,wed,0,'RC-09');s=select(s,thu);return save(s,thu,6);}
const close=(s:State)=>run(s,{type:'close',week,reasons:[{commitmentId:'A',reason:'RC-06',learning:'Lead to review weather protection before promising'}]});

test('late weekly success stores weekly 100, Wednesday daily zero and its daily reason separately from the primary reason',()=>{
 let s=close(late());const w=s.weeks[0],saved=w.performance!;
 assert.equal(saved.version,1);assert.equal(saved.weekly.ppc,100);assert.equal(saved.daily.find(d=>d.date===wed)!.ppc,0);assert.equal(saved.shortfalls.length,1);assert.equal(saved.shortfalls[0].reason,'RC-09');assert.equal(w.commitments[0].reason,'RC-06');
 const report=dailyReasonReport(s,[w]);assert.deepEqual(report.ranked.map(r=>[r.code,r.count]),[['RC-09',1]]);assert.equal(report.periods.find(p=>p.key===wed)!.byCode['RC-09'],1);
 const restored:State=JSON.parse(JSON.stringify(s));assert.equal(metrics(restored,restored.weeks[0]).ppc,100);assert.equal(dailyPpc(restored,restored.weeks[0],wed).ppc,0);assert.deepEqual(dailyShortfalls(restored,restored.weeks[0]),saved.shortfalls);
 assert.throws(()=>save(s,wed,6),/locked/);assert.throws(()=>run(s,{type:'variance',commitmentId:'A',reason:'RC-01',learning:'Change'}),/active/);
});
test('Tuesday early completion permits Wednesday zero and contributes neither a miss nor a daily reason',()=>{
 let s=fixture();s=save(s,week,6);s=select(s,tue);s=save(s,tue,12);s=select(s,wed);s=save(s,wed,0);s=run(s,{type:'close',week});const w=s.weeks[0];
 assert.equal(w.performance!.weekly.ppc,100);assert.equal(w.performance!.daily[2].excluded,1);assert.equal(w.performance!.daily[2].ppc,null);assert.equal(s.entries.at(-1)!.reason,undefined);assert.equal(dailyReasonReport(s,[w]).total,0);
});
test('daily reasons remain reportable when catch-up is on time and no weekly primary reason exists',()=>{
 let s=fixture();s=save(s,week,0,'RC-07');s=select(s,tue);s=save(s,tue,18);s=select(s,wed);s=save(s,wed,0);s=run(s,{type:'close',week});
 const w=s.weeks[0],r=dailyReasonReport(s,[w]);assert.equal(metrics(s,w).ppc,100);assert.equal(dailyPpc(s,w,week).ppc,0);assert.equal(w.commitments[0].reason,'');assert.equal(r.recorded,1);assert.equal(r.ranked[0].code,'RC-07');
});
test('frequency counts every activity/date, including repeated reasons on different days and simultaneous activities',()=>{
 let s=fixture(true);s=save(s,week,0,'RC-09');s=save(s,week,0,'RC-09','B');s=select(s,tue);s=save(s,tue,0,'RC-07');s=save(s,tue,0,'RC-09','B');
 const r=dailyReasonReport(s,[s.weeks[0]]);assert.equal(r.total,4);assert.equal(r.recorded,4);assert.equal(r.missing,0);assert.deepEqual(r.ranked.map(r=>[r.code,r.count]),[['RC-09',3],['RC-07',1]]);assert.equal(r.periods[0].byCode['RC-09'],2);assert.equal(r.periods[1].byCode['RC-09'],1);assert.equal(r.periods[1].byCode['RC-07'],1);assert.equal(r.periods[2].total,0);
});
test('correcting a quantity replaces its reason contribution instead of double-counting',()=>{
 let s=fixture();s=save(s,week,0,'RC-09');assert.equal(dailyReasonReport(s,[s.weeks[0]]).total,1);
 s=save(s,week,0,'RC-07');assert.deepEqual(dailyReasonReport(s,[s.weeks[0]]).ranked.map(r=>r.code),['RC-07']);
 s=save(s,week,6);assert.equal(dailyReasonReport(s,[s.weeks[0]]).total,0);assert.equal(s.entries.length,1);
});
test('legacy invalid or absent daily reasons remain missing and never inherit the weekly primary reason',()=>{
 const s=fixture(),w=s.weeks[0];w.status='closed';w.commitments[0].reason='RC-06';s.entries=[{commitmentId:'A',date:week,quantity:0,reason:'ON_PLAN',note:''},{commitmentId:'A',date:tue,quantity:0,reason:'RC-16',note:''}];
 const before=structuredClone(s),r=dailyReasonReport(s,[w]);assert.equal(r.total,3);assert.equal(r.recorded,0);assert.equal(r.missing,3);assert.deepEqual(r.ranked,[]);assert.equal(r.occurrences.find(row=>row.date===wed)!.actual,null);assert.deepEqual(s,before);assert.equal(w.performance,undefined);
});
test('a recovered daily target with a stale legacy reason is not counted, and Other preserves its explanation',()=>{
 let s=fixture();s=save(s,week,0,'RC-16','A','Pump broke during the pour');const r=dailyReasonReport(s,[s.weeks[0]]);assert.equal(r.recorded,1);assert.equal(r.occurrences[0].note,'Pump broke during the pour');
 s.entries[0].quantity=6;assert.equal(dailyReasonReport(s,[s.weeks[0]]).total,0);
});
test('selected-week and cross-week reports retain separate denominators, stable ordering and no duplicate week counts',()=>{
 const s=close(late()),w=s.weeks[0],second=structuredClone(w);second.key=addDays(week,7);second.performance!.shortfalls=second.performance!.shortfalls.map(row=>({...row,date:addDays(row.date,7),reason:'RC-07'}));s.weeks.push(second);
 const report=dailyReasonReport(s,[second,w,w],'week');assert.equal(report.total,2);assert.equal(report.periods.length,2);assert.deepEqual(report.periods.map(p=>p.key),[week,second.key]);assert.deepEqual(report.ranked.map(r=>r.code),['RC-07','RC-09']);assert.equal(dailyReasonReport(s,[w]).total,1);
});
test('new locked snapshots keep both scores and reasons stable and indexed calculation agrees before close',()=>{
 const active=late(),before=structuredClone(active),indexed=preparePlanningState(structuredClone(active));
 assert.deepEqual(dailyPpcSeries(active,active.weeks[0]),dailyPpcSeries(indexed,indexed.weeks[0]));assert.deepEqual(dailyReasonReport(active,[active.weeks[0]]),dailyReasonReport(indexed,[indexed.weeks[0]]));assert.deepEqual(active,before);
 const s=close(active),stored=structuredClone(s.weeks[0].performance);s.entries.push({commitmentId:'other-week',date:addDays(week,9),quantity:100,note:''});
 assert.deepEqual(s.weeks[0].performance,stored);assert.deepEqual(dailyPpcSeries(s,s.weeks[0]),stored!.daily);assert.deepEqual(dailyShortfalls(s,s.weeks[0]),stored!.shortfalls);
 assert.throws(()=>run(active,{type:'close',week,performance:{weekly:{ppc:100}}}));assert.equal(active.weeks[0].performance,undefined);
});
test('an empty practice week stores null PPC, seven no-work days and zero reason events',()=>{
 let s=emptyState('No work',week);s.classroom=true;s.calendarStart=week;s=run(s,{type:'freeze',week,emptyReason:'Classroom no-work exercise'});s=run(s,{type:'close',week});
 assert.equal(s.weeks[0].performance!.weekly.ppc,null);assert.equal(s.weeks[0].performance!.daily.length,7);assert.ok(s.weeks[0].performance!.daily.every(day=>day.ppc===null&&day.total===0));assert.deepEqual(dailyReasonReport(s,[s.weeks[0]]).occurrences,[]);
});
