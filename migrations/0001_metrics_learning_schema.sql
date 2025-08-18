-- 0001_metrics_learning_schema.sql
-- Comprehensive schema fix for tweet_metrics and learning_posts

-- Create tweet_metrics table with all required columns
create table if not exists public.tweet_metrics (
  tweet_id text not null,
  collected_at timestamptz not null default now(),
  likes_count bigint not null default 0,
  retweets_count bigint not null default 0,
  replies_count bigint not null default 0,
  bookmarks_count bigint not null default 0,
  impressions_count bigint not null default 0,
  content text,
  primary key (tweet_id, collected_at)
);

-- Add missing columns to tweet_metrics (idempotent)
do $$
begin
  -- Check and add each column if it doesn't exist
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='likes_count') then
    alter table public.tweet_metrics add column likes_count bigint not null default 0;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='retweets_count') then
    alter table public.tweet_metrics add column retweets_count bigint not null default 0;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='replies_count') then
    alter table public.tweet_metrics add column replies_count bigint not null default 0;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='bookmarks_count') then
    alter table public.tweet_metrics add column bookmarks_count bigint not null default 0;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='impressions_count') then
    alter table public.tweet_metrics add column impressions_count bigint not null default 0;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tweet_metrics' and column_name='content') then
    alter table public.tweet_metrics add column content text;
  end if;
end$$;

-- Create learning_posts table with all required columns
create table if not exists public.learning_posts (
  tweet_id text primary key,
  created_at timestamptz not null default now(),
  format text check (format in ('single','thread')) default 'single',
  likes_count bigint not null default 0,
  retweets_count bigint not null default 0,
  replies_count bigint not null default 0,
  bookmarks_count bigint not null default 0,
  impressions_count bigint not null default 0,
  viral_potential_score integer not null default 0,
  content text
);

-- Add missing columns to learning_posts (idempotent)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='likes_count') then
    alter table public.learning_posts add column likes_count bigint not null default 0;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='retweets_count') then
    alter table public.learning_posts add column retweets_count bigint not null default 0;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='replies_count') then
    alter table public.learning_posts add column replies_count bigint not null default 0;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='bookmarks_count') then
    alter table public.learning_posts add column bookmarks_count bigint not null default 0;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='impressions_count') then
    alter table public.learning_posts add column impressions_count bigint not null default 0;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='viral_potential_score') then
    alter table public.learning_posts add column viral_potential_score integer not null default 0;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='content') then
    alter table public.learning_posts add column content text;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_posts' and column_name='format') then
    alter table public.learning_posts add column format text check (format in ('single','thread')) default 'single';
  end if;
end$$;

-- Create indexes for performance
create index if not exists idx_tweet_metrics_tweet_id on public.tweet_metrics(tweet_id);
create index if not exists idx_tweet_metrics_collected_at on public.tweet_metrics(collected_at);
create index if not exists idx_learning_posts_created_at on public.learning_posts(created_at);
create index if not exists idx_learning_posts_format on public.learning_posts(format);

-- Enable RLS and create service role policies
alter table public.tweet_metrics enable row level security;
alter table public.learning_posts enable row level security;

-- Service role policies (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='tweet_metrics' and policyname='service_can_all_tweet_metrics'
  ) then
    create policy "service_can_all_tweet_metrics" on public.tweet_metrics
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='learning_posts' and policyname='service_can_all_learning_posts'
  ) then
    create policy "service_can_all_learning_posts" on public.learning_posts
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end$$;

-- Force PostgREST schema cache reload
select pg_notify('pgrst', 'reload schema');
