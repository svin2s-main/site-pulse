# DevPulse — Backend & Database Architecture

Developer-focused site availability & uptime monitoring. This documents the
Next.js 15 (App Router) + Supabase backend, the RLS-secured schema, the Server
Action layer, the cron check runner, and the public status pages.

> **Stack note:** the project was scaffolded with the current `create-next-app`
> (Next.js **16.x**, React 19, Tailwind v4) rather than 15.x. All App Router
> conventions used here (async `cookies()`/`params`/`searchParams`, `revalidatePath`)
> are backward-compatible with Next 15, and this implementation follows the
> installed Next.js semantics verified against the bundled docs.

---

## 1. Database Schema

Migrations:
- `supabase/migrations/0001_init.sql` — monitors, logs, status pages
- `supabase/migrations/0002_alerts.sql` — Telegram alert channels, link tokens,
  alert delivery log, and `monitors.alerts_enabled`

Apply them in order with:

```bash
supabase db push          # from the project root
# or paste the file contents into the Supabase SQL editor
```

If you don't already have a Supabase project linked, first run `supabase init`
and `supabase link --project-ref <ref>`.

> Apply `0002_alerts.sql` to enable Telegram alerts. The dashboard now has a
> fallback for an unmigrated database: it loads monitors and logs a precise
> warning instead of failing. The Telegram card and the per-monitor alert
> toggle still require the migration, and the Telegram *environment variables*
> are optional.

If monitor loading fails for another reason, the server console now prints the
exact Supabase error (`message`, `code`, `details`, `hint`) from
`getDashboardDataAction`. If the error names `alerts_enabled` or
`alert_channels`, the migration has not been applied to that database yet.

### Enums
- `monitor_status` — `operational`, `degraded`, `down`, `paused`
  (the dashboard additionally derives a **Pending** state for monitors that have
  not completed their first check; no DB value is needed — see `lib/monitoring.ts`)
- `check_interval` — `30s`, `1m`, `5m`, `15m`, `1h`

### Tables
- **`monitors`** — one monitored endpoint per user; FK to `auth.users` with
  `ON DELETE CASCADE`; auto-maintained `updated_at` via a trigger.
- **`check_logs`** — one row per health check; FK to `monitors` with
  `ON DELETE CASCADE`; indexed on `(monitor_id, created_at desc)`.
- **`public_status_pages`** — one per user; live pages are publicly readable.
- **`alert_channels`** — one Telegram channel per user; `telegram_chat_id` is
  unique so a chat cannot receive duplicate alerts for two accounts.
- **`telegram_link_tokens`** — SHA-256 hashes of single-use dashboard link
  codes, with a 10-minute expiry and a `used_at` marker.
- **`alert_events`** — delivery audit log and the source of the per-monitor
  cooldown window.
- **`monitors.alerts_enabled`** — per-monitor opt-in, default `true`.

### Row Level Security
RLS is enabled on **all six tables**, with least-privilege policies:

| Table | Policy intent |
|-------|---------------|
| `monitors` | Owners can SELECT/INSERT/UPDATE/DELETE their own rows (`auth.uid() = user_id`) |
| `check_logs` | Owners can CRUD logs whose parent monitor they own (via `EXISTS` subquery) |
| `public_status_pages` | Owners can CRUD their page; anyone can `SELECT` rows where `is_live = true` |
| `alert_channels` | Owners can `SELECT`/`DELETE` their own channel. **No authenticated INSERT/UPDATE policy**: the webhook (service role) is the only writer of `telegram_chat_id`, and preference updates go through a server action with an explicit owner filter |
| `telegram_link_tokens` | Owners can `SELECT`/`INSERT`/`DELETE` their own hashes; the webhook consumes them with the service role |
| `alert_events` | Owners can `SELECT` their own events. **No authenticated INSERT policy**, so history cannot be forged |

**Public reads (live status page):** `monitors` and `check_logs` also expose a
SELECT policy gated on the owner having a live status page —
`EXISTS(public_status_pages WHERE user_id = monitors.user_id AND is_live = true)`.
This keeps monitoring data private unless the user explicitly publishes it.

**Defense in depth:** ownership is enforced *both* by RLS policies *and* by
explicit `user_id` filters in the application layer.

---

## 2. Supabase Clients (`lib/supabase/`)

- **`server.ts`** — `createServerClient` from `@supabase/ssr` with async
  `cookies()`; `getAll`/`setAll` implemented per the current SSR contract.
- **`client.ts`** — `createBrowserClient` for the browser.
- **`admin.ts`** — a `server-only` client authenticated with the
  **service-role key** (bypasses RLS). Used by trusted background work: the cron
  runner, the Telegram webhook, alert dispatch, and the narrowly-scoped
  preference update. It never acts on an arbitrary user id supplied by a
  client. Never import it into client code.
- **`public.ts`** — a **cookie-less** anonymous client, used only by the public
  `/status/[slug]` route. It carries no session, so it can only ever read what
  the `anon` RLS policies (live status pages) allow.

Typed via `lib/database.types.ts` (a `Database` interface mirroring the SQL
schema) so all queries are statically checked.

---

## 3. Server Actions (`app/actions/`)

All mutations run through Server Actions with Zod validation and return a
predictable `ActionResponse<T>`:

| Action | What it does |
|--------|--------------|
| `createMonitorAction(input)` | Validates `name` (1–100), `url` (http/https), `interval` (enum), `alertsEnabled` (boolean, default true); `getUser()`; inserts owned monitor; `revalidatePath("/")` |
| `updateMonitorAction(input)` | Same field validation as create, plus `id` (UUID); `getUser()`; updates the *owned* row (`id` + `user_id` filter); `revalidatePath("/")` |
| `toggleMonitorPauseAction(id)` | Validates UUID; `getUser()`; flips `is_paused` on the *owned* row |
| `deleteMonitorAction(id)` | Validates UUID; `getUser()`; deletes owned monitor (logs cascade) |
| `checkMonitorNowAction(id)` | Validates UUID; `getUser()`; loads the *owned* row; refuses paused monitors and re-checks inside a 10s cooldown; runs one forced check through the request-scoped client (RLS still applies); returns the refreshed `DashboardData` |
| `getDashboardDataAction()` | Fetches the user's monitors + last 30 `check_logs` each, plus their status-page settings; computes `overallUptimePercentage`, `averageLatencyMs`, operational/pending/active counts, and 24h incidents |
| `saveStatusPageAction(input)` | (`app/actions/status-page.ts`) Validates/normalizes `slug`, `title`, `isLive`; `getUser()`; upserts the caller's own page (`onConflict: user_id`) and maps a duplicate slug to a friendly error |
| `createTelegramLinkAction()` | (`app/actions/alerts.ts`) `getUser()`; generates a 32-byte single-use code, stores only its SHA-256 hash with a 10-minute expiry, returns the `t.me` deep link |
| `getTelegramSettingsAction()` | `getUser()`; returns the caller's channel state for the dashboard card and post-link polling |
| `updateTelegramPreferencesAction(input)` | Validates `notifyDegraded`; `getUser()`; updates the caller's own channel through the server (no authenticated UPDATE policy) |
| `sendTelegramTestAction()` | `getUser()`; sends one test message to the caller's linked chat |
| `disconnectTelegramAction()` | `getUser()`; deletes the caller's own channel (`user_id` + `type` filter) |

Security points:
- **Auth via `getUser()`** (never `getSession()`) on every action.
- **Ownership enforced server-side** — actions filter by `user_id` and rely on
  RLS, so a user can never mutate another user's rows.
- **Zod `safeParse`** on every untrusted input (raw DB errors are never
  returned to the client).
- **Timeout note:** `getDashboardDataAction` issues two queries (monitors, then
  logs batch), avoiding N+1.
- Dashboard aggregates require `@/` alias and are typed; see `DashboardData`.

---

## 4. Cron Check Runner (`app/api/cron/check/route.ts`)

A dynamic GET Route Handler triggered by an external scheduler:

1. **Authenticate** the caller: requires `Authorization: Bearer <CRON_SECRET>`.
   Without a matching secret it returns `403`.
2. Load all **non-paused** monitors with the service-role admin client.
3. For each due monitor, run a bounded `fetch()` (HEAD, falling back to GET on
   405/501) with a 10s timeout. Targets on loopback, private, or link-local
   addresses (and `.local`/`.internal` hosts) are refused before any request.
   Results are classified by `lib/monitoring.ts`, the single source of truth
   shared with the dashboard:
   - 2xx/3xx → `operational`
   - 2xx/3xx but slower than 1000ms → `degraded`
   - 4xx/5xx, a timeout, or a network error → `down`
     (a request with no response at all is stored as `status_code = 0`)
4. Persist the outcome: update `monitors.status`/`last_latency_ms` and insert a
   `check_logs` row.
5. After a status **transition**, dispatch a Telegram alert (below). Alert
   errors are caught inside the dispatcher and can never fail the check.

The same runner also powers the dashboard's per-monitor **"Check now"** action
(`checkMonitorNowAction`), which passes a request-scoped client instead of the
admin one so RLS keeps every write scoped to the signed-in user.

Scheduling options:

- **GitHub Actions (default, included)** — `.github/workflows/cron.yml` curls the
  endpoint every 5 minutes and works on **any** host. Configure a `CRON_SECRET`
  secret and an `APP_URL` repository variable (see the file header). Caveats:
  GitHub delays runs under load, and scheduled workflows pause after 60 days
  without repo activity.
- **Vercel Cron (Pro+)** — **not** committed: Vercel Hobby only allows crons that
  run **once per day** and fails the whole deployment for anything more frequent
  (`Hobby accounts are limited to daily cron jobs`). On a Pro plan add
  `vercel.json` yourself:
  ```json
  { "crons": [{ "path": "/api/cron/check", "schedule": "*/5 * * * *" }] }
  ```
  Vercel automatically sends `Authorization: Bearer $CRON_SECRET` **only if** an
  environment variable literally named `CRON_SECRET` exists in the project.
- **Anything else**:
  ```bash
  curl -X GET "https://your-app.com/api/cron/check" \
    -H "Authorization: Bearer $CRON_SECRET"
  ```

`check_interval` (30s/1m/5m/…) is enforced by skipping monitors whose
`updated_at` is not yet a full interval old, so the runner can be invoked
aggressively (e.g. every minute) and still respect each monitor's configured
frequency. Re-running it is always safe.

> 🔑 Set a **strong** `CRON_SECRET` (`openssl rand -hex 32`) before deploying —
> it is the only thing protecting the runner, which spends an outbound request
> per due monitor.

---

## 5. Telegram Alerts (`lib/alerts.ts`, `app/api/telegram/webhook/route.ts`)

One shared DevPulse bot serves every account. Users never paste a chat id or a
bot token; linking is a short-lived deep-link exchange:

1. Dashboard → **Telegram Alerts** → **Connect Telegram** calls
   `createTelegramLinkAction`, which stores only `sha256(code)` with a
   10-minute expiry and returns `https://t.me/<bot>?start=<code>`.
2. The user opens the link and presses **Start**. Telegram calls the webhook
   with the `X-Telegram-Bot-Api-Secret-Token` header.
3. The webhook **atomically consumes** the code with a conditional update
   (`used_at IS NULL AND expires_at > now()`), then upserts the chat into
   `alert_channels` using the service role.
4. `/stop` sets `is_active = false`; a new dashboard link re-links the chat.

Delivery rules (`dispatchStatusAlert`, called from the check runner after the
row and log are persisted):

- **down** — any transition into `down`
- **recovered** — `down` → `operational`
- **degraded** — transitions into `degraded`, only when the owner opted in
  (off by default)
- Per-monitor `alerts_enabled` (default `true`) gates delivery; the monitor form
  exposes it and the drawer shows an "Alerts off" chip.
- Down/degraded alerts share a **10-minute per-monitor cooldown**; recoveries
  are always sent so an outage is not left without its "back up" message.
- Manual **Check now** runs through the same runner and therefore also alerts.
- Messages HTML-escape the monitor name/URL/error and contain status, latency,
  and a UTC timestamp. The Telegram request is bounded to **8 seconds**.
- A failed send is logged and swallowed: alerts can never fail a health check,
  and `alert_events` is written only after a successful send.

### Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) (`/newbot`). Note the
   token and the username.
2. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (without `@`), and
   `TELEGRAM_WEBHOOK_SECRET` (`openssl rand -hex 32`) locally and in Vercel.
3. Apply the migration: `supabase db push`.
4. Deploy, then register the webhook once:

   ```bash
   curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
     -H "content-type: application/json" \
     -d '{
       "url": "'"${APP_URL}"'/api/telegram/webhook",
       "secret_token": "'"${TELEGRAM_WEBHOOK_SECRET}"'"
     }'
   ```

   Check it with
   `curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"`.
   On PowerShell, use `Invoke-RestMethod` with the same JSON body.
5. Open the dashboard, connect Telegram, and use **Send test** to verify.

### Security notes

- The bot token is **server-only** and is never logged or exposed to the client.
- Deep-link codes are random (32 bytes), stored only as hashes, single-use, and
  expire after 10 minutes.
- The webhook secret is separate from the bot token and compared in constant
  time; a missing secret rejects every request.
- `alert_channels` has no authenticated INSERT/UPDATE policy, so a user cannot
  repoint `telegram_chat_id` at another chat through PostgREST.
- `alert_events` has no authenticated INSERT policy, so delivery history cannot
  be forged.

---

## 6. Public Status Pages (`/status/[slug]`)

Each user can publish **one** status page (`public_status_pages.user_id` is
unique) and share it as `/status/<slug>`. The dashboard's "Public Status Page"
card creates it: title, slug, and a publish toggle.

- **Route:** `app/status/[slug]/page.tsx` — a Server Component, fully anonymous.
- **Data access:** `lib/public-status-page.ts` reads through
  `lib/supabase/public.ts`, a **cookie-less** anonymous client, so the page
  depends only on the `anon` RLS policies. A slug that does not exist *or* is not
  published yields the same 404 — unpublished slugs cannot be probed.
- **Real 404s come from the Proxy, not the page.** With `cacheComponents` every
  route is partially prerendered, so the shell — and its `200` — is already on
  the wire before a page-level `notFound()` runs (Next.js documents this as the
  "soft 404" case). `proxy.ts` therefore validates the slug and confirms a live
  row *before* rendering, and answers with `NextResponse.rewrite("/404", {
  status: 404 })`, which renders `app/not-found.tsx` with a genuine `404`. The
  page keeps its own `notFound()` only as a race/error fallback. Public status
  paths also skip the session refresh, since they need no session at all.
- **No `loading.tsx`:** a status page paints its real content rather than a
  skeleton flash, which matters most when customers check it during an incident.
- **`not-found.tsx`:** `app/not-found.tsx` is the app-wide 404 (also used for any
  unmatched URL); `app/status/[slug]/not-found.tsx` is the status-specific copy,
  sharing the `NotFoundNotice` shell. Both use identical wording for
  unknown/unpublished so slugs cannot be probed.
- **Exposure is opt-in:** `is_live` defaults to `false`, and the anonymous RLS
  policies on `monitors` / `check_logs` only match rows whose owner has a live
  page. Unpublishing (or renaming) a slug removes the page from the public web
  immediately.
- **Minimal data:** the query selects only `name`, `status`, `last_latency_ms`,
  `is_paused`, timestamps and log `status_code` — monitor **URLs**, check
  **locations** and raw `error_message` values are never fetched, so they cannot
  leak onto a public page. The page renders names + status + a 24h uptime figure.
- **`noindex`:** status pages are shared by link, not indexed by search engines
  (`robots: { index: false, follow: false }`).

**Slug rules** (`lib/slug.ts`, mirrored by the DB CHECK constraint): 3–50 chars,
lowercase alphanumerics separated by single hyphens, plus a reserved-word list.
A duplicate slug is reported as "already taken" (Postgres `23505`) instead of
overwriting another user's page.

> ⚠️ **What is exposed:** a live page reveals **all** of the owner's monitors
> (there is no per-monitor publish flag in the schema), their names, statuses and
> 24h uptime to anyone who knows the slug. Slugs are guessable in principle, so
> treat publishing as public disclosure.

---

## 7. Environment Variables

Copy `.env.example` → `.env` and fill in values:

| Variable | Required | Scope | Purpose |
|----------|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | public | anon (publishable) key — client identifier only |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **server-only** | admin key (bypasses RLS); cron runner only |
| `NEXT_PUBLIC_APP_URL` | no | public | base URL for the app (also used to build public status-page links) |
| `CRON_SECRET` | yes* | server-only | bearer secret for `/api/cron/check` |
| `TELEGRAM_BOT_TOKEN` | no | **server-only** | token for the shared Telegram bot |
| `TELEGRAM_BOT_USERNAME` | no | server-side (non-secret) | bot username used to build `t.me` deep links |
| `TELEGRAM_WEBHOOK_SECRET` | no | **server-only** | value Telegram echoes in `X-Telegram-Bot-Api-Secret-Token` |

\* Required for the cron runner to work; the app builds and runs without it, but
every request to `/api/cron/check` is then rejected with `403`. Generate with
`openssl rand -hex 32` and set the same value in your scheduler
(Vercel env var or the `CRON_SECRET` GitHub Actions secret).

Telegram is optional: without the three `TELEGRAM_*` values the dashboard still
works, the card reports that alerts are not configured, and the webhook rejects
all requests. The app never asks users for a bot token or chat id.

`.env` is git-ignored; `.env.example` is committed with placeholders. `lib/env.ts`
validates required secrets **lazily at point-of-use** so a production build that
lacks runtime values still compiles (failures surface at request time, not build).

---

## 8. Security Checklist

- ✅ `getUser()` everywhere — no `getSession()` for authorization.
- ✅ RLS on all tables; explicit, least-privilege policies.
- ✅ Ownership enforced in app layer *and* DB layer.
- ✅ Service-role key restricted to a `server-only` module; never bundled.
- ✅ Zod validation on every Server Action input.
- ✅ Cron endpoint protected by a shared secret (bearer).
- ✅ Public exposure of monitor/log data gated on a **live** status page.
- ✅ `monitors` URL is normalized to `http(s)` and validated.
- ✅ Outbound cron `fetch()` is bounded (timeout + `cache: no-store`).
- ✅ Outbound checks refuse literal loopback/private/link-local targets (basic SSRF guard).
- ✅ Public exposure is opt-in (`public_status_pages.is_live`) and served through anonymous RLS policies.
- ✅ Public pages never fetch or render monitor URLs, check locations, or raw error messages.
- ✅ Unpublished and unknown slugs are indistinguishable (both 404); public pages are `noindex`.
- ✅ A user can only upsert their **own** status page; duplicate slugs are refused (`23505`).
- ✅ Telegram bot token is server-only; webhook requests require the separate secret header (constant-time compare).
- ✅ Telegram link codes are random, hashed at rest, single-use, and expire after 10 minutes.
- ✅ `alert_channels` chat ids can only be written by the webhook (service role); users cannot repoint a channel through PostgREST.
- ✅ Alert delivery is fail-open for monitoring: Telegram errors are caught and never fail a check.

## 9. Known Limitations & Assumptions

- **First-check timing:** a newly created monitor's first check runs one full
  `check_interval` after creation (driven by `updated_at`). Pausing/resuming a
  monitor also resets its next due time. Until that first check lands the monitor
  is shown as **Pending** (never as a false "Operational"), and the dashboard's
  "Check now" runs one immediately. A dedicated `last_checked_at` column would be
  the precise fix but is out of scope for the specified schema.
- **The schedule is committed but not active until you deploy:** `.github/workflows/cron.yml`
  exists, but nothing runs it until the app is live with a matching `CRON_SECRET`
  and an `APP_URL` repository variable. Until then the statistics stay sparse and
  are driven only by manual "Check now". (`vercel.json` is intentionally absent —
  see the plan-limit note in section 4.)
- **Public status pages:** implemented — see section 6. A live page discloses
  **all** of the owner's monitors (the schema has no per-monitor publish flag)
  and slugs are guessable, so publishing is a public disclosure. The page renders
  no URLs or raw errors, but the anonymous RLS policies still grant `SELECT` on
  the whole `monitors`/`check_logs` rows to anyone with the slug — the REST API,
  not just the UI, is the exposure surface. See "Optional hardening" below.
- **SSL expiry is not tracked:** nothing populates `monitors.ssl_expires_at`, so
  the monitor drawer reports it as "SSL not tracked" rather than inventing a
  value.
- **SSRF guard scope:** literal loopback/private/link-local targets are refused,
  but a public hostname that resolves to a private address (DNS rebinding) is
  not — outbound checks are not otherwise sandboxed.
- **Auth & dashboard:** implemented. Email/password sign-up and sign-in run
  through Server Actions (`app/actions/auth.ts`), the session is refreshed in
  `proxy.ts`, and the data-access layer (`lib/auth.ts`) plus per-action
  `getUser()` calls are the authoritative authorization boundary. The dashboard
  lives at `/` and is server-rendered per request.
- **Telegram delivery is best-effort:** a send that fails (bot blocked, Telegram
  outage, revoked token) is logged but not retried, because a retry could
  duplicate messages. The console is the only record of a failed send. The
  webhook must be registered against a public HTTPS URL; localhost needs a
  tunnel (e.g. `ngrok`) and `setWebhook` pointed at it.
- **One Telegram chat per account:** all monitor alerts go to the same chat.
  There is no per-monitor chat routing. Linking the same chat from another
  account moves it (last link wins).
- **Cooldowns are per monitor and alert type:** a flapping monitor can still
  send a recovery after a suppressed down alert; the 10-minute window applies
  to down/degraded messages, not recoveries. The degraded threshold is the
  existing 1000ms rule in `lib/monitoring.ts`.
- **Aggregation granularity:** uptime/latency metrics are computed from the
  last 30 logs per monitor (capped), so they reflect a recent window, not full
  history. Persisting an aggregate/rollup is a later enhancement.
- `monitor_status` in the database has no `pending` value; "Pending" is derived
  (`status = operational AND last_latency_ms IS NULL`, see `lib/monitoring.ts`)
  so no migration is required.
- **Status-page 404s are Proxy-produced:** the Proxy probe is a second lookup on
  top of the page's own read, and it **fails open** — a transient Supabase error
  falls through to the page, which then answers `200` with the not-found UI
  (`noindex`) instead of a hard `404`. The narrow race where a page is
  unpublished between the probe and the read behaves the same way. Slugs are
  guessable, so confidentiality still rests on `is_live`, not on secrecy.
- The cron runner uses a **service-role** client by design (it runs as the
  system). End-user actions never bypass RLS.

### Optional hardening: column-level grants for anonymous readers

The anonymous policies are **row-level**, so an `anon` reader holding the
publishable key can still select `monitors.url`, `check_logs.error_message`, and
other columns of a live page's rows through PostgREST — even though the UI never
shows them. Column-level grants close that gap.

> ⚠️ **Not applied and not verified.** Review it against your own policies and
> test on a staging project before running it in production.

```sql
-- Restrict what an anonymous reader may select on a live status page.
revoke select on public.monitors from anon;
grant select (id, user_id, name, status, last_latency_ms, is_paused, created_at)
  on public.monitors to anon;

revoke select on public.check_logs from anon;
grant select (monitor_id, status_code, created_at) on public.check_logs to anon;

revoke select on public.public_status_pages from anon;
grant select (slug, title, is_live, user_id)
  on public.public_status_pages to anon;

-- Rollback (restores the default Supabase grants):
-- grant select on public.monitors, public.check_logs, public.public_status_pages
--   to anon;
```

The application selects exactly the granted columns, so the public page keeps
working whether or not you apply this.
