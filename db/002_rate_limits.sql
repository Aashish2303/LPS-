create table if not exists public.lps_rate_limits (
 key text primary key check (length(key)=64),
 hits integer not null check(hits>0),
 reset_at timestamptz not null
);
create index if not exists lps_rate_limits_expiry on public.lps_rate_limits(reset_at);
alter table public.lps_rate_limits enable row level security;
revoke all on public.lps_rate_limits from public;
