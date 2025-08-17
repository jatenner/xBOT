-- Create or patch learning_posts table
-- Idempotent migration for learning system

-- Create table if not exists
create table if not exists learning_posts (
  tweet_id text primary key,
  created_at timestamptz not null default now(),
  format text not null default 'single',
  likes_count int not null default 0,
  retweets_count int not null default 0,
  replies_count int not null default 0,
  bookmarks_count int not null default 0,
  impressions_count int not null default 0,
  viral_potential_score int,
  content text
);

-- If table exists, add any missing columns (idempotent)
alter table learning_posts add column if not exists format text not null default 'single';
alter table learning_posts add column if not exists likes_count int not null default 0;
alter table learning_posts add column if not exists retweets_count int not null default 0;
alter table learning_posts add column if not exists replies_count int not null default 0;
alter table learning_posts add column if not exists bookmarks_count int not null default 0;
alter table learning_posts add column if not exists impressions_count int not null default 0;
alter table learning_posts add column if not exists viral_potential_score int;
alter table learning_posts add column if not exists content text;

-- Create indexes if not exists (idempotent)
create index if not exists learning_posts_created_at_idx on learning_posts(created_at desc);
create index if not exists learning_posts_format_idx on learning_posts(format);
create index if not exists learning_posts_viral_score_idx on learning_posts(viral_potential_score desc nulls last);
create index if not exists learning_posts_engagement_idx on learning_posts((likes_count + retweets_count + replies_count) desc);
