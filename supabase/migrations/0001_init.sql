-- ============================================================================
-- DevPulse initial schema
-- Enums, tables, indexes, and Row Level Security policies.
-- Run via: supabase db push  (or apply in the Supabase SQL editor)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
create type public.monitor_status as enum (
  'operational',
  'degraded',
  'down',
  'paused'
);

create type public.check_interval as enum (
  '30s',
  '1m',
  '5m',
  '15m',
  '1h'
);

-- ---------------------------------------------------------------------------
-- 2. monitors
-- ---------------------------------------------------------------------------
create table public.monitors (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 100),
  url             text not null,
  interval        public.check_interval not null default '1m',
  status          public.monitor_status not null default 'operational',
  last_latency_ms integer,
  is_paused       boolean not null default false,
  ssl_expires_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index monitors_user_id_idx on public.monitors (user_id);

-- Auto-maintain updated_at on monitors.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger monitors_set_updated_at
before update on public.monitors
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. check_logs
-- ---------------------------------------------------------------------------
create table public.check_logs (
  id            uuid primary key default gen_random_uuid(),
  monitor_id    uuid not null references public.monitors (id) on delete cascade,
  status_code   integer not null,
  latency_ms    integer not null,
  location      text not null default 'US-East',
  error_message text,
  created_at    timestamptz not null default now()
);

create index check_logs_monitor_id_created_at_idx
  on public.check_logs (monitor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. public_status_pages
-- ---------------------------------------------------------------------------
create table public.public_status_pages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  slug       text not null unique
             check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title      text not null default 'System Status',
  is_live    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.monitors              enable row level security;
alter table public.check_logs            enable row level security;
alter table public.public_status_pages   enable row level security;

-- monitors ----------------------------------------------------------------
create policy "Users can read their own monitors"
  on public.monitors for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own monitors"
  on public.monitors for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own monitors"
  on public.monitors for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own monitors"
  on public.monitors for delete
  to authenticated
  using (auth.uid() = user_id);

-- Public read: exposed only when the owner has a LIVE public status page.
create policy "Public can read monitors on live status pages"
  on public.monitors for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.public_status_pages psp
      where psp.user_id = monitors.user_id
        and psp.is_live = true
    )
  );

-- check_logs --------------------------------------------------------------
create policy "Users can read logs for their own monitors"
  on public.check_logs for select
  to authenticated
  using (
    exists (
      select 1
      from public.monitors m
      where m.id = check_logs.monitor_id
        and auth.uid() = m.user_id
    )
  );

create policy "Users can create logs for their own monitors"
  on public.check_logs for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.monitors m
      where m.id = check_logs.monitor_id
        and auth.uid() = m.user_id
    )
  );

create policy "Users can update logs for their own monitors"
  on public.check_logs for update
  to authenticated
  using (
    exists (
      select 1
      from public.monitors m
      where m.id = check_logs.monitor_id
        and auth.uid() = m.user_id
    )
  )
  with check (
    exists (
      select 1
      from public.monitors m
      where m.id = check_logs.monitor_id
        and auth.uid() = m.user_id
    )
  );

create policy "Users can delete logs for their own monitors"
  on public.check_logs for delete
  to authenticated
  using (
    exists (
      select 1
      from public.monitors m
      where m.id = check_logs.monitor_id
        and auth.uid() = m.user_id
    )
  );

-- Public read: logs shown only when the parent monitor belongs to a live page.
create policy "Public can read logs on live status pages"
  on public.check_logs for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.monitors m
      join public.public_status_pages psp
        on psp.user_id = m.user_id
       and psp.is_live = true
      where m.id = check_logs.monitor_id
    )
  );

-- public_status_pages ------------------------------------------------------
create policy "Users can read their own status page"
  on public.public_status_pages for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own status page"
  on public.public_status_pages for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own status page"
  on public.public_status_pages for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Anyone can read live status pages"
  on public.public_status_pages for select
  to anon, authenticated
  using (is_live = true);
