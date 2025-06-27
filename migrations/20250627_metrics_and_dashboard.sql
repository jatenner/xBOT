-- Migration: Tweet Analytics and Dashboard Tables
-- Creates tables for nightly metrics collection and dashboard planning
-- Date: 2025-06-27

-- Tweet Metrics Table: Stores nightly-collected Twitter analytics
create table if not exists tweet_metrics (
  tweet_id       bigint primary key,
  like_count     int default 0,
  retweet_count  int default 0,
  reply_count    int default 0,
  quote_count    int default 0,
  captured_at    timestamptz default now()
);

-- Bot Dashboard Table: Stores planned posts and KPIs for dashboard
create table if not exists bot_dashboard (
  date                date primary key,
  planned_posts_json  jsonb,
  updated_at          timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_tweet_metrics_captured_at on tweet_metrics(captured_at);
create index if not exists idx_bot_dashboard_updated_at on bot_dashboard(updated_at);

-- Comments for documentation
comment on table tweet_metrics is 'Nightly-collected Twitter analytics for engagement tracking';
comment on table bot_dashboard is 'Dashboard data including planned posts and KPIs';
comment on column tweet_metrics.tweet_id is 'Twitter tweet ID (bigint to handle Twitter''s 64-bit IDs)';
comment on column tweet_metrics.captured_at is 'When these metrics were captured from Twitter API';
comment on column bot_dashboard.planned_posts_json is 'JSON array of planned posts for the day';
comment on column bot_dashboard.updated_at is 'When this dashboard data was last updated';
