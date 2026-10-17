-- Run once in the Supabase SQL Editor. Existing projects and owner policies remain.
begin;
alter table public.portfolio add column if not exists about jsonb;
grant update (about) on public.portfolio to authenticated;
commit;
