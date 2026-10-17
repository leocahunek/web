-- Run once in your Supabase SQL Editor after creating your own Auth user.
-- Replace OWNER_EMAIL_HERE with that user's email before running this script.
-- This file contains no password, API secret or service-role key.
begin;

create schema if not exists portfolio_private;
revoke all on schema portfolio_private from public, anon, authenticated;
create table if not exists portfolio_private.portfolio_owner (
  id boolean primary key default true check (id),
  user_id uuid not null references auth.users(id) on delete cascade
);
alter table portfolio_private.portfolio_owner enable row level security;
revoke all on portfolio_private.portfolio_owner from public, anon, authenticated;

do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users where lower(email) = lower('OWNER_EMAIL_HERE') limit 1;
  if owner_id is null then
    raise exception 'Create your Auth user and replace OWNER_EMAIL_HERE before running this script.';
  end if;
  insert into portfolio_private.portfolio_owner (id,user_id) values (true,owner_id)
  on conflict (id) do update set user_id = excluded.user_id;
end $$;

create or replace function public.is_portfolio_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from portfolio_private.portfolio_owner where user_id = (select auth.uid())) $$;
revoke all on function public.is_portfolio_owner() from public, anon, authenticated;
grant execute on function public.is_portfolio_owner() to authenticated;

create table if not exists public.portfolio (
  id text primary key check (id = 'main'),
  about jsonb,
  projects jsonb not null default '[]'::jsonb check (jsonb_typeof(projects) = 'array' and jsonb_array_length(projects) <= 200),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
alter table public.portfolio enable row level security;
revoke all on public.portfolio from public, anon, authenticated;
grant select on public.portfolio to anon, authenticated;
alter table public.portfolio add column if not exists about jsonb;
grant update (about) on public.portfolio to authenticated;
grant update (projects) on public.portfolio to authenticated;

drop policy if exists "Read published portfolio" on public.portfolio;
create policy "Read published portfolio" on public.portfolio for select to anon, authenticated using (id = 'main');
drop policy if exists "Only owner can publish portfolio" on public.portfolio;
create policy "Only owner can publish portfolio" on public.portfolio for update to authenticated
using ((select public.is_portfolio_owner())) with check (id = 'main' and (select public.is_portfolio_owner()));

create or replace function portfolio_private.advance_portfolio_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists portfolio_revision on public.portfolio;
create trigger portfolio_revision before update on public.portfolio for each row execute function portfolio_private.advance_portfolio_revision();

-- The initial examples keep the current public website intact until you edit it.
insert into public.portfolio (id,projects) values ('main', $seed$[
  {"id":"demo-portrait","name":"Između svjetla i sjene","sub":"Portretna fotografija","cat":"photo","art":"portrait","image":"https://images.unsplash.com/photo-1534528741775-53994a69daeb","short":"Portraits","description":"Ogledni vizual za prikaz dizajna portfolija.","featured":true},
  {"id":"demo-city","name":"Grad u pokretu","sub":"Video / ogledni film","cat":"video","art":"city","image":"https://images.unsplash.com/photo-1519608487953-e999c86e7455","video":"https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4","short":"After hours","description":"Ogledni video za demonstraciju reprodukcije.","featured":true},
  {"id":"demo-design","name":"Forma & karakter","sub":"Vizualni identitet / koncept","cat":"design","art":"design","image":"https://images.unsplash.com/photo-1634942536790-2539db948f1f","short":"Objects","description":"Ogledni vizual za prikaz dizajna portfolija.","featured":true},
  {"id":"demo-space","name":"Tišina prostora","sub":"Arhitektura i interijer","cat":"photo","art":"space","image":"https://images.unsplash.com/photo-1600210492486-724fe5c67fb0","short":"Spaces","description":"Ogledni vizual za prikaz dizajna portfolija.","featured":true},
  {"id":"demo-travel","name":"Negdje usput","sub":"Travel fotografija","cat":"photo","art":"travel","image":"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b","short":"Elsewhere","description":"Ogledni vizual za prikaz dizajna portfolija.","featured":true},
  {"id":"demo-ritual","name":"Mali rituali","sub":"Produkt i lifestyle fotografija","cat":"photo","art":"ritual","image":"https://images.unsplash.com/photo-1442512595331-e89e73853f31","short":"Rituals","description":"Ogledni vizual za prikaz dizajna portfolija.","featured":false}
]$seed$::jsonb) on conflict (id) do nothing;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('portfolio-media','portfolio-media',true,157286400,array['image/jpeg','image/png','image/webp','image/avif','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Downloads of known public URLs work for visitors. Listing and changing
-- stored objects require the owner's verified JWT, never a browser password check.
drop policy if exists "Owner can list portfolio files" on storage.objects;
create policy "Owner can list portfolio files" on storage.objects for select to authenticated
using (bucket_id = 'portfolio-media' and (select public.is_portfolio_owner()) and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Owner can upload portfolio files" on storage.objects;
create policy "Owner can upload portfolio files" on storage.objects for insert to authenticated
with check (bucket_id = 'portfolio-media' and (select public.is_portfolio_owner()) and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Owner can update portfolio files" on storage.objects;
create policy "Owner can update portfolio files" on storage.objects for update to authenticated
using (bucket_id = 'portfolio-media' and (select public.is_portfolio_owner()) and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'portfolio-media' and (select public.is_portfolio_owner()) and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Owner can remove portfolio files" on storage.objects;
create policy "Owner can remove portfolio files" on storage.objects for delete to authenticated
using (bucket_id = 'portfolio-media' and (select public.is_portfolio_owner()) and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
