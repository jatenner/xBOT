-- tweet_metrics: one row per tweet per nightly harvest
create table if not exists public.tweet_metrics (
  tweet_id          bigint       primary key,
  captured_at       timestamptz  not null default now(),
  like_count        int          not null,
  retweet_count     int          not null,
  reply_count       int          not null,
  quote_count       int          not null,
  impression_count  int          not null,
  json_payload      jsonb        not null
);

-- bot_dashboard: tomorrow's planned posts (one row per date)
create table if not exists public.bot_dashboard (
  date                 date        primary key,
  planned_posts_json   jsonb       not null,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- keep updated_at fresh
create or replace function public.touch_bot_dashboard()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_bot_dashboard_touch
before update on public.bot_dashboard
for each row execute function public.touch_bot_dashboard(); 