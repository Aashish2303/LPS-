import {notFound,redirect} from 'next/navigation';
import {auth} from '@/lib/auth-server';
import {parseRoute,safeReturnPath,validWeek} from '@/lib/routes';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{route?:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {route:segments=[]}=await params,path='/'+segments.join('/'),route=parseRoute(path),query=await searchParams;
 if(!route)notFound();
 if(route.kind==='home'&&query.demo==='1')redirect('/demo/overview');
 if(route.kind==='project'||route.kind==='auth'){
  const {data:session}=await auth.getSession();
  if(route.kind==='project'&&!session?.user){const week=typeof query.week==='string'&&validWeek(query.week)?'?week='+query.week:'';redirect('/login?next='+encodeURIComponent(path+week));}
  if(route.kind==='auth'&&route.mode==='verify'&&!session?.user)redirect('/login');
  if(route.kind==='auth'&&session?.user&&['login','register'].includes(route.mode))redirect(safeReturnPath(typeof query.next==='string'?query.next:null));
 }
 return null;
}
