-- ============================================================================
-- DevPulse alerting schema (Telegram)
--
-- One DevPulse bot serves every account. A signed-in user generates a
-- short-lived, single-use code in the dashboard, opens the bot's deep link, and
-- presses Start. The webhook consumes the code and stores the Telegram chat.
-- No bot tokens or chat ids are ever supplied manually by the user.
--
-- Run via: supabase db push  (or apply in the Supabase SQL editor)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Per-monitor opt-in
-- ---------------------------------------------------------------------------
alter table public.monitors
  add column if not exists alerts_enabled boolean not null default true;

comment on column public.monitors.alerts_enabled is
  'When false, status transitions for this monitor never send alerts.';

-- ---------------------------------------------------------------------------
-- 2. alert_channels
--
-- Exactly one Telegram channel per user. The (user_id, type) unique constraint
-- enforces that; telegram_chat_id is also unique so one chat cannot receive
-- duplicate alerts for two accounts.
--
-- Rows are written ONLY by the Telegram webhook / preference action using the
-- service role. Authenticated users may read and delete their own row, but they
-- have no INSERT/UPDATE policy: this prevents a user from repointing
-- telegram_chat_id at another chat through PostgREST.
-- ---------------------------------------------------------------------------
create table if not exists public.alert_channels (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  type              text not null default 'telegram'
                    check (type = 'telegram'),
  telegram_chat_id  bigint not null unique,
  telegram_username text,
  is_active         boolean not null default true,
  notify_degraded   boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint alert_channels_user_type_key unique (user_id, type)
);

create index if not exists alert_channels_user_id_idx
  on public.alert_channels (user_id);

-- ---------------------------------------------------------------------------
-- 3. telegram_link_tokens
--
-- Only the SHA-256 hash of the deep-link code is stored. The raw code exists
-- solely in the link the user opens; it expires after 10 minutes and is
-- consumed with a single conditional UPDATE so it cannot be replayed.
-- ---------------------------------------------------------------------------
create table if not exists public.telegram_link_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists telegram_link_tokens_user_id_idx
  on public.telegram_link_tokens (user_id, created_at desc);

create index if not exists telegram_link_tokens_expires_at_idx
  on public.telegram_link_tokens (expires_at);

-- ---------------------------------------------------------------------------
-- 4. alert_events
--
-- Delivery log. Doubles as the cooldown source: down/degraded alerts are
-- suppressed when the same monitor already produced that alert type within the
-- cooldown window. Rows are inserted by the server only (no authenticated
-- INSERT policy), so clients cannot forge history.
-- ---------------------------------------------------------------------------
create table if not exists public.alert_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  monitor_id    uuid not null references public.monitors (id) on delete cascade,
  channel_id    uuid references public.alert_channels (id) on delete set null,
  type          text not null check (type in ('down', 'recovered', 'degraded')),
  status_code   integer,
  latency_ms    integer,
  error_message text,
  created_at    timestamptz not null default now()
);

create index if not exists alert_events_monitor_type_created_idx
  on public.alert_events (monitor_id, type, created_at desc);

create index if not exists alert_events_user_created_idx
  on public.alert_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.alert_channels       enable row level security;
alter table public.telegram_link_tokens enable row level security;
alter table public.alert_events         enable row level security;

-- alert_channels ------------------------------------------------------------
drop policy if exists "Users can read their own alert channel"
  on public.alert_channels;
create policy "Users can read their own alert channel"
  on public.alert_channels for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own alert channel"
  on public.alert_channels;
create policy "Users can delete their own alert channel"
  on public.alert_channels for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- telegram_link_tokens ------------------------------------------------------
drop policy if exists "Users can read their own link tokens"
  on public.telegram_link_tokens;
create policy "Users can read their own link tokens"
  on public.telegram_link_tokens for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own link tokens"
  on public.telegram_link_tokens;
create policy "Users can create their own link tokens"
  on public.telegram_link_tokens for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own link tokens"
  on public.telegram_link_tokens;
create policy "Users can delete their own link tokens"
  on public.telegram_link_tokens for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- alert_events --------------------------------------------------------------
drop policy if exists "Users can read their own alert events"
  on public.alert_events;
create policy "Users can read their own alert events"
  on public.alert_events for select
  to authenticated
  using ((select auth.uid()) = user_id);
