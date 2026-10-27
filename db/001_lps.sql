create table if not exists public.lps_projects (
 id uuid primary key,
 owner_id text not null,
 state jsonb not null check (state->>'schema'='1' and jsonb_typeof(state->'tasks')='array' and jsonb_typeof(state->'entries')='array'),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.lps_members (
 project_id uuid not null references public.lps_projects(id),
 email text not null check(email=lower(email)),
 role text not null check(role in ('editor','viewer')),
 primary key(project_id,email)
);
create table if not exists public.lps_events (
 id uuid primary key,
 project_id uuid not null references public.lps_projects(id),
 actor_id text not null,
 command jsonb not null,
 version integer not null,
 created_at timestamptz not null default now(),
 unique(project_id,version)
);
create index if not exists lps_projects_owner on public.lps_projects(owner_id);
create index if not exists lps_members_email on public.lps_members(email);
create index if not exists lps_events_project on public.lps_events(project_id,created_at);
alter table public.lps_projects enable row level security;
alter table public.lps_members enable row level security;
alter table public.lps_events enable row level security;
revoke all on public.lps_projects,public.lps_members,public.lps_events from public;
-- No browser Data API: server-only pooled connection, session + project access on every request.
-- Whole-document writes are not exposed. Commands run under SELECT FOR UPDATE with a version guard.
