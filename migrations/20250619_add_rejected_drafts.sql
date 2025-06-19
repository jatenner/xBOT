create table if not exists rejected_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  content text,
  reason text
); 