-- Fix optimal_posting_windows table for 42703 error
-- Creates table with correct schema and seeds default data

create table if not exists optimal_posting_windows (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null,
  start_hour smallint not null,
  end_hour smallint not null,
  score numeric default 0,
  created_at timestamptz default now()
);

-- Add columns if missing (idempotent)
alter table optimal_posting_windows
  add column if not exists day_of_week smallint;

alter table optimal_posting_windows
  add column if not exists start_hour smallint;

alter table optimal_posting_windows
  add column if not exists end_hour smallint;

alter table optimal_posting_windows
  add column if not exists score numeric default 0;

-- Create index for performance
create index if not exists idx_optimal_posting_windows_day 
  on optimal_posting_windows(day_of_week);

-- Seed defaults if empty (7 days, 9am-12pm windows)
insert into optimal_posting_windows (day_of_week, start_hour, end_hour, score)
select d, 9, 12, 1.0 from generate_series(0,6) d
where not exists (select 1 from optimal_posting_windows limit 1);