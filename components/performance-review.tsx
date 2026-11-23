import {dailyPpcSeries,findTask,fmt,pct,type State,type Week} from '@/lib/domain';
import {dailyReasonReport} from '@/lib/daily-reasons';
import {reasonLabel} from '@/lib/reason-codes';
import {PpcTrend,ReasonPie,ReasonFrequencyTrend} from './metrics-charts';

const displayDate=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const df=(date:string)=>displayDate.format(new Date(date+'T00:00:00Z'));

export function DailyPpcReview({state,week,compact=false}:{state:State;week?:Week;compact?:boolean}){
 const daily=week?dailyPpcSeries(state,week):[];
 return <section className="panel"><div className="panelhead"><div><h2>Daily PPC for the selected week</h2><p>{week?.performance?'Locked daily results saved at closeout.':'Daily activity targets are scored separately from weekly completion.'}</p></div></div>
  {week&&week.commitments.length?<>
   {!compact&&<PpcTrend points={daily.map(day=>({week:day.date,label:df(day.date),ppc:day.ppc}))} label="Daily PPC for the seven-day project week; pending and no-work days have no score"/>}
   <p className="dailyppcexplanation">Daily PPC = achieved daily activity targets ÷ eligible daily activity targets × 100. Each activity counts once. Zero-plan days and targets completed earlier are excluded. Finishing the remaining committed scope also achieves the day’s target. Unsaved entries stay pending while active; missing planned entries count as misses at closeout. A dash means no score. Later catch-up can achieve weekly PPC while an earlier daily miss remains 0% for that activity.</p>
   <div className="tablewrap"><table aria-label="Daily PPC results"><thead><tr><th>Day / date</th><th>Eligible targets</th><th>Achieved</th><th>Missed</th><th>Awaiting entry</th><th>Completed earlier</th><th>Daily PPC</th><th>Status</th></tr></thead><tbody>{daily.map((day,i)=><tr key={day.date}><td>Day {i+1}<small>{df(day.date)}</small></td><td>{day.total}</td><td>{day.done}</td><td>{day.missed}</td><td>{day.pending}</td><td>{day.excluded}</td><td><strong>{day.ppc===null?'—':day.ppc+'%'}</strong></td><td><span className={'badge '+(day.status==='complete'?(day.missed?'amber':'teal'):'neutral')}>{day.status==='not-started'?'Week not started':day.status==='no-work'?'No eligible targets':day.status==='pending'?'Awaiting entries':week.status==='closed'?'Locked':'Saved'}</span></td></tr>)}</tbody></table></div>
  </>:<p className="pad muted">Daily PPC appears after activities are committed to the week.</p>}
 </section>;
}

export function DailyReasonInsights({state,weeks,group='day',title='Daily shortfall reasons · selected week'}:{state:State;weeks:Week[];group?:'day'|'week';title?:string}){
 const report=dailyReasonReport(state,weeks,group),heading=group==='day'?'Date':'Week beginning';
 return <section className="panel"><div className="panelhead"><div><h2>{title}</h2><p>Counts reasons saved during daily check-in, including shortfalls on work that later achieved weekly PPC. Each activity/date counts once.</p></div></div>
  <div className="dailyreasonstats"><span><strong>{report.total}</strong> daily shortfalls</span><span><strong>{report.recorded}</strong> reasons recorded</span><span className={report.missing?'missingreason':''}><strong>{report.missing}</strong> reasons missing</span></div>
  {!!report.missing&&<p className="dailyppcexplanation">Missing or invalid reasons are shown separately and excluded from the pie. They may come from legacy entries or planned days left unrecorded. A weekly primary reason is never substituted for a missing daily reason.</p>}
  {report.ranked.length?<div className="dailyreasonvisuals">
   <ReasonPie rows={report.ranked} label={title}/>
   <div><h3>Top 3 daily reasons</h3><div className="tablewrap"><table aria-label={title+' top three'}><thead><tr><th>Reason</th><th>Occurrences</th><th>Share</th></tr></thead><tbody>{report.ranked.slice(0,3).map(row=><tr key={row.code}><td>{row.label}</td><td>{row.count}</td><td>{pct(row.count,report.recorded)}%</td></tr>)}</tbody></table></div></div>
  </div>:<p className="pad muted">{report.total?'No valid daily reasons were recorded for these shortfalls.':'No saved daily shortfalls in this selection. Pending days are not counted as misses until closeout.'}</p>}
  {report.total>0&&<><h3 className="dailyreasontrendtitle">{group==='day'?'Day-by-day reason frequency':'Weekly trend of daily reasons'}</h3><ReasonFrequencyTrend rows={report.ranked} periods={report.periods.map(period=>({...period,label:df(period.key)}))} label={title}/>{report.missing>0&&<p className="dailyppcexplanation">Grey segments indicate shortfalls without a valid recorded daily reason.</p>}</>}
  {weeks.length>0&&<div className="tablewrap"><table aria-label={title+' frequency trend'}><thead><tr><th>{heading}</th><th>Shortfalls</th>{report.ranked.map(row=><th key={row.code} title={row.label}>{row.label}</th>)}<th>Reason missing</th></tr></thead><tbody>{report.periods.map(period=><tr key={period.key}><td>{group==='week'?period.key:df(period.key)}</td><td>{period.total}</td>{report.ranked.map(row=><td key={row.code}>{period.byCode[row.code]??0}</td>)}<td>{period.missing}</td></tr>)}</tbody></table></div>}
  {!!report.occurrences.length&&<details className="dailyreasonledger"><summary>Review daily shortfall records ({report.total})</summary><div className="tablewrap"><table aria-label={title+' records'}><thead><tr><th>Date</th><th>Activity</th><th>Daily plan</th><th>Daily actual</th><th>Daily result</th><th>Reason</th><th>Note</th></tr></thead><tbody>{report.occurrences.map(row=>{const task=findTask(state,row.taskId);return <tr key={row.week+row.commitmentId+row.date}><td>{df(row.date)}</td><td>{task.name}</td><td>{fmt(row.planned)} {task.unit}</td><td>{row.actual===null?'Not recorded':fmt(row.actual)+' '+task.unit}</td><td>Missed · 0%</td><td>{row.reason?reasonLabel(row.reason):'Reason not recorded'}</td><td>{row.note||'—'}</td></tr>;})}</tbody></table></div></details>}
 </section>;
}
