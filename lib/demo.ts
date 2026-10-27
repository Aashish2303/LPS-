import { emptyState,applyCommand,monday,addDays,type State } from './domain';
export function demoState(now:string):State{
 const current=monday(now),prev=addDays(current,-7),start=addDays(prev,-21);let s=emptyState('Academic Block · Phase 01',start);s.code='IITM-DEMO';s.client='Demonstration project';s.location='Chennai, Tamil Nadu';s.finish=addDays(current,90);
 const cmd=(c:unknown)=>{s=applyCommand(s,c,now);};
 cmd({type:'milestone',id:'m1',name:'Ground floor structure ready',date:addDays(current,28),owner:'Project lead'});
 const defs=[['t1','Zone A · Foundation concrete','Structure','Zone A','m³',120],['t2','Zone B · Reinforcement','Structure','Zone B','t',24],['t3','Zone A · Blockwork','Civil','Zone A','m²',600],['t4','Zone B · MEP sleeves','MEP','Zone B','no.',48],['t5','Zone A · Wall finishes','Finishes','Zone A','m²',400]];
 defs.forEach(([id,name,trade,area,unit,total])=>cmd({type:'task',id,name,trade,area,unit,total,owner:trade+' lead',start,finish:addDays(current,27),predecessors:[],milestoneId:'m1',pull:true}));
 ['t1','t2','t3'].forEach((taskId,i)=>{const quantity=[60,12,150][i];cmd({type:'allocate',id:'ap'+i,taskId,week:prev,quantity});cmd({type:'commit',id:'cp'+i,taskId,week:prev,quantity,due:addDays(prev,5),owner:'Trade lead'});});
 cmd({type:'freeze',week:prev});
 [60,12,100].forEach((quantity,i)=>cmd({type:'actual',commitmentId:'cp'+i,date:addDays(prev,4),quantity,note:'Demonstration entry'}));
 cmd({type:'variance',commitmentId:'cp2',reason:'Materials',learning:'Confirm delivery with supplier 48 hours before the promise.'});cmd({type:'close',week:prev});
 ['t1','t2','t3'].forEach((taskId,i)=>{cmd({type:'allocate',id:'ac'+i,taskId,week:current,quantity:[60,12,150][i]});cmd({type:'commit',id:'cc'+i,taskId,week:current,quantity:[60,12,150][i],due:addDays(current,5),owner:'Trade lead'});});
 cmd({type:'freeze',week:current});
 if(now>=current){cmd({type:'actual',commitmentId:'cc0',date:current,quantity:20,note:'Pump pour completed'});cmd({type:'actual',commitmentId:'cc1',date:current,quantity:4,note:'Inspection accepted'});cmd({type:'actual',commitmentId:'cc2',date:current,quantity:35,note:'Zone A, grid 1–3'});}
 cmd({type:'constraint',id:'k1',taskId:'t4',category:'Drawings',description:'MEP sleeve coordination drawing approval',owner:'Design coordinator',due:addDays(current,3)});
 cmd({type:'constraint',id:'k2',taskId:'t5',category:'Materials',description:'Approve wall finish sample and release order',owner:'Procurement lead',due:addDays(current,4)});
 return s;
}
