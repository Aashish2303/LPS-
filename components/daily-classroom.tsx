'use client';
import {useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,Save} from 'lucide-react';
import {addDays,dailyCursor,dayComplete,findTask,commitmentActual,taskActual,fmt,pct,type State,type Week} from '@/lib/domain';
import {reasonCodes,otherReason} from '@/lib/reason-codes';

type Props={state:State;week?:Week;canEdit:boolean;busy:boolean;send:(command:unknown)=>Promise<boolean>;openWeekly:()=>void;openCloseout:()=>void};
const displayDate=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',timeZone:'UTC'});
const dateLabel=(date:string)=>displayDate.format(new Date(date+'T00:00:00Z'));
export function DailyClassroom({state,week,canEdit,busy,send,openWeekly,openCloseout}:Props){
 const [date,setDate]=useState(week?dailyCursor(week):state.start);
 if(!week||week.status==='draft')return <div className="empty"><h3>Commit activities before daily check-in</h3><p>Open the weekly work plan, commit ready activities, then start the week.</p><button onClick={openWeekly}>Open weekly work plan</button></div>;
 if(!week.commitments.length)return <section className="panel"><h2>No activities were committed for this week</h2><p>{week.noWorkReason?'No-work reason: '+week.noWorkReason:'The week was started with an empty plan. Return to planning to choose the activities and confirm your commitments.'}</p><div className="actions">{week.status==='active'&&<button className="primary" disabled={!canEdit||busy} onClick={()=>send({type:'reopenEmptyWeek',week:week.key})}>Return to weekly planning</button>}{week.status==='active'&&week.noWorkReason&&<button onClick={openCloseout}>Review & close no-work week</button>}</div></section>;
 const active=week.status==='active',cursor=dailyCursor(week),complete=dayComplete(state,week,date),last=addDays(week.key,6);
 async function select(next:string){if(next===date)return;if(!active){setDate(next);return;}if(await send({type:'selectDay',week:week!.key,date:next}))setDate(next);}
 return <>
  <section className="panel daynavigation">
   <div className="panelhead"><div><h2>Day {Math.round((Date.parse(date)-Date.parse(week.key))/86400000)+1} · {dateLabel(date)}</h2><p>Record the quantity for this day only. Select a reason for each activity and save before advancing.</p></div><span className={'badge '+(complete?'teal':'amber')}>{complete?'Day saved':'Entries required'}</span></div>
   <div className="daytabs" aria-label="Exercise days">{Array.from({length:7},(_,i)=>{const key=addDays(week.key,i);return <button key={key} className={date===key?'active':''} disabled={busy||(active&&(key>addDays(cursor,1)||(key>cursor&&!dayComplete(state,week,cursor))))} aria-current={date===key?'date':undefined} onClick={()=>select(key)}>Day {i+1}<small>{dateLabel(key)}</small>{dayComplete(state,week,key)&&<CheckCircle2 size={14}/>}</button>;})}</div>
  </section>
  {week.commitments.map(c=>{const task=findTask(state,c.taskId),entry=state.entries.find(e=>e.commitmentId===c.id&&e.date===date),actual=commitmentActual(state,c),all=taskActual(state,task.id);return <section className="dailycard" key={c.id}>
   <div className="dailyhead"><div><div className="eyebrow">{task.trade} / {task.area}</div><h3>{task.name}</h3><p>{c.owner} · Due {dateLabel(c.due)}</p></div><span className="badge">{entry?.reason?'Saved for this day':'Awaiting entry'}</span></div>
   <div className="dailybody"><div className="dailyprogress"><span>Week actual</span><strong>{fmt(actual)} <small>/ {fmt(c.quantity)} {task.unit}</small></strong><div className="progress"><i style={{width:Math.min(100,pct(actual,c.quantity)??0)+'%'}}/></div><p>All-time scope: {fmt(all)} / {fmt(task.total)} {task.unit}</p></div>
    <DailyEntry key={c.id+date} commitmentId={c.id} date={date} unit={task.unit} activityName={task.name} saved={entry} disabled={!active||!canEdit||busy} send={send}/>
   </div>
  </section>;})}
  <div className="dayactions"><button disabled={busy||date===week.key} onClick={()=>select(addDays(date,-1))}><ArrowLeft size={16}/>Previous day</button>{date<last?<button className="primary" disabled={busy||(!complete&&date>=cursor)} onClick={()=>select(addDays(date,1))}>Next day<ArrowRight size={16}/></button>:<button className="primary" disabled={busy||(!complete&&active)} onClick={openCloseout}>Review & close week<ArrowRight size={16}/></button>}</div>
 </>;
}
function DailyEntry({commitmentId,date,unit,activityName,saved,disabled,send}:{commitmentId:string;date:string;unit:string;activityName:string;saved?:State['entries'][number];disabled:boolean;send:Props['send']}){
 const [reason,setReason]=useState(saved?.reason??'');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);await send({type:'actual',commitmentId,date,quantity:Number(form.get('quantity')),reason:String(form.get('reason')??''),note:String(form.get('note')??'')});}
 return <form className="dailyentry" onSubmit={submit}>
  <label>Completed on {dateLabel(date)} ({unit})<input aria-label={'Daily quantity for '+activityName} name="quantity" type="number" min="0" max="1000000000" step="0.001" defaultValue={saved?.quantity??0} required disabled={disabled}/></label>
  <label>Daily reason (required)<select name="reason" value={reason} onChange={e=>setReason(e.target.value)} required disabled={disabled}><option value="">Select a daily reason…</option><option value="ON_PLAN">Work as planned</option>{reasonCodes.map(([code,title,detail])=><option key={code} value={code}>{code} · {title} — {detail}</option>)}</select></label>
  <label className="dailynote">Daily note {reason===otherReason?'(required)':'(optional)'}<input name="note" maxLength={1000} defaultValue={saved?.note??''} placeholder="Location, inspection, or explanation" required={reason===otherReason} disabled={disabled}/></label>
  <button className="primary" disabled={disabled}><Save size={16}/>Save day</button>
 </form>;
}
