export const views=['overview','phase','lookahead','constraints','weekly','daily','closeout','analytics','academy','settings'] as const;
export type View=typeof views[number];
export const authPaths={login:'/login',register:'/signup',reset:'/forgot-password','reset-confirm':'/reset-password',verify:'/verify-email'} as const;
export type AuthMode=keyof typeof authPaths;
export type AppRoute={kind:'home'}|{kind:'auth';mode:AuthMode}|{kind:'demo';view:View}|{kind:'project';projectId:string;view:View};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseRoute(path:string):AppRoute|null{
 if(path==='/')return {kind:'home'};
 for(const [mode,pathname] of Object.entries(authPaths))if(path===pathname)return {kind:'auth',mode:mode as AuthMode};
 const parts=path.split('/').filter(Boolean);
 const section=parts.at(-1);
 if(section==='master')parts[parts.length-1]='phase';
 if(section==='pull')parts[parts.length-1]='lookahead';
 if(parts[0]==='demo'&&parts.length===2&&views.includes(parts[1] as View))return {kind:'demo',view:parts[1] as View};
 if(parts[0]==='projects'&&parts.length===3&&uuid.test(parts[1])&&views.includes(parts[2] as View))return {kind:'project',projectId:parts[1],view:parts[2] as View};
 return null;
}
export function projectPath(projectId:string,view:string='overview'){if(!uuid.test(projectId)||!views.includes(view as View))throw Error('Invalid project route');return `/projects/${projectId}/${view}`;}
export function safeReturnPath(value:string|null){
 if(!value||value.length>500||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x20]/.test(value))return '/';
 try{const url=new URL(value,'https://lps.invalid');const route=parseRoute(url.pathname);if(url.origin!=='https://lps.invalid'||!route||route.kind!=='project')return '/';const week=url.searchParams.get('week');return url.pathname+(validWeek(week)?'?week='+week:'');}catch{return '/';}
}
export function validWeek(value:string|null):value is string{if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value;}

// Only a view change in the already-loaded workspace may bypass a server trip.
// Deep links and switching projects continue through the normal router and API guards.
export function sameWorkspaceRoute(from:string,to:string,loadedProjectId:string){
 const source=parseRoute(from),target=parseRoute(to);
 if(source?.kind==='demo'&&target?.kind==='demo')return true;
 return source?.kind==='project'&&target?.kind==='project'&&source.projectId===loadedProjectId&&target.projectId===loadedProjectId;
}
