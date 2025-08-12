create table if not exists public.browser_cookies (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
