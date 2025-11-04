-- Migration: 000_init_core
-- Up
create type post_status as enum ('draft','approved','posted');

create table if not exists queue_posts(
  id uuid primary key default gen_random_uuid(),
  content_hash text unique not null,
  status post_status not null default 'draft',
  tweet_id text,
  created_at timestamptz default now()
);

create table if not exists metrics_jobs(
  id uuid primary key default gen_random_uuid(),
  tweet_id text unique not null,
  status text not null default 'queued',
  attempts int not null default 0,
  next_run timestamptz default now()
);

create index if not exists idx_queue_posts_status on queue_posts(status);
create index if not exists idx_metrics_jobs_next_run on metrics_jobs(next_run);
create index if not exists idx_metrics_jobs_tweet_id on metrics_jobs(tweet_id);

-- Down
-- drop index if exists idx_metrics_jobs_tweet_id;
-- drop index if exists idx_metrics_jobs_next_run;
-- drop index if exists idx_queue_posts_status;
-- drop table if exists metrics_jobs;
-- drop table if exists queue_posts;
-- drop type if exists post_status;

