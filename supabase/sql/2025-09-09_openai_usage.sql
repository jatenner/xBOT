create table if not exists public.openai_usage_log (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),
  model             text        not null,
  cost_tier         text        not null check (cost_tier in ('gpt-4o','gpt-4','gpt-3.5','other')),
  intent            text,
  prompt_tokens     integer     not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer     not null default 0 check (completion_tokens >= 0),
  total_tokens      integer     not null default 0 check (total_tokens >= 0),
  cost_usd          numeric(12,6) not null default 0 check (cost_usd >= 0),
  request_id        text,
  finish_reason     text,
  raw               jsonb       not null default '{}'::jsonb
);

-- canonical function (named args)
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
  raise notice '[log_openai_usage] swallow error: %', sqlerrm;
  return null;
end;
$$;

-- compatibility wrapper with the EXACT order the Node app uses now:
-- (p_completion_tokens, p_cost_tier, p_cost_usd, p_finish_reason, p_intent, p_model, p_prompt_tokens, p_raw, p_request_id, p_total_tokens)
create or replace function public.log_openai_usage(
  p_completion_tokens integer,
  p_cost_tier         text,
  p_cost_usd          numeric,
  p_finish_reason     text,
  p_intent            text,
  p_model             text,
  p_prompt_tokens     integer,
  p_raw               jsonb,
  p_request_id        text,
  p_total_tokens      integer
)
returns bigint
language sql
as $$
  select public.log_openai_usage(
    p_model             => p_model,
    p_cost_tier         => p_cost_tier,
    p_intent            => p_intent,
    p_prompt_tokens     => p_prompt_tokens,
    p_completion_tokens => p_completion_tokens,
    p_total_tokens      => p_total_tokens,
    p_cost_usd          => p_cost_usd,
    p_request_id        => p_request_id,
    p_finish_reason     => p_finish_reason,
    p_raw               => coalesce(p_raw, '{}'::jsonb)
  );
$$;
