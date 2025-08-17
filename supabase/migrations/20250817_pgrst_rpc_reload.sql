-- Add RPC function for PostgREST schema reload
-- This allows safe schema reloads via Supabase RPC when no direct DB access is available

create or replace function public.pgrst_schema_reload()
returns void
language sql
security definer
as $$
  select pg_notify('pgrst','reload schema');
$$;

-- Revoke default public access
revoke all on function public.pgrst_schema_reload from public;

-- Grant execute to Supabase auth roles (service_role primarily)
grant execute on function public.pgrst_schema_reload() to
  anon, authenticated, service_role;
