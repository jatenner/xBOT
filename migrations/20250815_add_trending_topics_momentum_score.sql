alter table if exists trending_topics
  add column if not exists momentum_score numeric default 0;