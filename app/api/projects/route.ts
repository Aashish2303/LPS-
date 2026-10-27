import { db } from '@/lib/db';
import { identity,failure,sameOrigin,readJSON,privateHeaders } from '@/lib/api';
import { emptyState,DomainError } from '@/lib/domain';
import {createProjectSchema} from '@/lib/api-schemas';
import {enforceRate} from '@/lib/rate-limit';
export const dynamic='force-dynamic';
export async function GET(){try{const u=await identity();const limited=await enforceRate([{scope:'project-read',subject:u.id,limit:180,seconds:60}]);if(limited)return limited;const r=await db().query(`select p.id,p.state->>'name' as name,p.version,case when p.owner_id=$1 then 'owner' else m.role end as role from lps_projects p left join lps_members m on m.project_id=p.id and m.email=$2 and $3::boolean where p.owner_id=$1 or m.email=$2 order by p.updated_at desc`,[u.id,u.email,u.verified]);return Response.json(r.rows,{headers:privateHeaders});}catch(e){return failure(e);}}
export async function POST(req:Request){let client;try{
 sameOrigin(req);const u=await identity();const limited=await enforceRate([{scope:'project-create',subject:u.id,limit:10,seconds:3600}]);if(limited)return limited;
 const data=createProjectSchema.parse(await readJSON(req,4096));
 client=await db().connect();await client.query('begin');
 // Serialize creation for this owner so simultaneous requests cannot exceed the cap.
 await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[u.id]);
 const count=await client.query('select count(*) from lps_projects where owner_id=$1',[u.id]);if(Number(count.rows[0].count)>=20)throw new DomainError('Maximum 20 projects per account');
 const id=crypto.randomUUID(),state=emptyState(data.name);await client.query('insert into lps_projects(id,owner_id,state) values($1,$2,$3)',[id,u.id,JSON.stringify(state)]);await client.query('commit');return Response.json({id,state,version:1,role:'owner'},{headers:privateHeaders});
 }catch(e){if(client)await client.query('rollback').catch(()=>{});return failure(e);}finally{client?.release();}}
