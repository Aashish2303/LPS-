import {authSchemas,authFailure,emailSendingPath,type AuthPath} from './auth-policy';
import {clientAddress,enforceRate,type RateRule} from './rate-limit';
import {privateHeaders,readJSON,sameOrigin} from './request-security';
import {DomainError} from './domain';
type Context={params:Promise<{path:string[]}>};
type Upstream=(req:Request,ctx:Context)=>Promise<Response>;
type Limit=(rules:RateRule[])=>Promise<Response|null>;
export function createAuthGateway(upstream:Upstream,limit:Limit=enforceRate){return async(req:Request,ctx:Context)=>{
 let path='';
 try{
  path=(await ctx.params).path.join('/');
  if(req.method==='GET'){
   if(path!=='get-session')return Response.json(authFailure(404),{status:404,headers:privateHeaders});
   const blocked=await limit([{scope:'session-ip',subject:clientAddress(req),limit:120,seconds:60}]);if(blocked)return blocked;
   const response=await upstream(req,ctx);if(!response.ok)return Response.json(authFailure(response.status),{status:response.status,headers:privateHeaders});response.headers.set('Cache-Control','no-store, max-age=0');return response;
  }
  if(req.method!=='POST'||!Object.hasOwn(authSchemas,path))return Response.json(authFailure(404),{status:404,headers:privateHeaders});
  sameOrigin(req);
  const ip=clientAddress(req),login=path==='sign-in/email',signup=path==='sign-up/email',emailSend=path===emailSendingPath;
  const ipLimit=await limit([{scope:login?'login-ip':signup?'signup-ip':emailSend?'email-send-ip':'auth-write-ip',subject:ip,limit:login?30:signup?5:emailSend?10:60,seconds:login?900:signup||emailSend?3600:900}]);if(ipLimit)return ipLimit;
  const raw=await readJSON(req,8192),parsed=authSchemas[path as AuthPath].safeParse(raw);
  if(!parsed.success)return Response.json(authFailure(400),{status:400,headers:privateHeaders});
  const data=parsed.data;
  if('email' in data){const pair=await limit([
   {scope:login?'login-pair':signup?'signup-pair':emailSend?'email-send-pair':'otp-pair',subject:JSON.stringify([ip,data.email]),limit:login?5:signup||emailSend?3:5,seconds:900},
   {scope:login?'login-account':signup?'signup-account':emailSend?'email-send-account':'otp-account',subject:data.email,limit:login?20:signup||emailSend?5:15,seconds:3600},
  ]);if(pair)return pair;}
  const headers=new Headers({'content-type':'application/json','origin':new URL(req.url).origin});
  for(const key of ['cookie','user-agent','accept']){const value=req.headers.get(key);if(value)headers.set(key,value);}
  const response=await upstream(new Request(req.url,{method:'POST',headers,body:JSON.stringify(data)}),ctx);
  // Recovery requests reveal no information about whether an address exists.
  if(emailSend&&response.status<500&&response.status!==429)return Response.json({success:true},{headers:privateHeaders});
  if(!response.ok)return Response.json(authFailure(response.status),{status:response.status,headers:{...privateHeaders,...(response.status===429?{'Retry-After':response.headers.get('Retry-After')??'60'}:{})}});
  response.headers.set('Cache-Control','no-store, max-age=0');return response;
 }catch(error){
  // No raw provider error, request fields, or credentials reach logs or responses.
  const status=error instanceof DomainError?error.status:503;
  return Response.json(authFailure(status),{status,headers:privateHeaders});
 }
};}
