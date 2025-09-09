-- Table
create table if not exists public.openai_usage_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  model text,
  cost_tier text,
  intent text,
  prompt_tokens int,
  completion_tokens int,
  total_tokens int,
  cost_usd numeric,
  request_id text,
  finish_reason text,
  raw jsonb
);

-- Function
create or replace function public.log_openai_usage(
  p_completion_tokens int,
  p_cost_tier text,
  p_cost_usd numeric,
  p_finish_reason text,
  p_intent text,
  p_model text,
  p_prompt_tokens int,
  p_raw jsonb,
  p_request_id text,
  p_total_tokens int
) returns bigint
language plpgsql
as $$
declare new_id bigint;
begin
  insert into public.openai_usage_log(
    created_at, model, cost_tier, intent,
    prompt_tokens, completion_tokens, total_tokens,
    cost_usd, request_id, finish_reason, raw
  ) values (
    now(), p_model, p_cost_tier, p_intent,
    p_prompt_tokens, p_completion_tokens, p_total_tokens,
    p_cost_usd, p_request_id, p_finish_reason, coalesce(p_raw, '{}'::jsonb)
  ) returning id into new_id;
  return new_id;
end $$;

-- Minimal grants for service_role (already superuser) and anon if needed:
grant select, insert on public.openai_usage_log to anon;
grant execute on function public.log_openai_usage(
  int, text, numeric, text, text, text, int, jsonb, text, int
) to anon;
