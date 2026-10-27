import { auth } from './auth-server';
import { DomainError } from './domain';
import { ZodError } from 'zod';
export async function identity(){const {data:session}=await auth.getSession();if(!session?.user)throw new DomainError('Sign in to continue',401);return {id:session.user.id,email:session.user.email.toLowerCase(),verified:session.user.emailVerified};}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new DomainError('Cross-origin request denied',403);}
export function failure(e:unknown){if(e instanceof DomainError)return Response.json({error:e.message},{status:e.status});if(e instanceof ZodError)return Response.json({error:e.issues.map(i=>i.message).join('; ')},{status:422});console.error('LPS request failed',e instanceof Error?e.message:'Unknown error');return Response.json({error:'The request could not be saved. Please retry.'},{status:500});}
