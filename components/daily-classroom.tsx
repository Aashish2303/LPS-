'use client';
import {useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,Save} from 'lucide-react';
import {addDays,dailyCommitmentPlan,dailyEntryComplete,dailyCursor,dayComplete,findTask,commitmentActual,taskActual,fmt,pct,type State,type Week} from '@/lib/domain';
import {reasonCodes,reasonCode,otherReason} from '@/lib/reason-codes';

type Props={state:State;week?:Week;canEdit:boolean;busy:boolean;send:(command:unknown)=>Promise<boolean>;openWeekly:()=>void;openCloseout:()=>void};
const displayDate=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',timeZone:'UTC'});
const dateLabel=(date:string)=>displayDate.format(new Date(date+'T00:00:00Z'));
const activityDate=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const activityDateLabel=(date:string)=>activityDate.format(new Date(date+'T00:00:00Z'));
export function DailyClassroom({state,week,canEdit,busy,send,openWeekly,openCloseout}:Props){
 const [date,setDate]=useState(week?dailyCursor(week):state.start);
 if(!week||week.status==='draft')return <div className="empty"><h3>Commit activities before daily check-in</h3><p>Open the weekly work plan, commit ready activities, then start the week.</p><button onClick={openWeekly}>Open weekly work plan</button></div>;
 if(!week.commitments.length)return <section className="panel"><h2>No activities were committed for this week</h2><p>{week.noWorkReason?'No-work reason: '+week.noWorkReason:'The week was started with an empty plan. Return to planning to choose the activities and confirm your commitments.'}</p><div className="actions">{week.status==='active'&&<button className="primary" disabled={!canEdit||busy} onClick={()=>send({type:'reopenEmptyWeek',week:week.key})}>Return to weekly planning</button>}{week.status==='active'&&week.noWorkReason&&<button onClick={openCloseout}>Review & close no-work week</button>}</div></section>;
 const active=week.status==='active',cursor=dailyCursor(week),complete=dayComplete(state,week,date),last=addDays(week.key,6);
 async function select(next:string){if(next===date)return;if(!active){setDate(next);return;}if(await send({type:'selectDay',week:week!.key,date:next}))setDate(next);}
 return <>
  <section className="panel daynavigation">
   <div className="panelhead"><div><h2>Day {Math.round((Date.parse(date)-Date.parse(week.key))/86400000)+1} · {dateLabel(date)}</h2><p>Record the quantity for this day only. A delay reason is required only when actual is below the daily plan. Save before advancing.</p></div><span className={'badge '+(complete?'teal':'amber')}>{complete?'Day saved':'Entries required'}</span></div>
   <div className="daytabs" aria-label="Exercise days">{Array.from({length:7},(_,i)=>{const key=addDays(week.key,i);return <button key={key} className={date===key?'active':''} disabled={busy||(active&&(key>addDays(cursor,1)||(key>cursor&&!dayComplete(state,week,cursor))))} aria-current={date===key?'date':undefined} onClick={()=>select(key)}>Day {i+1}<small>{dateLabel(key)}</small>{dayComplete(state,week,key)&&<CheckCircle2 size={14}/>}</button>;})}</div>
  </section>
  {week.commitments.map(c=>{const task=findTask(state,c.taskId),entry=state.entries.find(e=>e.commitmentId===c.id&&e.date===date),actual=commitmentActual(state,c),all=taskActual(state,task.id),plan=dailyCommitmentPlan(task,week.key,c),plannedToday=plan.days.find(d=>d.date===date)!.quantity;return <section className="dailycard" key={c.id}>
   <div className="dailyhead"><div><div className="eyebrow">{task.trade} / {task.area}</div><h3>{task.name}</h3><p>{c.owner}</p><p className="dailyactivitydates"><span>Activity start: <time dateTime={task.start}>{activityDateLabel(task.start)}</time></span><span>Planned finish: <time dateTime={task.finish}>{activityDateLabel(task.finish)}</time></span><span>Weekly due: <time dateTime={c.due}>{activityDateLabel(c.due)}</time></span></p></div><span className="badge">{dailyEntryComplete(plannedToday,entry)?'Saved for this day':entry?'Shortfall reason required':'Awaiting entry'}</span></div>
   <div className="dailybody"><div className="dailyprogress"><span>Week actual</span><strong>{fmt(actual)} <small>/ {fmt(c.quantity)} {task.unit}</small></strong><div className="progress"><i style={{width:Math.min(100,pct(actual,c.quantity)??0)+'%'}}/></div><p>All-time scope: {fmt(all)} / {fmt(task.total)} {task.unit}</p><div className="dailytarget" aria-label={'Daily target for '+task.name}><span>Average daily target</span><strong>{fmt(plan.average)} <small>{task.unit}/day</small></strong><small>{fmt(c.quantity)} {task.unit} ÷ {plan.workingDays} activity {plan.workingDays===1?'day':'days'} in this week</small><small>{plan.carryover?'Carryover planned '+dateLabel(plan.start)+' – '+dateLabel(plan.finish):'Planned '+dateLabel(plan.start)+' – '+dateLabel(plan.finish)}</small></div><details className="dailyplantable"><summary>View daily plan for this week</summary><table><caption>Daily quantities ({task.unit})</caption><thead><tr><th>Date</th><th>Plan</th><th>Actual</th></tr></thead><tbody>{plan.days.map(day=>{const saved=state.entries.find(e=>e.commitmentId===c.id&&e.date===day.date);return <tr key={day.date} className={day.date===date?'selectedday':''}><td>{dateLabel(day.date)}</td><td>{fmt(day.quantity)}</td><td>{saved?fmt(saved.quantity):'—'}</td></tr>;})}</tbody><tfoot><tr><th>Total</th><td>{fmt(c.quantity)}</td><td>{fmt(actual)}</td></tr></tfoot></table></details></div>
    <DailyEntry key={c.id+date} commitmentId={c.id} date={date} unit={task.unit} activityName={task.name} planned={plannedToday} saved={entry} disabled={!active||!canEdit||busy} send={send}/>
   </div>
  </section>;})}
  <div className="dayactions"><button disabled={busy||date===week.key} onClick={()=>select(addDays(date,-1))}><ArrowLeft size={16}/>Previous day</button>{date<last?<button className="primary" disabled={busy||(!complete&&date>=cursor)} onClick={()=>select(addDays(date,1))}>Next day<ArrowRight size={16}/></button>:<button className="primary" disabled={busy||(!complete&&active)} onClick={openCloseout}>Review & close week<ArrowRight size={16}/></button>}</div>
 </>;
}
function DailyEntry({commitmentId,date,unit,activityName,planned,saved,disabled,send}:{commitmentId:string;date:string;unit:string;activityName:string;planned:number;saved?:State['entries'][number];disabled:boolean;send:Props['send']}){
 const [reason,setReason]=useState(reasonCode(saved?.reason??'')??'');
 const [quantity,setQuantity]=useState(String(saved?.quantity??0));
 const entered=quantity.trim()!==''&&Number.isFinite(Number(quantity))&&Number(quantity)>=0?Number(quantity):null;
 const delta=entered===null?null:(Math.round(entered*1000)-Math.round(planned*1000))/1000;
 const reasonRequired=delta!==null&&delta<0;
 const savedMatches=!!saved&&entered===saved.quantity;
 const comparison=delta===null?'Enter today’s actual to compare':delta<0?'Below daily plan by '+fmt(-delta)+' '+unit:delta>0?'Above daily plan by '+fmt(delta)+' '+unit:planned===0?'No work planned today':'Daily plan met';
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);await send({type:'actual',commitmentId,date,quantity:Number(form.get('quantity')),reason:reasonRequired?String(form.get('reason')??''):'',note:String(form.get('note')??'')});}
 return <form className="dailyentry" onSubmit={submit}>
  <div className="dailycomparison" aria-label={'Daily plan and actual for '+activityName}><div><span>Planned for {dateLabel(date)}</span><strong>{fmt(planned)} <small>{unit}</small></strong></div><div><span>{savedMatches?'Saved actual':'Entered actual'}</span><strong>{entered===null?'—':fmt(entered)} <small>{unit}</small></strong></div><span role="status" className={'badge '+(delta===null?'':delta<0?'amber':'teal')}>{comparison}</span></div>
  <label>Completed on {dateLabel(date)} ({unit})<input aria-label={'Daily quantity for '+activityName} name="quantity" type="number" min="0" max="1000000000" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)} required disabled={disabled}/></label>
  {reasonRequired?<label>Delay reason (required for shortfall)<select name="reason" value={reason} onChange={e=>setReason(e.target.value)} required disabled={disabled}><option value="">Select the reason for the shortfall…</option>{reasonCodes.map(([code,title,detail])=><option key={code} value={code}>{code} · {title} — {detail}</option>)}</select></label>:<div className="dailyreasoninfo"><strong>{delta===null?'Enter the actual quantity':planned===0?'No work planned for this day':'Daily target met'}</strong><p>{delta===null?'The daily comparison will show whether a delay reason is needed.':'No delay reason is required. Save the quantity to record this day.'}</p></div>}
  <label className="dailynote">Daily note {reasonRequired&&reason===otherReason?'(required)':'(optional)'}<input name="note" maxLength={1000} defaultValue={saved?.note??''} placeholder="Location, inspection, or explanation" required={reasonRequired&&reason===otherReason} disabled={disabled}/></label>
  <button className="primary" disabled={disabled}><Save size={16}/>Save day</button>
 </form>;
}
