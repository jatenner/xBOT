-- Create or patch tweet_metrics table
-- Idempotent migration for metrics storage

-- Create table if not exists
create table if not exists tweet_metrics (
  tweet_id text not null,
  collected_at timestamptz not null default now(),
  likes_count int not null default 0,
  retweets_count int not null default 0,
  replies_count int not null default 0,
  bookmarks_count int not null default 0,
  impressions_count int not null default 0,
  content text,
  primary key (tweet_id, collected_at)
);

-- If table already exists, add any missing columns (idempotent)
alter table tweet_metrics add column if not exists likes_count int not null default 0;
alter table tweet_metrics add column if not exists retweets_count int not null default 0;
alter table tweet_metrics add column if not exists replies_count int not null default 0;
alter table tweet_metrics add column if not exists bookmarks_count int not null default 0;
alter table tweet_metrics add column if not exists impressions_count int not null default 0;
alter table tweet_metrics add column if not exists content text;

-- Create indexes if not exists (idempotent)
create index if not exists tweet_metrics_tweet_id_idx on tweet_metrics(tweet_id);
create index if not exists tweet_metrics_collected_at_idx on tweet_metrics(collected_at desc);
create index if not exists tweet_metrics_likes_idx on tweet_metrics(likes_count desc);
