create table if not exists public.posting_attempts (
    id uuid primary key default gen_random_uuid(),
    job_type text not null default 'reply',
    decision_id text,
    target_tweet_id text,
    tweet_id text,
    status text not null,
    error_message text,
    metrics jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists posting_attempts_decision_idx on public.posting_attempts (decision_id);
create index if not exists posting_attempts_target_tweet_idx on public.posting_attempts (target_tweet_id);
create index if not exists posting_attempts_status_idx on public.posting_attempts (status);

