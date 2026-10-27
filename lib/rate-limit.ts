import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {db} from './db';
import {privateHeaders} from './request-security';
export type RateRule={scope:string;subject:string;limit:number;seconds:number};
export function clientAddress(req:Request,vercel=process.env.VERCEL==='1'){
 // Only trust a header overwritten by the deployment platform. Local callers share a bucket.
 const raw=vercel?req.headers.get('x-vercel-forwarded-for')?.trim():undefined;
 if(!raw||!isIP(raw))return 'unknown';
 if(isIP(raw)===4)return raw;
 const normalized=new URL('http://['+raw+']/').hostname.slice(1,-1);
 if(normalized.startsWith('::ffff:')){const parts=normalized.slice(7).split(':');if(parts.length===2){const n=parseInt(parts[0],16)*65536+parseInt(parts[1],16);return [n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.');}}
 // Group IPv6 clients by /64 so address rotation within a subnet shares a limit.
 const [left,right='']=normalized.split('::'),l=left?left.split(':'):[],r=right?right.split(':'):[];
 const all=normalized.includes('::')?[...l,...Array(8-l.length-r.length).fill('0'),...r]:l;
 return all.slice(0,4).map(p=>parseInt(p,16).toString(16)).join(':')+'::/64';
}
export function rateKey(rule:RateRule,secret=process.env.NEON_AUTH_COOKIE_SECRET){if(!secret||secret.length<32)throw Error('Rate limit unavailable');return createHmac('sha256',secret).update(JSON.stringify(['lps-rate-v1',rule.scope,rule.seconds,rule.subject])).digest('hex');}
export const consumeSQL=`with input as (select * from jsonb_to_recordset($1::jsonb) as x(key text, seconds integer, max_hits integer)),
 hit as (insert into public.lps_rate_limits(key,hits,reset_at)
 select key,1,now()+make_interval(secs=>seconds) from input order by key
 on conflict(key) do update set
 hits=case when lps_rate_limits.reset_at<=now() then 1 else least(lps_rate_limits.hits+1,1000000) end,
 reset_at=case when lps_rate_limits.reset_at<=now() then excluded.reset_at else lps_rate_limits.reset_at end
 returning key,hits,reset_at)
 select hit.hits,hit.hits<=input.max_hits as allowed,greatest(1,ceil(extract(epoch from hit.reset_at-now())))::integer as retry_after from hit join input using(key)`;
export async function enforceRate(rules:RateRule[]):Promise<Response|null>{
 try{const input=rules.map(rule=>({key:rateKey(rule),seconds:rule.seconds,max_hits:rule.limit}));const r=await db().query(consumeSQL,[JSON.stringify(input)]);const blocked=r.rows.filter(x=>!x.allowed);if(blocked.length)return Response.json({code:'TOO_MANY_REQUESTS',message:'Too many attempts. Please wait and try again.',error:'Too many attempts. Please wait and try again.'},{status:429,headers:{...privateHeaders,'Retry-After':String(Math.max(...blocked.map(x=>x.retry_after)))}});
 // Bounded retention cleanup when a new window starts. No identity or credential data is stored.
 if(r.rows.some(x=>x.hits===1))await db().query("delete from public.lps_rate_limits where key in (select key from public.lps_rate_limits where reset_at<now()-interval '1 day' order by reset_at limit 100)");
 return null;}
 catch{console.error('LPS_RATE_LIMIT_UNAVAILABLE',{incident:crypto.randomUUID()});return Response.json({code:'AUTH_UNAVAILABLE',message:'Service temporarily unavailable. Please try again.',error:'Service temporarily unavailable. Please try again.'},{status:503,headers:{...privateHeaders,'Retry-After':'60'}});}
}
