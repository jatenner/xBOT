-- 🎯 OPENAI COST TRACKING - USER'S EXACT SPECIFICATION

-- 1) Main usage log table
create table if not exists public.openai_usage_log (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),

  -- from your logs
  model             text        not null,                     -- e.g. gpt-4o, gpt-4o-mini
  cost_tier         text        not null check (
                      cost_tier in ('gpt-4o','gpt-4','gpt-3.5','other')
                    ),
  intent            text,                                     -- e.g. strategic_engagement, other

  prompt_tokens     integer     not null default 0 check (prompt_tokens     >= 0),
  completion_tokens integer     not null default 0 check (completion_tokens >= 0),
  total_tokens      integer     not null default 0 check (total_tokens      >= 0),

  cost_usd          numeric(12,6) not null default 0 check (cost_usd >= 0),

  request_id        text,                                     -- provider response id if present
  finish_reason     text,                                     -- e.g. "stop", "length", null

  raw               jsonb       not null default '{}'::jsonb  -- optional full response/meta
);

-- Helpful indexes
create index if not exists idx_openai_usage_log_created_at on public.openai_usage_log (created_at desc);
create index if not exists idx_openai_usage_log_model      on public.openai_usage_log (model);
create index if not exists idx_openai_usage_log_intent     on public.openai_usage_log (intent);
create index if not exists idx_openai_usage_log_request_id on public.openai_usage_log (request_id);
create index if not exists idx_openai_usage_log_raw_gin    on public.openai_usage_log using gin (raw);

-- 2) Safe insert function (coalesces totals, never errors)
create or replace function public.log_openai_usage(
  p_model             text,
  p_cost_tier         text,
  p_intent            text default null,
  p_prompt_tokens     integer default 0,
  p_completion_tokens integer default 0,
  p_total_tokens      integer default null,
  p_cost_usd          numeric default 0,
  p_request_id        text default null,
  p_finish_reason     text default null,
  p_raw               jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
as $$
declare
  v_total integer;
  v_id    bigint;
begin
  v_total := coalesce(p_total_tokens, p_prompt_tokens + p_completion_tokens, 0);

  insert into public.openai_usage_log (
    model, cost_tier, intent,
    prompt_tokens, completion_tokens, total_tokens,
    cost_usd, request_id, finish_reason, raw
  ) values (
    coalesce(p_model, 'unknown'),
    coalesce(p_cost_tier, 'other'),
    nullif(p_intent, ''),
    greatest(coalesce(p_prompt_tokens, 0), 0),
    greatest(coalesce(p_completion_tokens, 0), 0),
    greatest(coalesce(v_total, 0), 0),
    greatest(coalesce(p_cost_usd, 0), 0),
    nullif(p_request_id, ''),
    nullif(p_finish_reason, ''),
    coalesce(p_raw, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
exception when others then
  -- swallow errors so app never crashes on logging
  raise notice '[log_openai_usage] swallow error: %', sqlerrm;
  return null;
end;
$$;

-- 3) Daily rollups for dashboards
-- materialized view for fast cost & token summaries
create materialized view if not exists public.openai_usage_daily as
select
  date_trunc('day', created_at)::date as day,
  model,
  cost_tier,
  coalesce(intent, 'other') as intent,
  sum(prompt_tokens)        as prompt_tokens,
  sum(completion_tokens)    as completion_tokens,
  sum(total_tokens)         as total_tokens,
  sum(cost_usd)             as cost_usd,
  count(*)                  as calls
from public.openai_usage_log
group by 1,2,3,4;

-- indexes to speed filters on the MV
create index if not exists idx_openai_usage_daily_day on public.openai_usage_daily (day desc);
create index if not exists idx_openai_usage_daily_model_intent on public.openai_usage_daily (model, intent);

-- helper to refresh quickly
create or replace function public.refresh_openai_usage_daily()
returns void language sql as $$
  refresh materialized view concurrently public.openai_usage_daily;
$$;

-- 4) RLS + basic read access
-- enable RLS
alter table public.openai_usage_log enable row level security;

-- allow service role to read/insert (Supabase service key bypasses RLS, but harmless)
create policy if not exists openai_usage_log_read
on public.openai_usage_log
for select
to public
using (true);

create policy if not exists openai_usage_log_insert
on public.openai_usage_log
for insert
to public
with check (true);

COMMENT ON TABLE public.openai_usage_log IS 'Tracks every OpenAI API call with detailed cost and usage metrics - USER SPECIFICATION';
COMMENT ON FUNCTION public.log_openai_usage IS 'Safe insert function that coalesces totals and never errors - prevents app crashes on logging';