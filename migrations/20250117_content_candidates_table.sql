-- Content candidates table for thread generation and selection
create table if not exists content_candidates (
  id bigserial primary key,
  topic text not null,
  hook_type text not null check (hook_type in ('how_to', 'myth_bust', 'checklist', 'story', 'stat_drop')),
  tweets_json jsonb not null,
  evaluator_scores_json jsonb,
  chosen boolean default false,
  chosen_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for performance
create index if not exists content_candidates_topic_idx on content_candidates(topic);
create index if not exists content_candidates_hook_type_idx on content_candidates(hook_type);
create index if not exists content_candidates_chosen_idx on content_candidates(chosen);
create index if not exists content_candidates_created_at_idx on content_candidates(created_at desc);

-- Posts table for tracking posted threads
create table if not exists posts (
  id bigserial primary key,
  root_id text not null unique,
  permalink text not null,
  tweets_json jsonb not null,
  hook_type text,
  topic text,
  candidate_id bigint references content_candidates(id),
  posted_at timestamptz default now()
);

-- Indexes for posts
create index if not exists posts_root_id_idx on posts(root_id);
create index if not exists posts_permalink_idx on posts(permalink);
create index if not exists posts_hook_type_idx on posts(hook_type);
create index if not exists posts_posted_at_idx on posts(posted_at desc);

-- Metrics snapshots for learning
create table if not exists metrics_snapshots (
  id bigserial primary key,
  post_id bigint references posts(id) not null,
  root_id text not null,
  snapshot_at timestamptz not null,
  interval_type text not null check (interval_type in ('30m', '2h', '24h')),
  impressions integer default 0,
  likes integer default 0,
  replies integer default 0,
  retweets integer default 0,
  bookmarks integer default 0,
  engagement_rate numeric generated always as (
    case when impressions > 0 then
      (likes + 2.0 * replies + 1.5 * retweets + 0.5 * bookmarks) / impressions
    else 0 end
  ) stored,
  created_at timestamptz default now()
);

-- Indexes for metrics
create unique index if not exists metrics_snapshots_post_interval_idx 
  on metrics_snapshots(post_id, interval_type);
create index if not exists metrics_snapshots_root_id_idx on metrics_snapshots(root_id);
create index if not exists metrics_snapshots_snapshot_at_idx on metrics_snapshots(snapshot_at desc);

-- Trending topics for content selection
create table if not exists trending_topics (
  id bigserial primary key,
  topic text not null unique,
  momentum_score numeric default 0,
  last_mentions integer default 0,
  last_engagement integer default 0,
  updated_at timestamptz default now()
);

-- Index for trending topics
create index if not exists trending_topics_momentum_idx on trending_topics(momentum_score desc);
create index if not exists trending_topics_updated_at_idx on trending_topics(updated_at desc);

-- Bandit arms for learning
create table if not exists bandit_arms (
  id bigserial primary key,
  hook_type text not null unique check (hook_type in ('how_to', 'myth_bust', 'checklist', 'story', 'stat_drop')),
  total_pulls integer default 0,
  total_reward numeric default 0,
  average_reward numeric generated always as (
    case when total_pulls > 0 then total_reward / total_pulls else 0 end
  ) stored,
  confidence_bound numeric default 0,
  last_pulled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Initialize bandit arms
insert into bandit_arms (hook_type) values 
  ('how_to'), ('myth_bust'), ('checklist'), ('story'), ('stat_drop')
on conflict (hook_type) do nothing;

-- Index for bandit arms
create index if not exists bandit_arms_confidence_bound_idx on bandit_arms(confidence_bound desc);