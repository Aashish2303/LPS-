import { DomainError } from './domain';
export const privateHeaders={'Cache-Control':'no-store, max-age=0','Pragma':'no-cache'};
export function sameOrigin(req:Request){
 const origin=req.headers.get('origin');
 if(!origin||origin!==new URL(req.url).origin||req.headers.get('sec-fetch-site')==='cross-site')throw new DomainError('Request not allowed.',403);
}
export async function readJSON(req:Request,maxBytes=524288):Promise<unknown>{
 if(req.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new DomainError('Use a JSON request.',415);
 if(req.headers.has('content-encoding')&&req.headers.get('content-encoding')!=='identity')throw new DomainError('Request not allowed.',415);
 const declared=req.headers.get('content-length');
 if(declared&&(!/^\d+$/.test(declared)||Number(declared)>maxBytes))throw new DomainError('Request is too large.',413);
 if(!req.body)throw new DomainError('Check the request fields.',400);
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new DomainError('Request is too large.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));}catch{throw new DomainError('Check the request fields.',400);}
}
export function publicFailure(error:unknown){
 if(error instanceof DomainError){const messages:Record<number,string>={400:'Check the request fields.',401:'Sign in to continue.',403:'Request not allowed.',404:'Project unavailable.',413:'Request is too large.',415:'Use a JSON request.'};return Response.json({error:messages[error.status]??error.message},{status:error.status,headers:privateHeaders});}
 if(error&&typeof error==='object'&&'name' in error&&error.name==='ZodError')return Response.json({error:'Check the request fields.'},{status:422,headers:privateHeaders});
 // Never log request bodies, cookies, tokens, passwords, or database error text.
 console.error('LPS_REQUEST_FAILED',{incident:crypto.randomUUID()});
 return Response.json({error:'Unable to complete the request. Please try again.'},{status:500,headers:privateHeaders});
}
