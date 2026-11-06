-- Portfolio CMS schema. Paste into Supabase → SQL Editor and run once.
-- Safe to re-run: everything is created idempotently.
--
-- All site content is one JSON document (shape: src/data/schema.ts), stored in
-- two rows: 'draft' is what /admin edits, 'published' is what the site build reads.


-- Admins ---------------------------------------------------------------------

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.admins enable row level security;
-- No policies on purpose: this table is only managed from the SQL editor.
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;


-- Content --------------------------------------------------------------------

create table if not exists public.site_content (
  id text primary key check (id in ('draft', 'published')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.site_content enable row level security;

drop policy if exists "Anyone can read published content" on public.site_content;
create policy "Anyone can read published content"
  on public.site_content for select
  to anon, authenticated
  using (id = 'published');

drop policy if exists "Admins can read the draft" on public.site_content;
create policy "Admins can read the draft"
  on public.site_content for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can edit the draft" on public.site_content;
create policy "Admins can edit the draft"
  on public.site_content for update
  to authenticated
  using (id = 'draft' and (select public.is_admin()))
  with check (id = 'draft' and (select public.is_admin()));

revoke all on public.site_content from anon, authenticated;
grant select on public.site_content to anon, authenticated;
grant update (data) on public.site_content to authenticated;

create or replace function public.touch_site_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists site_content_touch on public.site_content;
create trigger site_content_touch
  before update on public.site_content
  for each row execute function public.touch_site_content();


-- Publish history (lets /admin restore an older version) ----------------------

create table if not exists public.site_content_history (
  id bigint generated always as identity primary key,
  data jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null
);

alter table public.site_content_history enable row level security;

drop policy if exists "Admins can read history" on public.site_content_history;
create policy "Admins can read history"
  on public.site_content_history for select
  to authenticated
  using ((select public.is_admin()));

revoke all on public.site_content_history from anon, authenticated;
grant select on public.site_content_history to authenticated;


-- Publish: copy draft → published and record it in history --------------------

create or replace function public.publish_content()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can publish' using errcode = '42501';
  end if;

  select data into draft from public.site_content where id = 'draft';
  update public.site_content set data = draft where id = 'published';
  insert into public.site_content_history (data, published_by) values (draft, auth.uid());
  return now();
end;
$$;

revoke execute on function public.publish_content() from public, anon;
grant execute on function public.publish_content() to authenticated;


-- Storage: images and resume uploaded from /admin ----------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'application/pdf']
)
on conflict (id) do nothing;

-- Public bucket: anyone can download by URL. Only admins can list or change files.
drop policy if exists "site-assets: admins can list" on storage.objects;
create policy "site-assets: admins can list"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'site-assets' and (select public.is_admin()));

drop policy if exists "site-assets: admins can upload" on storage.objects;
create policy "site-assets: admins can upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'site-assets' and (select public.is_admin()));

drop policy if exists "site-assets: admins can update" on storage.objects;
create policy "site-assets: admins can update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'site-assets' and (select public.is_admin()));

drop policy if exists "site-assets: admins can delete" on storage.objects;
create policy "site-assets: admins can delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'site-assets' and (select public.is_admin()));
