import {addDays,commitmentActual,dailyCommitmentPlan,dateSchema,DomainError,findTask,pct,taskActual,type State,type Week} from './domain';

export type DailyActivityResult={
 commitmentId:string;taskId:string;planned:number;actual:number|null;
 status:'achieved'|'missed'|'pending'|'completed-earlier'|'not-planned';
};
export type DailyPpc={
 date:string;scheduled:number;excluded:number;total:number;done:number;missed:number;pending:number;
 ppc:number|null;status:'not-started'|'no-work'|'pending'|'complete';activities:DailyActivityResult[];
};
const units=(n:number)=>Math.round(n*1000);

// Read the frozen weekly promises and saved ledger, never the wall clock or
// unsaved input values. Earlier completion removes only later daily targets.
export function dailyPpcSeries(s:State,w:Week):DailyPpc[]{
 const plans=w.commitments.map(c=>({c,task:findTask(s,c.taskId),plan:dailyCommitmentPlan(findTask(s,c.taskId),w.key,c)}));
 const entries=new Map(s.entries.map(e=>[e.commitmentId+'\0'+e.date,e]));
 return Array.from({length:7},(_,i)=>{
  const date=addDays(w.key,i),previous=addDays(date,-1);
  const activities:DailyActivityResult[]=plans.map(({c,task,plan})=>{
   const planned=plan.days[i].quantity,entry=entries.get(c.id+'\0'+date),actual=entry?.quantity??null;
   let status:DailyActivityResult['status'];
   if(units(planned)===0)status='not-planned';
   else{
    const before=units(commitmentActual(s,c,previous)),scopeBefore=units(taskActual(s,task.id,previous));
    if(before>=units(c.quantity)||scopeBefore>=units(task.total))status='completed-earlier';
    else if(!entry||w.status==='draft')status=w.status==='closed'?'missed':'pending';
    else status=units(entry.quantity)>=units(planned)||before+units(entry.quantity)>=units(c.quantity)||scopeBefore+units(entry.quantity)>=units(task.total)?'achieved':'missed';
   }
   return {commitmentId:c.id,taskId:c.taskId,planned,actual,status};
  });
  const count=(status:DailyActivityResult['status'])=>activities.filter(a=>a.status===status).length;
  const excluded=count('completed-earlier'),done=count('achieved'),missed=count('missed'),pending=count('pending');
  const total=done+missed+pending,scheduled=total+excluded;
  return {date,scheduled,excluded,total,done,missed,pending,
   ppc:w.status==='draft'||pending?null:pct(done,total),
   status:w.status==='draft'?'not-started':!total?'no-work':pending?'pending':'complete',activities};
 });
}
export function dailyPpc(s:State,w:Week,date:string):DailyPpc{
 dateSchema.parse(date);
 if(date<w.key||date>addDays(w.key,6))throw new DomainError('Choose a day within the selected week');
 return dailyPpcSeries(s,w).find(day=>day.date===date)!;
}
