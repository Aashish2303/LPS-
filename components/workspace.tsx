'use client';

import { useEffect,useRef,useState,useMemo,type FormEvent,type ReactNode } from 'react';
import { LayoutDashboard,Flag,CalendarRange,Handshake,ClipboardCheck,ShieldCheck,ChartNoAxesCombined,BookOpen,Settings,Plus,ArrowUpRight,ArrowRight,ChevronLeft,ChevronRight,Search,Download,Upload,RefreshCw,LogOut,X,Check,Lock,AlertTriangle,Menu,Layers,Building2,CheckCircle2,Clock3,MoreHorizontal,Users,Activity } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { addDays,applyCommand,available,blockers,commitmentActual,findTask,fmt,forecastDue,metrics,monday,network,pct,ready,remaining,sum,taskActual,today,unitTotals,weekAllocations,projectWeek,calendarAnchor,currentExerciseWeek,weekNumber,dailyCursor,dayComplete,type State,type Task,type Week,type Command } from '@/lib/domain';
import { demoState } from '@/lib/demo';
import Brand from './brand';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {authPaths,parseRoute,projectPath,safeReturnPath,validWeek,type AuthMode} from '@/lib/routes';
import {authFailure} from '@/lib/auth-policy';
import Landing from './landing';
import {parsePhaseCsv,phaseCsvTemplate} from '@/lib/phase-csv';
import {reasonCode,reasonCodes,reasonLabel,otherReason} from '@/lib/reason-codes';
import {DailyClassroom} from './daily-classroom';
import InstituteLogos from './institute-logos';
import {PpcTrend,ReasonPie} from './metrics-charts';

type User={id:string;email:string;name:string;emailVerified?:boolean};
type Project={id:string;name:string;version:number;role:string};
type EventRecord={actor_id:string;command:{type:string};version:number;created_at:string};
type Member={email:string;role:string};
type Field={name:string;label:string;type?:string;value?:string|number|string[];options?:{value:string;label:string}[];required?:boolean;multiple?:boolean;min?:string|number;max?:string|number;hint?:string};
type Dialog={title:string;subtitle?:string;fields:Field[];submit:string;action:(data:FormData)=>Promise<boolean>};
const nav=[{group:'WORKSPACE',items:[{key:'overview',label:'Project overview',icon:LayoutDashboard}]},{group:'SHOULD · CAN',items:[{key:'phase',label:'Phase Plan',icon:Flag},{key:'lookahead',label:'Lookahead',icon:CalendarRange},{key:'constraints',label:'Constraint log',icon:ShieldCheck}]},{group:'WILL · DID · LEARN',items:[{key:'weekly',label:'Weekly work plan',icon:Handshake},{key:'daily',label:'Daily check-in',icon:ClipboardCheck},{key:'closeout',label:'Weekly closeout',icon:Lock},{key:'analytics',label:'Trends & metrics',icon:ChartNoAxesCombined}]},{group:'PROJECT',items:[{key:'academy',label:'Lean field guide',icon:BookOpen},{key:'settings',label:'Settings & access',icon:Settings}]}];
const reasons=['Materials','Drawings','Workforce','Equipment','Predecessor delay','Planning','Weather','Quality / rework','Access / logistics','Safety','Client approval','Commercial','Other'];
const uid=()=>crypto.randomUUID();
const df=(d:string)=>new Date(d+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const formText=(d:FormData,k:string)=>String(d.get(k)??'').trim();
const dateRange=(week:string)=>`${df(week)} – ${df(addDays(week,6))}`;
const options=(xs:string[])=>xs.map(x=>({value:x,label:x}));
const fileDownload=(name:string,text:string,type='application/json')=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);};

function Badge({children,tone='neutral'}:{children:ReactNode;tone?:string}){return <span className={`badge ${tone}`}>{children}</span>}
function Empty({title,detail,action}:{title:string;detail:string;action?:ReactNode}){return <div className="empty"><Layers size={30}/><h3>{title}</h3><p>{detail}</p>{action}</div>}
function Progress({value}:{value:number}){return <div className="progress"><i style={{width:Math.min(100,Math.max(0,value))+'%'}}/></div>}
function Stat({label,value,detail,icon}:{label:string;value:ReactNode;detail:ReactNode;icon:ReactNode}){return <article className="stat"><div className="statlabel">{label}<span>{icon}</span></div><strong>{value}</strong><small>{detail}</small></article>}
function Panel({title,detail,action,children,className=''}:{title:string;detail?:string;action?:ReactNode;children:ReactNode;className?:string}){return <section className={`panel ${className}`}><div className="panelhead"><div><h2>{title}</h2>{detail&&<p>{detail}</p>}</div>{action}</div>{children}</section>}

export default function Workspace(){
 const router=useRouter(),pathname=usePathname(),searchParams=useSearchParams(),route=parseRoute(pathname);
 const view=route&&(route.kind==='project'||route.kind==='demo')?route.view:'overview',authMode=route?.kind==='auth'?route.mode:'';
 const requestedWeek=searchParams.get('week');
 const [loadError,setLoadError]=useState(false),[authEmail,setAuthEmail]=useState('');
 const loadSequence=useRef(0),projectContext=useRef('');
 projectContext.current=route?.kind==='project'?route.projectId:route?.kind==='demo'?'demo':'';
 function setWeek(value:string){if(!validWeek(value))return;const query=new URLSearchParams(searchParams.toString());query.set('week',value);router.push(pathname+'?'+query.toString(),{scroll:false});}
 function setAuthMode(mode:string){if(mode){const path=authPaths[mode as AuthMode];if(!path)return;const next=route?.kind==='project'?pathname+location.search:safeReturnPath(searchParams.get('next'));router.push(path+(next!=='/'?'?next='+encodeURIComponent(next):''),{scroll:false});}else router.replace(user&&projectId?projectPath(projectId):'/');}
 const [user,setUser]=useState<User|null>(null),[initializing,setInitializing]=useState(true),[demo,setDemo]=useState(false),[state,setState]=useState<State|null>(null),[projects,setProjects]=useState<Project[]>([]),[projectId,setProjectId]=useState(''),[version,setVersion]=useState(1),[role,setRole]=useState('owner'),[events,setEvents]=useState<EventRecord[]>([]),[members,setMembers]=useState<Member[]>([]);
 const currentDate=today();
 const defaultWeek=state?currentExerciseWeek(state):currentDate;
 const week=state&&['analytics','closeout'].includes(view)&&validWeek(requestedWeek)&&projectWeek(state,requestedWeek)===requestedWeek?requestedWeek:defaultWeek;
 const [query,setQuery]=useState(''),[busy,setBusy]=useState(false),[toast,setToast]=useState<{text:string;error:boolean}|null>(null),[dialog,setDialog]=useState<Dialog|null>(null),[mobile,setMobile]=useState(false),[authPending,setAuthPending]=useState(false);
 const busyRef=useRef(false),toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const notify=(text:string,error=false)=>{setToast({text,error});if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000);};
 const canEdit=role!=='viewer';
 const cpm=useMemo(()=>state?network(state):{},[state]);
 async function loadProject(id:string){const sequence=++loadSequence.current;setBusy(true);setLoadError(false);try{const r=await fetch('/api/projects/'+id,{cache:'no-store'});const d=await r.json();if(sequence!==loadSequence.current)return;if(!r.ok){if(r.status===401){setUser(null);router.replace('/login?next='+encodeURIComponent(projectPath(id,view)));}throw Error(d.error??'Project unavailable.');}setState(d.state);setProjectId(id);setVersion(d.version);setRole(d.role);setEvents(d.events??[]);setMembers(d.members??[]);}catch{if(sequence===loadSequence.current){setState(null);setLoadError(true);notify('Unable to open this project. Check your access or try again.',true);}}finally{if(sequence===loadSequence.current)setBusy(false);}}
 async function loadProjects(){const r=await fetch('/api/projects',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error('Unable to load projects.');setProjects(d);return d as Project[];}
 useEffect(()=>{let disposed=false;authClient.getSession().then(r=>{if(!disposed&&r.data?.user)setUser(r.data.user as User);}).catch(()=>{if(!disposed)notify('Unable to restore your session. Please sign in again.',true);}).finally(()=>{if(!disposed)setInitializing(false);});return()=>{disposed=true;};},[]);
 useEffect(()=>{if(initializing||!route)return;let disposed=false;setDialog(null);setMobile(false);setQuery('');
  if(route.kind==='demo'){if(!demo){loadSequence.current++;setDemo(true);setRole('owner');setState(demoState(today()));setLoadError(false);setBusy(false);}return;}
  if(demo){loadSequence.current++;setDemo(false);setState(null);setBusy(false);}
  if(route.kind==='auth'){loadSequence.current++;setState(null);setLoadError(false);setBusy(false);return;}
  if(!user){loadSequence.current++;setState(null);if(route.kind==='project')router.replace('/login?next='+encodeURIComponent(pathname+location.search));return;}
  if(route.kind==='project'){if(projectId!==route.projectId||!state||demo){setState(null);void loadProject(route.projectId);}if(!projects.length)void loadProjects().catch(()=>notify('Unable to load the project list. Please refresh.',true));return;}
  setState(null);setBusy(true);void loadProjects().then(list=>{if(!disposed&&list.length)router.replace(projectPath(list[0].id));}).catch(()=>{if(!disposed)notify('Unable to load projects. Please refresh.',true);}).finally(()=>{if(!disposed)setBusy(false);});
  return()=>{disposed=true;};
 // Route changes select the workspace; the current project stays mounted across sections.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[pathname,initializing,user?.id]);
 useEffect(()=>{if(!dialog&&!authMode)return;const modal=document.querySelector<HTMLElement>('[role=dialog]');const previous=document.activeElement as HTMLElement|null;const list=()=>Array.from(modal?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')??[]);list()[0]?.focus();const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy){setDialog(null);if(authMode)setAuthMode('');}if(e.key==='Tab'){const elements=list(),first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);previous?.focus();};},[dialog,authMode,busy]);
 function navigate(key:string,id=projectId){setQuery('');setMobile(false);const target=key==='analytics'?week:defaultWeek;router.push((demo?'/demo/'+key:projectPath(id,key))+'?week='+target,{scroll:true});}
 function afterCommand(command:unknown,next:State){
  const type=(command as {type:string}).type;
  if(type==='close'||type==='importTasks'){
   const key=currentExerciseWeek(next);
   router.push((demo?'/demo/lookahead':projectPath(projectId,'lookahead'))+'?week='+key,{scroll:true});
  }
 }
 async function send(command:unknown):Promise<boolean>{if(!state||busyRef.current)return false;if(!canEdit){notify('This project is view only.',true);return false;}busyRef.current=true;setBusy(true);try{
 if(demo){const next=applyCommand(state,command);setState(next);afterCommand(command,next);notify('Demo updated · changes reset when you leave');return true;}
 const r=await fetch('/api/projects/'+projectId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:uid(),version,command})});const d=await r.json();if(!r.ok)throw Error(d.error);if(projectContext.current!==projectId)return true;setState(d.state);setVersion(d.version);afterCommand(command,d.state);setProjects(ps=>ps.map(p=>p.id===projectId?{...p,name:d.state.name,version:d.version}:p));notify('Saved to project');if(['member','removeMember'].includes((command as {type:string}).type))await loadProject(projectId);return true;
 }catch(e){notify((e as Error).message,true);return false;}finally{busyRef.current=false;setBusy(false);}}
 function enterDemo(){router.push('/demo/overview');}
 function leaveDemo(){loadSequence.current++;setDemo(false);setState(null);router.push('/');}
 async function newProject(){setDialog({title:'Create a project',subtitle:'Start with a clean workspace. Your project is private until you add members.',fields:[{name:'name',label:'Project name',required:true}],submit:'Create project',action:async d=>{try{setBusy(true);const r=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:formText(d,'name')})}),x=await r.json();if(!r.ok)throw Error(x.error);setProjects(ps=>[{id:x.id,name:x.state.name,version:1,role:'owner'},...ps]);setProjectId(x.id);setState(x.state);setVersion(1);setRole('owner');setEvents([]);setMembers([]);setDemo(false);router.push(projectPath(x.id,'phase'));return true;}catch(e){notify((e as Error).message,true);return false;}finally{setBusy(false);}}});}
 async function submitAuth(e:FormEvent<HTMLFormElement>){e.preventDefault();const d=new FormData(e.currentTarget);setAuthPending(true);try{let r;if(authMode==='verify'){r=await authClient.emailOtp.verifyEmail({email:user!.email,otp:formText(d,'otp')});if(r.error)throw Error(authFailure(r.error.status??400).message);const session=await authClient.getSession();if(session.data?.user)setUser(session.data.user as User);setAuthMode('');notify('Email verified. Shared project access is available.');await loadProjects();return;}else if(authMode==='register')r=await authClient.signUp.email({email:formText(d,'email'),password:String(d.get('password')??''),name:formText(d,'name')});else if(authMode==='reset'){r=await authClient.emailOtp.sendVerificationOtp({email:formText(d,'email'),type:'forget-password'});if(r.error)throw Error(authFailure(r.error.status??400).message);setAuthEmail(formText(d,'email'));setAuthMode('reset-confirm');notify('If the address can receive a reset code, it will arrive shortly.');return;}else if(authMode==='reset-confirm'){r=await authClient.emailOtp.resetPassword({email:formText(d,'email'),otp:formText(d,'otp'),password:String(d.get('password')??'')});if(r.error)throw Error(authFailure(r.error.status??400).message);setAuthMode('login');notify('Password reset. Sign in with your new password.');return;}else r=await authClient.signIn.email({email:formText(d,'email'),password:String(d.get('password')??'')});if(r.error)throw Error(authFailure(r.error.status??400).message);const session=await authClient.getSession();if(!session.data?.user)throw Error(authFailure(401).message);setUser(session.data.user as User);setDemo(false);router.replace(safeReturnPath(searchParams.get('next')));}catch(e){notify((e as Error).message,true);}finally{setAuthPending(false);}}
 function taskForm(existing?:Task){if(!state)return;setDialog({title:existing?'Edit activity':'Add activity',subtitle:'Define measurable scope. Calendar-day, finish-to-start dependencies are supported.',fields:[{name:'name',label:'Activity / handoff',value:existing?.name,required:true},{name:'trade',label:'Trade',options:options(state.trades),value:existing?.trade,required:true},{name:'area',label:'Area',options:options(state.areas),value:existing?.area,required:true},{name:'owner',label:'Last planner',value:existing?.owner,required:true},{name:'total',label:'Total scope quantity',type:'number',value:existing?.total,min:0.001,required:true},{name:'unit',label:'Unit',options:options(['m³','m²','m','t','kg','no.','lot']),value:existing?.unit,required:true},{name:'start',label:'Baseline start',type:'date',value:existing?.start??state.start,min:state.start,max:state.finish,required:true},{name:'finish',label:'Baseline finish',type:'date',value:existing?.finish??state.finish,min:state.start,max:state.finish,required:true},{name:'predecessors',label:'Predecessors',options:state.tasks.filter(t=>t.id!==existing?.id).map(t=>({value:t.id,label:t.name})),value:existing?.predecessors,multiple:true,hint:'Hold Ctrl / ⌘ to select multiple. Only finish-to-start is supported.'}],submit:existing?'Save activity':'Add activity',action:d=>{const task={type:'task',id:existing?.id??uid(),name:formText(d,'name'),trade:formText(d,'trade'),area:formText(d,'area'),owner:formText(d,'owner'),total:Number(d.get('total')),unit:formText(d,'unit'),start:formText(d,'start'),finish:formText(d,'finish'),predecessors:d.getAll('predecessors').map(String),milestoneId:'',pull:true};const {type,...activity}=task;return send(existing?{type:'editTask',task:activity}:task);}});}
 function constraintForm(task?:Task,affectedWeek=week){
  if(!state)return;
  setDialog({
   title:'Add constraint',
   subtitle:(task?.name??'Select an activity')+' · Week '+weekNumber(state,affectedWeek)+' · '+dateRange(affectedWeek),
   fields:[
    {name:'taskId',label:'Activity',options:state.tasks.map(t=>({value:t.id,label:t.name})),value:task?.id,required:true},
    {name:'category',label:'Constraint category',options:options(reasons),required:true},
    {name:'description',label:'What prevents the work?',required:true},
    {name:'owner',label:'Removal owner',value:task?.owner,required:true},
    {name:'due',label:'Required by',type:'date',value:affectedWeek,required:true},
   ],submit:'Save constraint',
   action:d=>send({type:'constraint',id:uid(),taskId:formText(d,'taskId'),week:affectedWeek,
    category:formText(d,'category'),description:formText(d,'description'),owner:formText(d,'owner'),due:formText(d,'due')}),
  });
 }
 function commitForm(task:Task,quantity:number){
  const due=forecastDue(task,week);
  setDialog({
   title:'Make a weekly promise',subtitle:task.name+' · '+fmt(quantity)+' '+task.unit+' for '+dateRange(week),
   fields:[
    {name:'due',label:'Promise due date',type:'date',value:due,min:task.start>week?task.start:week,max:due,required:true},
    {name:'owner',label:'Person making the promise',value:task.owner,required:true},
   ],
   submit:'Add promise',action:d=>send({type:'commit',id:uid(),taskId:task.id,week,
    quantity,due:formText(d,'due'),owner:formText(d,'owner')}),
  });
 }
 function exportProject(){if(!state)return;fileDownload(`${state.code}-project-${today()}.json`,JSON.stringify({format:'lps-project-export-v1',exportedAt:new Date().toISOString(),version,state,events},null,2));}
 function importForm(){
  setDialog({
   title:'Import phase schedule',
   subtitle:'Upload or paste a CSV. The schedule sets the project dates, adds trades and zones, and fills the lookahead. All rows are validated together.',
   fields:[{name:'csv',label:'CSV content',type:'textarea',required:true,
    hint:'Use the template for early and late dates, float and open constraints. Predecessor IDs are separated with |. Earlier templates with start and finish also work.'}],
   submit:'Validate & import',
   action:async d=>{
    try{
     const command=parsePhaseCsv(formText(d,'csv'));
     const imported=await send(command);
     return imported;
    }catch(e){notify((e as Error).message,true);return false;}
   },
  });
 }
 const currentWeek=state?.weeks.find(w=>w.key===week),title=nav.flatMap(g=>g.items).find(n=>n.key===view)?.label??'Project overview';
 const weekControl=state&&<div className="weekcontrol fixedweek" aria-label="Exercise week"><CalendarRange size={16}/><span>Week {weekNumber(state,week)} · {dateRange(week)}</span></div>;
 const historyControl=state&&<label className="historycontrol">Review week<select aria-label="Review week" value={week} onChange={e=>setWeek(e.target.value)}>
  {[...new Set([defaultWeek,...state.weeks.map(w=>w.key)])].sort().map(key=><option key={key} value={key}>Week {weekNumber(state,key)} · {dateRange(key)}</option>)}
 </select></label>;

 if(!route)return null;
 if(initializing||(route?.kind==='project'&&user&&!state&&!loadError))return <div className="loading"><Brand/><p>Opening your workspace…</p></div>;
 if(route?.kind==='project'&&loadError)return <main className="errorpage"><h1>Project unavailable.</h1><p>Check your access or try opening another project.</p><div className="actions"><button onClick={()=>loadProject(route.projectId)}>Try again</button><button onClick={()=>router.push('/')}>My projects</button></div></main>;
 return <>
 {!state&&<Landing signedIn={!!user} onCreate={()=>user?newProject():setAuthMode('register')} onLogin={()=>setAuthMode('login')} onDemo={enterDemo}/>}
 {state&&<div className="app-shell">
 <aside className={mobile?'sidebar visible':'sidebar'}><div className="sidebarbrand"><Brand/><small>CONSTRUCTION LEARNING LAB</small><InstituteLogos compact/><button className="mobileclose" aria-label="Close menu" onClick={()=>setMobile(false)}><X size={18}/></button></div><div className={demo?'projectswitch':'projectswitch with-create'}><span className="projecticon"><Building2 size={18}/></span><div><small>PROJECT WORKSPACE</small>{demo?<strong>Academic Block · Demo</strong>:<select aria-label="Select project" value={projectId} disabled={busy} onChange={e=>router.push(projectPath(e.target.value))}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}</div></div>{!demo&&<button className="newprojectbutton" type="button" disabled={busy} onClick={newProject}><Plus size={16}/>New project</button>}
 <nav>{nav.map(g=><div className="navgroup" key={g.group}><small>{g.group}</small>{g.items.map(n=><button key={n.key} aria-current={view===n.key?'page':undefined} className={view===n.key?'navitem active':'navitem'} onClick={()=>navigate(n.key)}><n.icon size={17}/><span>{n.label}</span>{n.key==='constraints'&&state.constraints.filter(c=>!c.resolvedOn).length>0&&<b>{state.constraints.filter(c=>!c.resolvedOn).length}</b>}</button>)}</div>)}</nav><div className="sidebarfoot"><div className="avatar">{(user?.name??'Demo Planner').split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><strong>{demo?'Demo planner':user?.name}</strong><small>{demo?'Interactive demonstration':role+' · private project'}</small></div><button aria-label={demo?'Exit demo':'Sign out'} onClick={async()=>{if(demo)leaveDemo();else {const result=await authClient.signOut();if(result.error){notify('Unable to sign out. Please try again.',true);return;}loadSequence.current++;setUser(null);setState(null);setProjects([]);setProjectId('');router.replace('/login');}}}><LogOut size={16}/></button></div></aside>
 <div className="workspace"><header className="topbar"><div className="breadcrumb"><button className="mobilemenu" aria-label="Open menu" aria-expanded={mobile} onClick={()=>setMobile(true)}><Menu size={20}/></button><span>Workspace</span><ChevronRight size={14}/><strong>{title}</strong></div><div className="topright"><span className="sync"><i/>{busy?'Saving…':demo?'Demo workspace':'Connected'}</span>{!demo&&<button aria-label="Refresh project" onClick={()=>loadProject(projectId)} disabled={busy}><RefreshCw size={16}/></button>}<span className="topdate">{new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'})}</span></div></header>
 {demo&&<div className="demobar"><span><Activity size={14}/> Interactive demo · sample data · changes are temporary</span><button onClick={()=>user?newProject():setAuthMode('register')}>Create a real workspace <ArrowUpRight size={14}/></button></div>}
 <main className="main"><div className="pageheading"><div><div className="eyebrow">{state.code} <span>/</span> {view==='overview'?'THE BIG ROOM':nav.find(g=>g.items.some(n=>n.key===view))?.group}</div><h1>{title}</h1><p>{({overview:'A clear view of the plan, the promises, and what needs you next.',phase:'Import activity dates, quantities, float and predecessors.',lookahead:'Review the next six weeks and clear constraints before promising work.',constraints:'Remove the blockers. Protect the flow of work.',weekly:'Promises made by the people closest to the work.',daily:'Practise daily quantities for any day in the selected week. The ledger handles the cumulative total.',closeout:'Review the promises honestly. Turn variance into a better next week.',analytics:'Understand reliability. Improve the planning system.',academy:'A practical reference for your next planning conversation.',settings:'Your project, its boundaries, and the people who can access it.'} as Record<string,string>)[view]}</p></div><div className="headingactions">{view==='overview'&&<button onClick={exportProject}><Download size={16}/>Export project</button>}{['weekly','daily','closeout','lookahead'].includes(view)&&weekControl}{view==='analytics'&&historyControl}{view==='constraints'&&<button className="primary" disabled={!canEdit||busy||!state.tasks.length} onClick={()=>constraintForm()}><Plus size={16}/>Raise constraint</button>}</div></div>
 {view==='overview'&&<Overview s={state} current={currentWeek} week={week} navigate={navigate}/>}
 {view==='phase'&&<Panel title="Phase schedule" detail="Early dates drive the forecast. Imported late dates and float are shown as supplied." action={<div className="actions">
  <button onClick={()=>fileDownload('phase-schedule-template.csv',phaseCsvTemplate(state.start),'text/csv;charset=utf-8')}><Download size={15}/>CSV template</button>
  <button disabled={!canEdit||busy} onClick={()=>taskForm()}>Add activity</button>
  <button className="primary" disabled={!canEdit||busy} onClick={importForm}><Upload size={15}/>Import CSV</button>
 </div>}>
  {state.tasks.length?<><div className="toolbar"><label className="search"><Search size={16}/><input aria-label="Search activities" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search activities"/></label></div>
  <div className="tablewrap"><table><thead><tr><th>Activity</th><th>Quantity</th><th>Early start</th><th>Early finish</th><th>Late start</th><th>Late finish</th><th>Float</th><th>Predecessors</th><th/></tr></thead>
   <tbody>{state.tasks.filter(t=>[t.id,t.name,t.trade,t.area].some(value=>value.toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>a.start.localeCompare(b.start)).map(t=>{
    const float=t.schedule?.float??cpm[t.id]?.float;
    const overlap=t.predecessors.some(id=>findTask(state,id).finish>=t.start);
    return <tr key={t.id}><td><strong>{t.name}</strong><small>{t.id} · {t.trade} · {t.area} · {t.owner}</small>{overlap&&<small className="warningtext">Early dates overlap a predecessor</small>}</td>
     <td>{fmt(t.total)} {t.unit}</td><td>{t.start}</td><td>{t.finish}</td>
     <td>{t.schedule?.lateStart??(t.schedule?'—':cpm[t.id]?.ls??'—')}</td>
     <td>{t.schedule?.lateFinish??(t.schedule?'—':cpm[t.id]?.lf??'—')}</td>
     <td>{float===undefined?'—':fmt(float)+' d'}{float!==undefined&&<small>{t.schedule?.float===undefined?'Calculated':'Imported'}</small>}</td>
     <td>{t.predecessors.join(', ')||'—'}</td>
     <td>{!t.schedule?.importedOn&&!state.allocations.some(a=>a.taskId===t.id)&&!state.weeks.some(w=>w.commitments.some(c=>c.taskId===t.id))&&<button disabled={!canEdit||busy} onClick={()=>taskForm(t)}>Edit</button>}</td>
    </tr>;
   })}</tbody></table></div></>:<Empty title="Import your phase schedule" detail="Start with the CSV template or import your own activity schedule."/>}
 </Panel>}
 {view==='lookahead'&&<Lookahead state={state} week={week} canEdit={canEdit&&!busy} addConstraint={constraintForm} openPhase={()=>navigate('phase')} openWeekly={()=>navigate('weekly')}/>}
 {view==='constraints'&&<><div className="stats three"><Stat label="Open constraints" value={state.constraints.filter(c=>!c.resolvedOn).length} detail="Need an owner’s next action" icon={<ShieldCheck size={18}/>}/><Stat label="Overdue" value={state.constraints.filter(c=>!c.resolvedOn&&c.due<today()).length} detail="Removal date has passed" icon={<AlertTriangle size={18}/>}/><Stat label="Resolved" value={state.constraints.filter(c=>c.resolvedOn).length} detail="Handoffs made possible" icon={<CheckCircle2 size={18}/>}/></div><Panel title="Constraint register" detail="Resolve a blocker with evidence, not just a tick.">{state.constraints.length?<div className="tablewrap"><table><thead><tr><th>Constraint</th><th>Activity</th><th>Owner</th><th>Required by</th><th>Exercise week</th><th>Status</th><th/></tr></thead><tbody>{[...state.constraints].sort((a,b)=>Number(!!a.resolvedOn)-Number(!!b.resolvedOn)||a.due.localeCompare(b.due)).map(c=><tr key={c.id}><td><strong>{c.description}</strong><small>{c.category}</small>{c.resolvedOn&&<small>{c.resolution}</small>}</td><td>{findTask(state,c.taskId).name}</td><td>{c.owner}</td><td>{df(c.due)}</td><td>{c.week?'Week '+weekNumber(state,c.week):'All weeks'}</td><td><Badge tone={c.resolvedOn?'teal':c.due<today()?'red':'amber'}>{c.resolvedOn?'Resolved':c.due<today()?'Overdue':'Open'}</Badge></td><td>{!c.resolvedOn&&<button disabled={!canEdit||busy} onClick={()=>setDialog({title:'Resolve constraint',subtitle:c.description,fields:[{name:'resolution',label:'Resolution / evidence',required:true},{name:'date',label:'Resolved on',type:'date',value:c.week??week,required:true}],submit:'Mark resolved',action:d=>send({type:'resolve',id:c.id,resolution:formText(d,'resolution'),date:formText(d,'date')})})}><Check size={14}/>Resolve</button>}</td></tr>)}</tbody></table></div>:<Empty title="No constraints recorded" detail="Check drawings, materials, people, equipment, access, safety and predecessor handoffs." action={<button disabled={!canEdit||!state.tasks.length} onClick={()=>constraintForm()}>Raise a constraint</button>}/>}</Panel></>}
 {view==='weekly'&&<>
  <div className="cyclebanner"><div><Badge tone={currentWeek?.status==='closed'?'neutral':'teal'}>{currentWeek?.status??'draft'}</Badge><strong>{dateRange(week)}</strong><p>{currentWeek?.status==='active'?'Promises are frozen. Record actual work in Daily check-in.':currentWeek?.status==='closed'?'This week is closed. Promises and entries are locked.':'Choose ready activities below. Start the week to freeze the promises.'}</p></div>
   <div className="actions">{(!currentWeek||currentWeek.status==='draft')&&<button className="primary" disabled={!canEdit||busy} onClick={()=>setDialog({title:'Start and freeze this week?',subtitle:'The original quantities, due dates and PPC denominator will be locked.',fields:[],submit:'Start week & lock promises',action:()=>send({type:'freeze',week})})}><Lock size={15}/>Start week</button>}
   {currentWeek?.status==='active'&&<button className="primary" onClick={()=>navigate('daily')}>Daily check-in <ArrowRight size={16}/></button>}</div>
  </div>
  {(!currentWeek||currentWeek.status==='draft')&&<WeeklyReady state={state} week={week} canEdit={canEdit&&!busy} add={commitForm} openLookahead={()=>navigate('lookahead')}/>}
  <CommitmentTable state={state} week={currentWeek} action={c=>currentWeek?.status==='draft'?<button disabled={!canEdit||busy} onClick={()=>send({type:'uncommit',week,id:c.id})}>Remove</button>:null}/>
 </>}
 {view==='daily'&&<DailyClassroom key={projectId+week} state={state} week={currentWeek} canEdit={canEdit} busy={busy} send={send} openWeekly={()=>navigate('weekly')} openCloseout={()=>navigate('closeout')}/>}
 {view==='closeout'&&<Closeout key={projectId+week+version} state={state} week={currentWeek} weekKey={week} canEdit={canEdit} busy={busy} confirm={evaluations=>setDialog({
  title:'Close and lock this week?',subtitle:'This saves the reasons and locks the promises, daily quantities and PPC for this week.',
  fields:[],submit:'Save & lock week',action:()=>send({type:'close',week,reasons:evaluations}),
 })}/>}
 {view==='analytics'&&<Analytics s={state} week={currentWeek}/>}
 {view==='academy'&&<Academy/>}
 {view==='settings'&&<>
 {!demo&&user&&!user.emailVerified&&<div className="callout"><ShieldCheck size={18}/><div><strong>Verify your account email</strong><p>Verification is required to access projects shared with your email address.</p></div><button onClick={async()=>{try{const r=await authClient.emailOtp.sendVerificationOtp({email:user.email,type:'email-verification'});if(r.error)throw Error(authFailure(r.error.status??400).message);setAuthMode('verify');notify('Check your email for the verification code.');}catch(e){notify((e as Error).message,true);}}}>Send verification code</button></div>}
 <Panel title="Project configuration" detail="A phase schedule import sets the earliest early start and latest late finish. Used trades and areas cannot be removed."><form className="settingsform" key={projectId+version} onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);send({type:'settings',name:formText(d,'name'),code:formText(d,'code'),client:formText(d,'client'),location:formText(d,'location'),start:formText(d,'start'),finish:formText(d,'finish'),trades:formText(d,'trades').split(',').map(x=>x.trim()).filter(Boolean),areas:formText(d,'areas').split(',').map(x=>x.trim()).filter(Boolean)});}}>{([{name:'name',label:'Project name',value:state.name},{name:'code',label:'Project code',value:state.code},{name:'client',label:'Client',value:state.client},{name:'location',label:'Location',value:state.location},{name:'start',label:'Project start',type:'date',value:state.start},{name:'finish',label:'Project finish',type:'date',value:state.finish},{name:'trades',label:'Trades (comma separated)',value:state.trades.join(', ')},{name:'areas',label:'Areas (comma separated)',value:state.areas.join(', ')}] as Field[]).map(f=><label key={f.name}>{f.label}<input name={f.name} type={f.type??'text'} defaultValue={f.value} required={!['client','location'].includes(f.name)} maxLength={1000}/></label>)}<div className="formfooter"><button className="primary" disabled={!canEdit||busy}>Save configuration <Check size={15}/></button></div></form></Panel>
 <Panel title="Project access" detail="Owners manage access. Editors plan and record work. Viewers can read and export. Shared members must verify their email before access is granted." action={role==='owner'&&!demo?<button onClick={()=>setDialog({title:'Add project member',subtitle:'This grants access to this project only. It does not send an email invitation.',fields:[{name:'email',label:'Verified account email',type:'email',required:true},{name:'role',label:'Role',options:options(['editor','viewer']),required:true}],submit:'Grant project access',action:d=>send({type:'member',email:formText(d,'email'),role:formText(d,'role')})})}><Users size={15}/>Add member</button>:null}><div className="memberrow"><div className="avatar">{demo?'DP':user?.name?.[0]}</div><div><strong>{demo?'Demo planner':user?.email}</strong><small>{role==='owner'?'Project owner':'Your account'}</small></div><Badge>{role}</Badge></div>{members.map(m=><div className="memberrow" key={m.email}><span className="avatar"><Users size={17}/></span><strong>{m.email}</strong><Badge>{m.role}</Badge><button disabled={busy} onClick={()=>setDialog({title:'Remove this member?',subtitle:m.email+' will lose access to this project.',fields:[],submit:'Remove access',action:()=>send({type:'removeMember',email:m.email})})}>Remove</button></div>)}</Panel>
 <Panel title="Data & audit trail" detail="Export a complete project snapshot for review and archival. Audit events preserve who changed what and the project version." action={<div className="actions"><button onClick={exportProject}><Download size={15}/>Export JSON</button>{!demo&&<button onClick={newProject}><Plus size={15}/>New project</button>}</div>}><div className="tablewrap"><table><thead><tr><th>Version</th><th>Action</th><th>Actor</th><th>Saved at</th></tr></thead><tbody>{events.map(e=><tr key={e.version}><td>v{e.version}</td><td>{e.command.type}</td><td><code>{e.actor_id.slice(0,12)}…</code></td><td>{new Date(e.created_at).toLocaleString('en-GB',{timeZone:'Asia/Kolkata'})} IST</td></tr>)}</tbody></table></div>{!events.length&&<p className="pad muted small">{demo?'The demo has no database audit history.':'Refresh the project to load the latest audit events.'}</p>}</Panel></>}
 <footer className="workspacefooter"><span>Lean Classroom · Learn from every week.</span><span>{demo?'Sample project':`Project v${version}`} · India time (IST)</span></footer>
 </main></div></div>}
 {dialog&&<div className="modaloverlay" onClick={e=>{if(e.target===e.currentTarget&&!busy)setDialog(null);}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="modalhead"><div><div className="eyebrow">LEAN CLASSROOM</div><h2 id="dialog-title">{dialog.title}</h2></div><button aria-label="Close dialog" disabled={busy} onClick={()=>setDialog(null)}><X size={20}/></button></div>{dialog.subtitle&&<p className="modalsubtitle">{dialog.subtitle}</p>}<form onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);if(await dialog.action(data))setDialog(null);}}><div className="modalfields">{dialog.fields.map(f=><label key={f.name}>{f.label}{f.options?<select name={f.name} required={f.required} multiple={f.multiple} defaultValue={f.multiple?(f.value as string[]??[]):f.value}>{!f.multiple&&!f.value&&f.required&&<option value="">Choose…</option>}{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:f.type==='textarea'?<textarea name={f.name} required={f.required} defaultValue={f.value} rows={f.name==='csv'?9:3} maxLength={f.name==='csv'?500000:1000}/>:<input name={f.name} type={f.type??'text'} defaultValue={f.value} required={f.required} min={f.min} max={f.max} maxLength={200} step={f.type==='number'?'0.001':undefined}/>} {f.hint&&<small>{f.hint}</small>}{f.name==='csv'&&<input aria-label="Load schedule CSV" type="file" accept=".csv,text/csv" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;const form=e.target.form!;const area=form.elements.namedItem('csv') as HTMLTextAreaElement;area.value=await file.text();}}/>}</label>)}</div><div className="modalfooter"><button type="button" disabled={busy} onClick={()=>setDialog(null)}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':dialog.submit}<ArrowRight size={15}/></button></div></form></section></div>}
 {authMode&&<div className="modaloverlay"><section className="modal authmodal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><div className="modalhead"><Brand/><button aria-label="Close sign-in" onClick={()=>setAuthMode('')}><X size={20}/></button></div><h2 id="auth-title">{authMode==='register'?'A better week starts here.':authMode==='verify'?'Verify your email.':authMode.startsWith('reset')?'Reset your password.':'Welcome to the big room.'}</h2><p className="modalsubtitle">{authMode==='register'?'Create your private planning workspace.':'Sign in to keep your team’s work connected.'}</p><form onSubmit={submitAuth} key={authMode}><div className="modalfields">{authMode==='register'&&<label>Your name<input name="name" autoComplete="name" required maxLength={100}/></label>}<label>Email address<input name="email" type="email" autoComplete="email" defaultValue={authMode==='verify'?user?.email:authMode==='reset-confirm'?authEmail:undefined} maxLength={254} readOnly={authMode==='verify'} required/></label>{['reset-confirm','verify'].includes(authMode)&&<label>Email code<input name="otp" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" required/></label>}{!['reset','verify'].includes(authMode)&&<label>Password<input name="password" type="password" minLength={authMode==='login'?1:12} maxLength={128} autoComplete={authMode==='login'?'current-password':'new-password'} required/>{authMode!=='login'&&<small>Use 12–128 characters. A longer passphrase works well.</small>}</label>}</div><button className="primary authsubmit" disabled={authPending}>{authPending?'Please wait…':authMode==='register'?'Create account':authMode==='reset'?'Send reset code':authMode==='reset-confirm'?'Reset password':authMode==='verify'?'Verify email':'Sign in'}<ArrowRight size={16}/></button></form><div className="authlinks">{authMode!=='verify'&&<button onClick={()=>setAuthMode(authMode==='register'?'login':'register')}>{authMode==='register'?'Already have an account? Sign in':'New here? Create an account'}</button>}{authMode==='login'&&<button onClick={()=>setAuthMode('reset')}>Forgot password?</button>}</div></section></div>}
 {toast&&<div className={`toast ${toast.error?'error':''}`} role={toast.error?'alert':'status'}>{toast.error?<AlertTriangle size={18}/>:<CheckCircle2 size={18}/>}<span>{toast.text}</span><button aria-label="Dismiss notification" onClick={()=>setToast(null)}><X size={15}/></button></div>}
 </>;
}

function Overview({s,current,week,navigate}:{s:State;current?:Week;week:string;navigate:(v:string)=>void}){
 const closed=s.weeks.filter(w=>w.status==='closed'),tot=closed.reduce((n,w)=>n+metrics(s,w).total,0),done=closed.reduce((n,w)=>n+metrics(s,w).done,0),ppc=pct(done,tot),open=s.constraints.filter(c=>!c.resolvedOn),readyTasks=s.tasks.filter(t=>ready(s,t)),completed=s.tasks.filter(t=>remaining(s,t)===0),m=current?metrics(s,current):null;
 return <><div className="overviewbanner"><div><span className="eyebrow">MAKE EVERY HANDOFF COUNT</span><h2>{s.name}</h2><p>{s.location||'Your project workspace'} <span>·</span> {s.client||'Lean project delivery'}</p></div><div className="bannerweek"><span>PLANNING WEEK</span><strong>{dateRange(week)}</strong><Badge tone="light">{current?.status??'Plan not started'}</Badge></div></div><div className="stats"><Stat label="Plan reliability" value={ppc===null?'—':ppc+'%'} detail={tot?`${done} of ${tot} closed-week promises met`:'No closed-week promises yet'} icon={<ChartNoAxesCombined size={18}/>}/><Stat label="Ready to work" value={readyTasks.length} detail={`${s.tasks.filter(t=>t.pull).length} activities in Phase Plan`} icon={<CheckCircle2 size={18}/>}/><Stat label="Open constraints" value={open.length} detail={<span className={open.some(c=>c.due<today())?'warningtext':''}>{open.filter(c=>c.due<today()).length} overdue removal dates</span>} icon={<ShieldCheck size={18}/>}/><Stat label="Scope complete" value={`${completed.length} / ${s.tasks.length}`} detail="Activities · measured against total scope" icon={<Layers size={18}/>}/></div>
 <div className="overviewgrid"><Panel title="This week’s promises" detail={dateRange(week)} action={<button className="textbutton" onClick={()=>navigate('weekly')}>Open work plan <ArrowUpRight size={16}/></button>}><div className="promiseoverview"><div className="ring" style={{background:`conic-gradient(var(--accent) ${(m?.ppc??0)*3.6}deg, var(--border) 0deg)`}}><div><strong>{m?.ppc===null||!m?'—':m.ppc+'%'}</strong><span>{current?.status==='closed'?'PPC FINAL':'PPC PREVIEW'}</span></div></div><div><h3>{m?.done??0} promises met</h3><p>of {m?.total??0} planned for this week</p><small>100% complete, by the promised date.</small></div></div><div className="promiselist">{current?.commitments.slice(0,4).map(c=>{const t=findTask(s,c.taskId),actual=commitmentActual(s,c);return <div className="promiserow" key={c.id}><span className="trade-dot"/><div><strong>{t.name}</strong><small>{c.owner}</small></div><span>{fmt(actual)} / {fmt(c.quantity)} <small>{t.unit}</small></span><Badge tone={commitmentActual(s,c,c.due)>=c.quantity?'teal':'neutral'}>{commitmentActual(s,c,c.due)>=c.quantity?'Met':'In progress'}</Badge></div>})}{!current?.commitments.length&&<Empty title="Make the week intentional" detail="Allocate ready work, then create and freeze your weekly promises." action={<button onClick={()=>navigate('weekly')}>Build this week’s plan</button>}/>}</div></Panel>
 <Panel title="Needs your attention" detail="Clear the path for upcoming work" action={<Badge tone="amber">{open.length} open</Badge>}>{open.slice(0,4).map(c=><div className="attentionrow" key={c.id}><span className="attentionicon"><AlertTriangle size={16}/></span><div><strong>{c.description}</strong><small>{c.owner} · {findTask(s,c.taskId).area}</small><span className="due">Required {df(c.due)}</span></div></div>)}{!open.length&&<div className="allclear"><CheckCircle2 size={30}/><h3>A clear path ahead</h3><p>No open constraints recorded. Keep checking readiness with the team.</p></div>}<button className="panelbottom" onClick={()=>navigate('constraints')}>View constraint log <ArrowRight size={15}/></button></Panel></div>
 <Panel title="The planning conversation" detail="Review the schedule, make work ready and follow the weekly commitments.">
  <div className="conversation">{[
   ['SHOULD','Phase Plan','phase',s.tasks.length+' activities'],
   ['CAN','Make work ready','lookahead',readyTasks.length+' ready'],
   ['WILL','Weekly promises','weekly',(current?.commitments.length??0)+' promises'],
   ['DID','Daily check-in','daily',s.entries.filter(e=>current?.commitments.some(c=>c.id===e.commitmentId)).length+' entries'],
   ['LEARN','Trends & metrics','analytics',closed.length+' closed weeks'],
  ].map(([stage,label,section,value],i)=><button onClick={()=>navigate(section)} key={stage}><span className="stepnum">0{i+1}</span><strong>{stage}</strong><p>{label}</p><small>{value}</small><ArrowUpRight size={14}/></button>)}</div>
 </Panel></>;

}
function CommitmentTable({state,week,action}:{state:State;week?:Week;action:(c:Week['commitments'][number])=>ReactNode}){return <Panel title="Weekly commitment register" detail="One promise per activity per week. Completion is counted as a binary outcome.">{week?.commitments.length?<div className="tablewrap"><table><thead><tr><th>Activity</th><th>Last planner</th><th>Promised</th><th>Actual by due date</th><th>Due</th><th>Status</th><th/></tr></thead><tbody>{week.commitments.map(c=>{const t=findTask(state,c.taskId),a=commitmentActual(state,c,c.due);return <tr key={c.id}><td><strong>{t.name}</strong><small>{t.trade} · {t.area}</small></td><td>{c.owner}</td><td>{fmt(c.quantity)} {t.unit}</td><td>{fmt(a)} {t.unit}</td><td>{df(c.due)}</td><td><Badge tone={a>=c.quantity?'teal':c.due<today()?'amber':'neutral'}>{week.status==='draft'&&!ready(state,t,c.due)?'Blocked':a>=c.quantity?'Met':c.due<today()?'Missed':'Pending'}</Badge></td><td>{action(c)}</td></tr>})}</tbody></table></div>:<Empty title="No promises yet" detail="Select an eligible activity from the ready work above."/>}</Panel>}
function Lookahead({state,week,canEdit,addConstraint,openPhase,openWeekly}:{
 state:State;week:string;canEdit:boolean;addConstraint:(task:Task,week:string)=>void;openPhase:()=>void;openWeekly:()=>void;
}){
 const weeks=Array.from({length:6},(_,i)=>{
  const key=addDays(week,i*7);
  const activities=weekAllocations(state,key).filter(a=>a.quantity>0)
   .map(a=>{const task=findTask(state,a.taskId),issues=blockers(state,task,addDays(key,6)),left=remaining(state,task);return {allocation:a,task,issues,left,status:left===0?'Complete':issues.length?'Blocked':'Ready'};})
   .sort((a,b)=>a.task.start.localeCompare(b.task.start)||a.task.id.localeCompare(b.task.id));
  return {key,activities};
 }).filter(w=>w.activities.length>0);
 return <Panel className="lookaheadweeks" title="Six-week lookahead" detail="Each week separates work needing constraint clearance from ready activities." action={<button onClick={openWeekly}>Weekly work plan <ArrowRight size={15}/></button>}>
  <details className="quantityexplanation"><summary>How are weekly quantities calculated?</summary><p>The activity’s total quantity is spread evenly across every calendar day from early start through early finish, including both dates. A week receives the days that overlap its seven-day period. For example, 100 units over 10 days gives 70 units in a full seven-day week. Rounding uses cumulative thousandths so the weekly splits add up exactly.</p><p>After closing a week, the next week’s quantity is the scheduled cumulative target by its end minus actual work recorded through the previous week. Any unfinished quantity is labelled carryover. Float and late dates are retained for schedule review; they do not change this distribution. Resolve constraints before promising the full forecast quantity.</p></details>
  {weeks.length?<div className="weekstack">{weeks.map(({key,activities})=><section className="forecastweek" key={key} aria-labelledby={'forecast-week-'+key}>
   <header className="forecastweekhead"><div><span className="eyebrow">{key===week?'CURRENT EXERCISE WEEK':'UPCOMING WEEK'}</span><h2 id={'forecast-week-'+key}>Week {weekNumber(state,key)} <span>{dateRange(key)}</span></h2></div><span className="weekactivitycount">{activities.length} {activities.length===1?'activity':'activities'}</span></header>
   <div className={'readinesscolumns '+(activities.every(a=>a.status!=='Blocked')?'all-ready':activities.every(a=>a.status==='Blocked')?'all-blocked':'')}>
    {(['Blocked','Ready'] as const).map(lane=>{
     const items=activities.filter(a=>lane==='Blocked'?a.status==='Blocked':a.status!=='Blocked');
     const label=lane==='Blocked'?'Needs clearing':items.some(a=>a.status==='Complete')?'Ready / complete':'Ready activities';
     return <section className={'readinesslane '+(lane==='Blocked'?'blockedlane':'readylane')} key={lane} aria-label={label+' · Week '+weekNumber(state,key)}>
      <header className="readinesslanehead"><h3>{lane==='Blocked'?<ShieldCheck size={17}/>:<CheckCircle2 size={17}/>} {label}</h3><span>{items.length}</span></header>
      {items.length?<div className="forecastcards">{items.map(({task,allocation,issues,left,status})=><article className={'forecastcard '+status.toLowerCase()} key={task.id} aria-label={task.name+' · Week '+weekNumber(state,key)}>
       <div className="forecastcardhead"><div><h3>{task.name}</h3><p className="forecastclassification">{task.trade} · {task.area}</p></div><Badge tone={status==='Ready'?'teal':status==='Blocked'?'amber':'neutral'}>{status}</Badge></div>
       <dl className="forecastfacts"><div><dt>Planned quantity</dt><dd className="forecastquantity">{fmt(allocation.quantity)} <span>{task.unit}</span></dd></div><div><dt>Remaining scope</dt><dd>{fmt(left)} <span>{task.unit}</span></dd></div><div><dt>Target finish</dt><dd>{df(forecastDue(task,key))}</dd></div>{task.schedule?.float!==undefined&&<div><dt>Schedule float</dt><dd>{fmt(task.schedule.float)} <span>days</span></dd></div>}</dl>
       {!!allocation.carry&&<p className="forecastcarry">Includes {fmt(allocation.carry)} {task.unit} carryover</p>}
       {!!issues.length&&<div className="forecastconstraints"><ul aria-label="Open constraints and handoffs">{issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></div>}
       <footer className="forecastcardfoot"><span className="forecastowner"><Users size={13}/><span>{task.owner}</span></span><button className="textbutton forecastadd" disabled={!canEdit||state.weeks.some(w=>w.key===key&&w.status==='closed')} aria-label={'Constraint for '+task.name+' week '+weekNumber(state,key)} onClick={()=>addConstraint(task,key)}><Plus size={14}/>Add constraint</button></footer>
      </article>)}</div>:<p className="laneempty">{lane==='Blocked'?'No blocked activities.':'No ready activities yet.'}</p>}
     </section>;
    })}
   </div>
  </section>)}</div>:<Empty title={state.tasks.length?'No work scheduled in these six weeks':'Import a phase schedule to get started'} detail={state.tasks.length?'The window advances automatically after you close the current week.':'Planned activities and constraints will appear here after import.'} action={<button onClick={openPhase}>Open Phase Plan <ArrowRight size={15}/></button>}/>}
 </Panel>;
}

function WeeklyReady({state,week,canEdit,add,openLookahead}:{
 state:State;week:string;canEdit:boolean;add:(task:Task,quantity:number)=>void;openLookahead:()=>void;
}){
 const committed=new Set(state.weeks.find(w=>w.key===week)?.commitments.map(c=>c.taskId));
 const forecast=weekAllocations(state,week).filter(a=>!committed.has(a.taskId));
 const candidates=forecast.map(a=>{
  const task=findTask(state,a.taskId);
  return {task,quantity:a.quantity,due:forecastDue(task,week)};
 }).filter(({task,quantity,due})=>quantity>0&&quantity<=available(state,task)&&ready(state,task,due));
 const unavailable=forecast.length-candidates.length;
 return <Panel title="Ready work from Lookahead" detail={unavailable?unavailable+' forecast '+(unavailable===1?'activity is':'activities are')+' blocked or have no available quantity.':'Each promise uses the full forecast quantity. Confirm the due date and person responsible.'} action={<button onClick={openLookahead}>Review Lookahead</button>}>
  {candidates.length?<div className="tablewrap"><table>
   <thead><tr><th>Activity</th><th>Available to promise</th><th>Suggested due</th><th/></tr></thead>
   <tbody>{candidates.map(({task,quantity,due})=><tr key={task.id}>
    <td><strong>{task.name}</strong><small>{task.trade} · {task.area}</small></td>
    <td>{fmt(quantity)} {task.unit}</td><td>{df(due)}</td>
    <td><button disabled={!canEdit} aria-label={'Add promise for '+task.name} onClick={()=>add(task,quantity)}>Add promise</button></td>
   </tr>)}</tbody>
  </table></div>:<Empty title="No additional ready work" detail="Review forecast quantities, predecessor handoffs and constraints in Lookahead."/>}
 </Panel>;
}

type CloseoutReason={commitmentId:string;reason:string;reasonNote:string;learning:string};
function Closeout({state,week,weekKey,canEdit,busy,confirm}:{
 state:State;week?:Week;weekKey:string;canEdit:boolean;busy:boolean;confirm:(reasons:CloseoutReason[])=>void;
}){
 const active=week?.status==='active';
 const score=week?metrics(state,week).ppc:null;
 const misses=week?.commitments.filter(c=>commitmentActual(state,c,c.due)<c.quantity)??[];
 return <>
  <div className="cyclebanner">
   <div><Badge>{week?.status??'No plan'}</Badge><strong>{dateRange(weekKey)}</strong><p>A promise counts toward PPC when its full quantity is completed by the original due date.</p></div>
   <div className="ppcvalue">{score??'—'}<span>% PPC {week?.status==='closed'?'final':'preview'}</span></div>
  </div>
  {!week&&<Empty title="No weekly plan to close" detail="Choose a week with promises in Weekly work plan."/>}
  {week&&<form onSubmit={e=>{
   e.preventDefault();
   if(!active||!canEdit||busy)return;
   const data=new FormData(e.currentTarget);
   confirm(misses.map(c=>({commitmentId:c.id,reason:formText(data,'reason-'+c.id),reasonNote:formText(data,'note-'+c.id),learning:formText(data,'action-'+c.id)})));
  }}>
   {week.commitments.map(c=>{
    const task=findTask(state,c.taskId),byDue=commitmentActual(state,c,c.due),actual=commitmentActual(state,c),done=byDue>=c.quantity;
    return <section className="variancecard closeoutcard" key={c.id}>
     <div><Badge tone={done?'teal':'amber'}>{done?'Promise met':actual>=c.quantity?'Completed late':'Quantity short'}</Badge>
      <h3>{task.name}</h3><p>{task.area} · {c.owner} · Due {df(c.due)}</p>
      <div className="closeoutnumbers">
       <div><small>Promised</small><strong>{fmt(c.quantity)} {task.unit}</strong></div>
       <div><small>By due date</small><strong>{fmt(byDue)} {task.unit}</strong></div>
       <div><small>Week actual</small><strong>{fmt(actual)} {task.unit}</strong></div>
      </div>
     </div>
     {!done&&active&&canEdit&&<div className="closeoutfields">
      <label>Primary reason code<select name={'reason-'+c.id} required defaultValue={reasonCode(c.reason)??''}>
       <option value="">Select a reason code</option>
       {reasonCodes.map(([code,title,detail])=><option key={code} value={code}>{code} · {title}: {detail}</option>)}
      </select></label>
      <label>Reason details (required for RC-16)<input name={'note-'+c.id} defaultValue={c.reasonNote??''} maxLength={1000}/></label>
      <label>Improvement action and owner<textarea name={'action-'+c.id} defaultValue={c.learning} required maxLength={200} rows={2}/></label>
     </div>}
     {!done&&(!active||!canEdit)&&<div className="closeoutfields">
      <strong>{c.reason?reasonLabel(c.reason):'Reason pending'}</strong>
      {c.reasonNote&&<p>{c.reasonNote}</p>}{c.learning&&<p>{c.learning}</p>}
     </div>}
    </section>;
   })}
   {active&&<div className="closefooter"><p><Lock size={15}/> You can close a practice week as soon as you have recorded its results. Saving locks the week and updates trends.</p>
    <button className="primary" disabled={!canEdit||busy}><Lock size={15}/>Close week</button>
   </div>}
  </form>}
 </>;
}

function Analytics({s,week}:{s:State;week?:Week}){
 const closed=s.weeks.filter(w=>w.status==='closed').sort((a,b)=>a.key.localeCompare(b.key));
 const m=week?metrics(s,week):null;
 const counts=new Map<string,number>();
 for(const record of closed)for(const c of record.commitments){
  if(commitmentActual(s,c,c.due)>=c.quantity)continue;
  const code=reasonCode(c.reason)??otherReason;
  counts.set(code,(counts.get(code)??0)+1);
 }
 const ranked=[...counts].map(([code,count])=>({code,label:reasonLabel(code),count}))
  .sort((a,b)=>b.count-a.count||a.code.localeCompare(b.code));
 const reasonTotal=ranked.reduce((n,row)=>n+row.count,0);
 const series=closed.map(record=>({record,...metrics(s,record)}));
 const points=series.flatMap(row=>row.ppc===null?[]:[{week:row.record.key,label:df(row.record.key),ppc:row.ppc}]);
 const totals=unitTotals(s);
 return <>
  <div className="stats three">
   <Stat label={week?.status==='closed'?'Selected week PPC':'Selected week PPC preview'} value={m?.ppc==null?'—':m.ppc+'%'} detail={m?`${m.done} of ${m.total} promises met on time`:'Choose a week with promises'} icon={<ChartNoAxesCombined size={18}/>}/>
   <Stat label="Tasks anticipated" value={m?.ta==null?'—':m.ta+'%'} detail="Promises planned before their week began" icon={<CalendarRange size={18}/>}/>
   <Stat label="Tasks made ready" value={m?.tmr==null?'—':m.tmr+'%'} detail="Ready activities / forecast activities when the week started" icon={<ShieldCheck size={18}/>}/>
  </div>
  <Panel title="Weekly PPC trend" detail="Closed weeks only. The dashed line marks the 80% reference.">
   {points.length?<PpcTrend points={points}/>:<Empty title="No closed weeks yet" detail="Close a week to publish its PPC to the trend."/>}
  </Panel>
  <Panel title="Weekly PPC results" detail="Each result uses the original number of promises for that week.">
   {series.length?<div className="tablewrap"><table><thead><tr><th>Week beginning</th><th>Promises</th><th>Met on time</th><th>Missed</th><th>PPC</th></tr></thead>
    <tbody>{series.map(row=><tr key={row.record.key}><td>{row.record.key}</td><td>{row.total}</td><td>{row.done}</td><td>{row.total-row.done}</td><td>{row.ppc===null?'—':row.ppc+'%'}</td></tr>)}</tbody>
   </table></div>:<p className="pad muted">No closed weekly results.</p>}
  </Panel>
  <Panel title="Activity results for the selected week" detail={week?.status==='closed'?'Final results for '+dateRange(week.key):'Each promise receives 100% if met on time and 0% if missed.'}>
   {week?.commitments.length?<div className="tablewrap"><table><thead><tr><th>Activity</th><th>Due</th><th>Promised</th><th>Actual by due</th><th>Week actual</th><th>Result</th><th>Reason</th></tr></thead>
    <tbody>{week.commitments.map(c=>{
     const task=findTask(s,c.taskId),byDue=commitmentActual(s,c,c.due),met=byDue>=c.quantity;
     return <tr key={c.id}><td><strong>{task.name}</strong><small>{task.area}</small></td><td>{df(c.due)}</td>
      <td>{fmt(c.quantity)} {task.unit}</td><td>{fmt(byDue)} {task.unit}</td><td>{fmt(commitmentActual(s,c))} {task.unit}</td>
      <td><Badge tone={met?'teal':'amber'}>{met?'Met · 100%':week.status==='closed'?'Missed · 0%':'Pending'}</Badge></td>
      <td>{!met&&c.reason?reasonLabel(c.reason):'—'}</td></tr>;
    })}</tbody>
   </table></div>:<p className="pad muted">Choose a week with commitments to see its activity results.</p>}
  </Panel>
   <Panel title="Daily reasoning for the selected week" detail="Saved daily reasons support discussion of the weekly PPC result.">
   {week&&s.entries.some(e=>week.commitments.some(c=>c.id===e.commitmentId))?<div className="tablewrap"><table><thead><tr><th>Date</th><th>Activity</th><th>Daily quantity</th><th>Reason</th><th>Note</th></tr></thead><tbody>{s.entries.filter(e=>week.commitments.some(c=>c.id===e.commitmentId)).sort((a,b)=>a.date.localeCompare(b.date)||a.commitmentId.localeCompare(b.commitmentId)).map(e=>{const c=week.commitments.find(c=>c.id===e.commitmentId)!,t=findTask(s,c.taskId);return <tr key={e.commitmentId+e.date}><td>{df(e.date)}</td><td>{t.name}</td><td>{fmt(e.quantity)} {t.unit}</td><td>{e.reason==='ON_PLAN'?'Work as planned':e.reason?reasonLabel(e.reason):'Not recorded (earlier version)'}</td><td>{e.note||'—'}</td></tr>;})}</tbody></table></div>:<p className="pad muted">Daily entries will appear here when saved.</p>}
  </Panel>
   <Panel title="Reasons for missed promises" detail="One primary reason per missed promise in a closed week.">
    {ranked.length?<ReasonPie rows={ranked}/>:<p className="pad muted">No reasons recorded in closed weeks.</p>}
   </Panel>
  <Panel title="Cumulative quantities by unit">
   <div className="tablewrap"><table><thead><tr><th>Unit</th><th>Total scope</th><th>Cumulative actual</th><th>Remaining</th></tr></thead>
    <tbody>{Object.entries(totals.total).map(([unit,total])=><tr key={unit}><td>{unit}</td><td>{fmt(total)}</td>
     <td>{fmt(totals.actual[unit]??0)}</td><td>{fmt(sum([total,-(totals.actual[unit]??0)]))}</td></tr>)}</tbody>
   </table></div>
  </Panel>
  <Panel title="Improvement actions">
   {closed.flatMap(record=>record.commitments.filter(c=>c.learning&&commitmentActual(s,c,c.due)<c.quantity).map(c=><div className="learningrow" key={c.id}>
    <Badge tone="amber">{reasonLabel(c.reason)}</Badge><div><strong>{findTask(s,c.taskId).name}</strong><p>{c.learning}</p><small>Week of {df(record.key)} · {c.owner}</small></div>
   </div>))}
   {!ranked.length&&<p className="pad muted">Actions appear here after closeout.</p>}
  </Panel>
   <Panel title="Top 3 reason codes" detail="Ranked by frequency across closed weeks.">
    {ranked.length?<div className="tablewrap"><table><thead><tr><th>Reason</th><th>Misses</th><th>Share</th></tr></thead>
     <tbody>{ranked.slice(0,3).map(row=><tr key={row.code}><td>{row.label}</td><td>{row.count}</td><td>{pct(row.count,reasonTotal)}%</td></tr>)}</tbody>
    </table></div>:<p className="pad muted">No missed promises to rank yet.</p>}
   </Panel>
 </>;
}
function Academy(){const cards=[['01','Phase Plan','SHOULD','Import activity dates, scope, float and predecessors. Confirm what each trade needs before it can begin. The schedule feeds the six-week lookahead.'],['02','Make-ready planning','CAN','Look ahead six weeks. Check information, materials, labour, equipment, approvals, space and safety. Assign an owner and removal date to every constraint. Ready work has no open constraints and its predecessor handoffs are complete.'],['03','Weekly work planning','WILL','The last planner makes a specific, measurable promise: activity, location, quantity, unit, responsible person and due date. Select ready work from the forecast, make promises, then start the week to freeze the plan.'],['04','Daily commitment management','DID','For learning, you can enter quantities for all seven dates of an active week at any time, including future days. Select a reason and save all entries before advancing. Record only that day’s quantity. Never enter the all-time cumulative value as a daily value. Correct a date by updating that date. The cumulative ledger remains the single source for scope and weekly totals.'],['05','Learn and improve','LEARN','PPC = promises completed in full by their due date ÷ promises made × 100. A 99% complete promise is missed. Work completed late still contributes to scope, but not to on-time PPC. Give each miss a reason and a practical action.'],['06','Carry forward scope','FLOW','When a week closes, unfinished work remains in the activity’s remaining scope. The following week’s forecast includes unfinished scheduled scope after closeout. Review its readiness before making a new promise.']];return <><div className="guidegrid">{cards.map(([n,title,stage,body])=><article className="guidecard" key={n}><span className="guidenum">{n}</span><Badge tone="teal">{stage}</Badge><h2>{title}</h2><p>{body}</p></article>)}</div><Panel title="Facilitator’s weekly conversation" detail="Keep the conversation collaborative. Explain the system, not the person."><ol className="guidelist"><li>Review last week’s original promises and on-time completions.</li><li>Identify recurring reasons for variance and assign improvement actions.</li><li>Review the phase schedule and six-week lookahead together.</li><li>Ask constraint owners what will be removed, and by when.</li><li>Let each last planner promise only the work they can reliably deliver.</li><li>Read back the quantities, dates and owners, then freeze the weekly plan.</li></ol></Panel><div className="callout"><BookOpen size={18}/><div><strong>Method reference</strong><p>Last Planner System® is a registered trademark of the Lean Construction Institute. This independent application uses its should–can–will–did–learn planning cycle. <a href="https://leanconstruction.org/lean-topics/last-planner-system/" target="_blank" rel="noreferrer">Read LCI’s guide ↗</a></p><p>Conference review: confirm your professor’s required TA/TMR definitions, calendars and closeout convention before research use. This version uses seven-day project weeks, calendar-day FS dependencies, and immutable closed weeks.</p></div></div></>}
