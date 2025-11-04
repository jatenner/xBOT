-- tweets table already exists with different schema, skip

create table if not exists bot_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);

create table if not exists daily_summaries (
  id bigserial primary key,
  day date unique,
  summary text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  event text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_audit_log_created_at on audit_log(created_at);

create table if not exists system_health (
  id bigserial primary key,
  name text unique,
  status text,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz default now()
);
