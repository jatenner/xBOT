-- SAFETY: create table to store latest job heartbeats + failure metadata
create table if not exists public.job_heartbeats (
    job_name text primary key,
    last_success timestamptz,
    last_failure timestamptz,
    last_run_status text,
    last_error text,
    consecutive_failures integer not null default 0,
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists job_heartbeats_last_success_idx
    on public.job_heartbeats (last_success);

create index if not exists job_heartbeats_last_failure_idx
    on public.job_heartbeats (last_failure);

