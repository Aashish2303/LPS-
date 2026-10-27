import { db } from '@/lib/db';
import { identity,failure,sameOrigin,readJSON,privateHeaders } from '@/lib/api';
import { applyCommand,DomainError } from '@/lib/domain';
import { z } from 'zod';
import {projectRequestSchema} from '@/lib/api-schemas';
import {enforceRate} from '@/lib/rate-limit';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export async function GET(_:Request,ctx:Context){try{const u=await identity(),{id}=await ctx.params;z.string().uuid().parse(id);const limited=await enforceRate([{scope:'project-read',subject:u.id,limit:180,seconds:60}]);if(limited)return limited;const r=await db().query(`select p.*,case when p.owner_id=$2 then 'owner' else m.role end as role from lps_projects p left join lps_members m on m.project_id=p.id and m.email=$3 and $4::boolean where p.id=$1 and (p.owner_id=$2 or m.email=$3)`,[id,u.id,u.email,u.verified]);if(!r.rowCount)throw new DomainError('Project not found or access denied',404);const p=r.rows[0];const events=await db().query('select actor_id,command,version,created_at from lps_events where project_id=$1 order by version desc limit 50',[id]);const members=p.role==='owner'?(await db().query('select email,role from lps_members where project_id=$1',[id])).rows:[];return Response.json({id,state:p.state,version:p.version,role:p.role,events:events.rows,members},{headers:privateHeaders});}catch(e){return failure(e);}}
export async function POST(req:Request,ctx:Context){let client;try{
 sameOrigin(req);const u=await identity(),{id}=await ctx.params;z.string().uuid().parse(id);const limited=await enforceRate([{scope:'project-write',subject:u.id,limit:120,seconds:60}]);if(limited)return limited;const request=projectRequestSchema.parse(await readJSON(req));
 client=await db().connect();await client.query('begin');
 const r=await client.query(`select p.*,case when p.owner_id=$2 then 'owner' else m.role end as role from lps_projects p left join lps_members m on m.project_id=p.id and m.email=$3 and $4::boolean where p.id=$1 and (p.owner_id=$2 or m.email=$3) for update of p`,[id,u.id,u.email,u.verified]);
 if(!r.rowCount)throw new DomainError('Project not found or access denied',404);const p=r.rows[0];if(p.role==='viewer')throw new DomainError('Viewers cannot change this project',403);
 const duplicate=await client.query('select id from lps_events where id=$1 and project_id=$2',[request.requestId,id]);if(duplicate.rowCount){await client.query('commit');return Response.json({state:p.state,version:p.version},{headers:privateHeaders});}
 if(p.version!==request.version)throw new DomainError('Another planner saved changes. Refresh the project before retrying.',409);
 const command=request.command;let state=p.state;
 if(command?.type==='member'){
  if(p.role!=='owner')throw new DomainError('Only the project owner can manage access',403);
  const m=command;
  await client.query('insert into lps_members(project_id,email,role) values($1,$2,$3) on conflict(project_id,email) do update set role=excluded.role',[id,m.email.toLowerCase(),m.role]);
 }else if(command?.type==='removeMember'){
  if(p.role!=='owner')throw new DomainError('Only the project owner can manage access',403);await client.query('delete from lps_members where project_id=$1 and email=$2',[id,command.email]);
 }else if(command?.type==='importTasks'){
  for(const task of command.tasks)state=applyCommand(state,task);
 }else state=applyCommand(p.state,request.command);
 await client.query('update lps_projects set state=$1,version=version+1,updated_at=now() where id=$2',[JSON.stringify(state),id]);
 await client.query('insert into lps_events(id,project_id,actor_id,command,version) values($1,$2,$3,$4,$5)',[request.requestId,id,u.id,JSON.stringify(command),p.version+1]);await client.query('commit');return Response.json({state,version:p.version+1},{headers:privateHeaders});
 }catch(e){if(client)await client.query('rollback').catch(()=>{});return failure(e);}finally{client?.release();}}
