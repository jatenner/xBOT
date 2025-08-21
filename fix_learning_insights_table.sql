-- Fix learning_insights table and confidence_score column issue
-- Create learning_insights table if it doesn't exist

create table if not exists public.learning_insights (
  id bigserial primary key,
  insight_type text not null,
  insight_data jsonb not null,
  confidence_score numeric(3,2) default 0.5,
  created_at timestamptz not null default now()
);

-- Create indexes for performance
create index if not exists idx_learning_insights_type on public.learning_insights(insight_type);
create index if not exists idx_learning_insights_created_at on public.learning_insights(created_at);
create index if not exists idx_learning_insights_confidence on public.learning_insights(confidence_score);

-- Enable RLS
alter table public.learning_insights enable row level security;

-- Service role policy
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='learning_insights' and policyname='service_can_all_learning_insights'
  ) then
    create policy "service_can_all_learning_insights" on public.learning_insights
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end$$;

-- Force PostgREST schema cache reload
select pg_notify('pgrst', 'reload schema');
