-- API Usage table for OpenAI cost tracking
-- Created: 2025-01-09

create table if not exists public.api_usage (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  intent text not null,
  model text not null,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  cost_usd numeric(10,6) not null default 0,
  meta jsonb not null default '{}'::jsonb
);

alter table public.api_usage owner to postgres;

-- Enable RLS
alter table public.api_usage enable row level security;

-- Allow service role to bypass (it already bypasses), plus a permissive policy for insert by authenticated users
drop policy if exists insert_api_usage on public.api_usage;
create policy insert_api_usage on public.api_usage
  for insert to authenticated
  with check (true);

-- Index for performance
create index if not exists idx_api_usage_created_at on public.api_usage(created_at desc);
create index if not exists idx_api_usage_intent on public.api_usage(intent);
create index if not exists idx_api_usage_model on public.api_usage(model);
