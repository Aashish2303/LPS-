import type {Allocation,State,Task} from './domain';

type Series={dates:string[];totals:number[]};
function series(rows:Map<string,number>):Series{
 const dates=[...rows.keys()].sort();let cumulative=0;
 return {dates,totals:dates.map(date=>(cumulative+=rows.get(date)!))};
}
function through(series:Series|undefined,date:string){
 if(!series)return 0;
 let lo=0,hi=series.dates.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(series.dates[mid]<=date)lo=mid+1;else hi=mid;}
 return lo?series.totals[lo-1]/1000:0;
}
function add(rows:Map<string,Map<string,number>>,id:string,date:string,quantity:number){
 let dates=rows.get(id);if(!dates){dates=new Map();rows.set(id,dates);}
 dates.set(date,(dates.get(date)??0)+Math.round(quantity*1000));
}
export class PlanningIndex{
 readonly tasks:Map<string,Task>;
 readonly forecasts=new Map<string,Allocation[]>();
 readonly issues=new Map<string,Map<string|undefined,string[]>>();
 private readonly commitments=new Map<string,Series>();
 private readonly actuals=new Map<string,Series>();
 private readonly ancestors=new Map<string,Task[]>();
 constructor(state:State){
  this.tasks=new Map(state.tasks.map(t=>[t.id,t]));
  const taskForCommitment=new Map(state.weeks.flatMap(w=>w.commitments.map(c=>[c.id,c.taskId] as const)));
  const byCommitment=new Map<string,Map<string,number>>(),byTask=new Map<string,Map<string,number>>();
  for(const entry of state.entries){add(byCommitment,entry.commitmentId,entry.date,entry.quantity);const taskId=taskForCommitment.get(entry.commitmentId);if(taskId!==undefined)add(byTask,taskId,entry.date,entry.quantity);}
  for(const [id,rows] of byCommitment)this.commitments.set(id,series(rows));
  for(const [id,rows] of byTask)this.actuals.set(id,series(rows));
 }
 commitmentActual(id:string,date:string){return through(this.commitments.get(id),date);}
 taskActual(id:string,date:string){return through(this.actuals.get(id),date);}
 ancestorTasks(task:Task){
  const cached=this.ancestors.get(task.id);if(cached)return cached;
  const found=new Map<string,Task>(),pending=[...task.predecessors];
  while(pending.length){const predecessor=this.tasks.get(pending.pop()!);if(!predecessor||found.has(predecessor.id))continue;found.set(predecessor.id,predecessor);pending.push(...predecessor.predecessors);}
  const result=[...found.values()];this.ancestors.set(task.id,result);return result;
 }
}
// Opt-in cache for immutable UI snapshots only. Commands clone their inputs, so
// mutable command execution never reads a cached ledger or cached readiness.
// Weak keys release the index when the client replaces a project snapshot.
const snapshots=new WeakMap<State,PlanningIndex>();
export function preparePlanningState(state:State){if(!snapshots.has(state))snapshots.set(state,new PlanningIndex(state));return state;}
export function planningIndex(state:State){return snapshots.get(state);}
