import { emptyState,applyCommand,monday,addDays,type Command,type State } from './domain';

export function demoState(now:string):State{
 const current=monday(now);
 const prev=addDays(current,-7);
 const older=addDays(current,-14);
 let state=emptyState('Academic Block · Phase 01',older);
 state.code='IITM-DEMO';
 state.client='Demonstration project';
 state.location='Chennai, Tamil Nadu';
 const run=(command:Command)=>{state=applyCommand(state,command,now);};
 function activity(id:string,name:string,trade:string,area:string,unit:string,total:number,start:string,finish:string,predecessors:string[]=[],float=0){
  return {type:'task' as const,id,name,trade,area,unit,total,owner:trade+' lead',start,finish,
   predecessors,pull:true,milestoneId:'',schedule:{lateFinish:finish,float}};
 }
 const sleeves=activity('t4','Zone B · MEP sleeves','MEP','Zone B','no.',48,addDays(current,7),addDays(current,20),['t1'],-2);
 run({type:'importTasks',tasks:[
  activity('t0','Zone A · Site preparation','Civil','Zone A','m²',40,older,addDays(older,6)),
  activity('t1','Zone A · Foundation concrete','Structure','Zone A','m³',120,prev,addDays(current,6),['t0']),
  activity('t2','Zone B · Reinforcement','Structure','Zone B','t',24,prev,addDays(current,6)),
  activity('t3','Zone A · Blockwork','Civil','Zone A','m²',600,prev,addDays(current,20)),
  {...sleeves,constraints:[{category:'Drawings',description:'MEP sleeve coordination drawing approval',owner:'Design coordinator',due:addDays(current,3)}]},
  activity('t5','Zone A · Wall finishes','Finishes','Zone A','m²',400,addDays(current,21),addDays(current,34),['t4'],4),
 ]});
 const promise=(id:string,taskId:string,week:string,quantity:number)=>run({
  type:'commit',id,taskId,week,quantity,due:addDays(week,5),owner:'Trade lead',
 });
 const actual=(commitmentId:string,date:string,quantity:number,note='Demonstration entry')=>run({type:'actual',commitmentId,date,quantity,note});
 promise('cp-setup','t0',older,40);
 run({type:'freeze',week:older});
 actual('cp-setup',addDays(older,5),40);
 run({type:'close',week:older});

 const ids=['t1','t2','t3'];
 const quantities=[60,12,150];
 ids.forEach((taskId,i)=>promise('cp'+i,taskId,prev,quantities[i]));
 run({type:'freeze',week:prev});
 [60,12,100].forEach((quantity,i)=>actual('cp'+i,addDays(prev,4),quantity));
 run({type:'close',week:prev,reasons:[{commitmentId:'cp2',reason:'RC-07',learning:'Confirm delivery with supplier 48 hours before the promise.'}]});

 ids.forEach((taskId,i)=>promise('cc'+i,taskId,current,quantities[i]));
 run({type:'freeze',week:current});
 actual('cc0',current,20,'Pump pour completed');
 actual('cc1',current,4,'Inspection accepted');
 actual('cc2',current,35,'Zone A, grid 1–3');
 return state;
}
