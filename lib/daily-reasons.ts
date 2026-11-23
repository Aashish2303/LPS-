import {addDays,dailyShortfalls,type State,type Week} from './domain';
import {reasonLabel} from './reason-codes';

// Frequency means one actual shortfall per activity/date, not one primary
// weekly reason and never a quantity sum across different measurement units.
export function dailyReasonReport(s:State,weeks:Week[],group:'day'|'week'='day'){
 const records=[...new Map(weeks.map(w=>[w.key,w])).values()].sort((a,b)=>a.key.localeCompare(b.key));
 const occurrences=records.flatMap(w=>dailyShortfalls(s,w).map(row=>({...row,week:w.key})));
 const counts=new Map<string,number>();
 for(const row of occurrences)if(row.reason)counts.set(row.reason,(counts.get(row.reason)??0)+1);
 const ranked=[...counts].map(([code,count])=>({code,label:reasonLabel(code),count})).sort((a,b)=>b.count-a.count||a.code.localeCompare(b.code));
 const keys=group==='week'?records.map(w=>w.key):[...new Set(records.flatMap(w=>Array.from({length:7},(_,i)=>addDays(w.key,i))))].sort();
 const periods=keys.map(key=>{
  const rows=occurrences.filter(row=>(group==='week'?row.week:row.date)===key),byCode:Record<string,number>={};
  for(const row of rows)if(row.reason)byCode[row.reason]=(byCode[row.reason]??0)+1;
  return {key,total:rows.length,recorded:rows.filter(row=>row.reason).length,missing:rows.filter(row=>!row.reason).length,byCode};
 });
 const recorded=occurrences.filter(row=>row.reason).length;
 return {occurrences,ranked,periods,total:occurrences.length,recorded,missing:occurrences.length-recorded};
}
