-- ════════════════════════════════════════════════════════════════════════
-- VISUAL INTELLIGENCE: Collected Tweet Enhancements
-- Date: 2025-11-09
-- Purpose: Store media/context metadata required for richer analysis.
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table if exists vi_collected_tweets
  add column if not exists original_author text,
  add column if not exists is_quote boolean default false,
  add column if not exists is_reply boolean default false,
  add column if not exists has_media boolean default false,
  add column if not exists media_types text[] default '{}',
  add column if not exists reply_to_tweet_id text,
  add column if not exists root_tweet_id text;

alter table if exists vi_visual_formatting
  add column if not exists has_media boolean default false,
  add column if not exists media_types text[] default '{}',
  add column if not exists screenshot_detected boolean default false,
  add column if not exists callout_detected boolean default false;

create index if not exists idx_vi_collected_tweets_media
  on vi_collected_tweets (has_media, is_thread, is_reply);

commit;

