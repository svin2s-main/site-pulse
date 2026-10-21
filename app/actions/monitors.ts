"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkMonitor } from "@/lib/check-runner";
import { ok, fail, type ActionResponse } from "@/lib/action-result";
import {
  isFailureStatus,
  isPendingMonitor,
  isSuccessStatus,
} from "@/lib/monitoring";
import type { CheckInterval, MonitorStatus } from "@/lib/database.types";
import type { StatusPageSummary } from "@/types/status-page";
import type { TelegramSettings } from "@/types/alerts";
import { loadTelegramSettings } from "@/lib/alerts";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const monitorUrlSchema = z
  .string()
  .trim()
  .url("Please enter a valid URL")
  .refine(
    (value) => /^https?:\/\//i.test(value),
    "URL must use http or https",
  );

const createMonitorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  url: monitorUrlSchema,
  interval: z.enum(["30s", "1m", "5m", "15m", "1h"], {
    error: "Invalid check interval",
  }),
  /** Per-monitor Telegram alerts; enabled by default. */
  alertsEnabled: z.boolean().default(true),
});

const monitorIdSchema = z
  .string()
  .trim()
  .uuid("Invalid monitor id");

const updateMonitorSchema = createMonitorSchema.extend({
  id: monitorIdSchema,
});

// ---------------------------------------------------------------------------
// Public types returned by the actions
// ---------------------------------------------------------------------------

export type MonitorWithLogs = {
  monitor: MonitorSummary;
  recentLogs: CheckLogSummary[];
};

export type MonitorSummary = {
  id: string;
  name: string;
  url: string;
  interval: CheckInterval;
  status: MonitorStatus;
  last_latency_ms: number | null;
  is_paused: boolean;
  alerts_enabled: boolean;
  ssl_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CheckLogSummary = {
  id: string;
  monitor_id: string;
  status_code: number;
  latency_ms: number;
  location: string;
  error_message: string | null;
  created_at: string;
};

export type DashboardSummary = {
  overallUptimePercentage: number | null;
  averageLatencyMs: number | null;
  /** Active (non-paused) monitors currently reporting success. */
  operationalCount: number;
  /** Active monitors that have not completed their first check yet. */
  pendingCount: number;
  /** Non-paused monitors. */
  activeCount: number;
  /** Every monitor, paused included. */
  totalCount: number;
  incidents24h: number;
};

export type DashboardData = {
  monitors: MonitorWithLogs[];
  summary: DashboardSummary;
  /** The user's public status page settings, or null when never configured. */
  statusPage: StatusPageSummary | null;
  /** Telegram alert channel state and deployment configuration. */
  telegram: TelegramSettings;
};

// ---------------------------------------------------------------------------
// createMonitorAction
// ---------------------------------------------------------------------------

export async function createMonitorAction(
  input: unknown,
): Promise<ActionResponse<MonitorSummary>> {
  const parsed = createMonitorSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Unauthorized");
  }

  const { data, error } = await supabase
    .from("monitors")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      url: parsed.data.url,
      interval: parsed.data.interval,
      alerts_enabled: parsed.data.alertsEnabled,
    })
    .select(
      "id,name,url,interval,status,last_latency_ms,is_paused,alerts_enabled,ssl_expires_at,created_at,updated_at",
    )
    .single();

  if (error || !data) {
    return fail("Failed to create monitor");
  }

  revalidatePath("/");

  return ok(data);
}

// ---------------------------------------------------------------------------
// updateMonitorAction
// ---------------------------------------------------------------------------

export async function updateMonitorAction(
  input: unknown,
): Promise<ActionResponse<MonitorSummary>> {
  const parsed = updateMonitorSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Unauthorized");
  }

  // Ownership is enforced both by the RLS update policy and the explicit
  // user_id filter (defense in depth), so a user can only edit their own row.
  const { data, error } = await supabase
    .from("monitors")
    .update({
      name: parsed.data.name,
      url: parsed.data.url,
      interval: parsed.data.interval,
      alerts_enabled: parsed.data.alertsEnabled,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select(
      "id,name,url,interval,status,last_latency_ms,is_paused,alerts_enabled,ssl_expires_at,created_at,updated_at",
    )
    .single();

  if (error || !data) {
    return fail("Failed to update monitor");
  }

  revalidatePath("/");

  return ok(data);
}

// ---------------------------------------------------------------------------
// toggleMonitorPauseAction
// ---------------------------------------------------------------------------

export async function toggleMonitorPauseAction(
  monitorId: string,
): Promise<ActionResponse<{ id: string; is_paused: boolean }>> {
  const parsed = monitorIdSchema.safeParse(monitorId);

  if (!parsed.success) {
    return fail("Invalid monitor id");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Unauthorized");
  }

  // Fetch current row owned by the user, write through the same ownership filter.
  const { data: current } = await supabase
    .from("monitors")
    .select("id,is_paused")
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .single();

  if (!current) {
    return fail("Monitor not found");
  }

  const nextPaused = !current.is_paused;

  const { data: updated, error } = await supabase
    .from("monitors")
    .update({ is_paused: nextPaused })
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .select("id,is_paused")
    .single();

  if (error || !updated) {
    return fail("Failed to update monitor");
  }

  revalidatePath("/");

  return ok({ id: updated.id, is_paused: updated.is_paused });
}

// ---------------------------------------------------------------------------
// deleteMonitorAction
// ---------------------------------------------------------------------------

export async function deleteMonitorAction(
  monitorId: string,
): Promise<ActionResponse<{ id: string }>> {
  const parsed = monitorIdSchema.safeParse(monitorId);

  if (!parsed.success) {
    return fail("Invalid monitor id");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Unauthorized");
  }

  // Ownership is enforced both by the RLS delete policy and the explicit
  // user_id filter (defense in depth).
  const { data, error } = await supabase
    .from("monitors")
    .delete()
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return fail("Failed to delete monitor");
  }

  // check_logs cascade to the monitor via ON DELETE CASCADE.
  revalidatePath("/");

  return ok({ id: data.id });
}

// ---------------------------------------------------------------------------
// getDashboardDataAction
// ---------------------------------------------------------------------------

const LAST_24H = 1000 * 60 * 60 * 24;

export async function getDashboardDataAction(): Promise<
  ActionResponse<DashboardData>
> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Unauthorized");
  }

  const { data: monitors, error: monitorsError } = await supabase
    .from("monitors")
    .select(
      "id,name,url,interval,status,last_latency_ms,is_paused,alerts_enabled,ssl_expires_at,created_at,updated_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (monitorsError) {
    return fail("Failed to load monitors");
  }

  // Pull the last 30 check logs per monitor. Fetched up-front (single query)
  // and grouped in memory, which avoids a per-monitor N+1 pattern.
  const monitorIds = monitors.map((monitor) => monitor.id);

  let logs: CheckLogSummary[] = [];
  if (monitorIds.length > 0) {
    const { data: logData, error: logsError } = await supabase
      .from("check_logs")
      .select(
        "id,monitor_id,status_code,latency_ms,location,error_message,created_at",
      )
      .in("monitor_id", monitorIds)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (logsError) {
      return fail("Failed to load check logs");
    }

    logs = logData as unknown as CheckLogSummary[];
  }

  const logsByMonitor = new Map<string, CheckLogSummary[]>();
  for (const monitor of monitors) {
    logsByMonitor.set(monitor.id, []);
  }
  for (const log of logs) {
    const bucket = logsByMonitor.get(log.monitor_id);
    // Sorted newest-first already; keep at most the last 30 per monitor.
    if (bucket && bucket.length < 30) {
      bucket.push(log);
    }
  }

  const monitorsWithLogs: MonitorWithLogs[] = monitors.map((monitor) => ({
    monitor,
    recentLogs: logsByMonitor.get(monitor.id) ?? [],
  }));

  const summary = computeSummary(monitors, logs);

  // The owner-facing status page settings ride along with the dashboard payload
  // so the publishing card renders without a second round trip.
  const { data: statusPageRow } = await supabase
    .from("public_status_pages")
    .select("slug,title,is_live")
    .eq("user_id", user.id)
    .maybeSingle();

  const statusPage: StatusPageSummary | null = statusPageRow
    ? {
        slug: statusPageRow.slug,
        title: statusPageRow.title,
        isLive: statusPageRow.is_live,
      }
    : null;

  // Same idea for the Telegram card: it is small and always rendered, so it
  // rides along with the dashboard payload instead of issuing a second request.
  const telegram = await loadTelegramSettings(supabase, user.id);

  return ok({ monitors: monitorsWithLogs, summary, statusPage, telegram });
}

// ---------------------------------------------------------------------------
// checkMonitorNowAction
// ---------------------------------------------------------------------------

const MANUAL_CHECK_COOLDOWN_MS = 10_000;

/**
 * Manual "Check now" for a single monitor the caller owns.
 *
 * Unlike the cron runner this uses the request-scoped client, so RLS still
 * scopes every write to the signed-in user's rows. It also refuses to run more
 * often than `MANUAL_CHECK_COOLDOWN_MS` per monitor, so an authenticated user
 * cannot turn the endpoint into an unbounded outbound prober.
 */
export async function checkMonitorNowAction(
  input: unknown,
): Promise<ActionResponse<DashboardData>> {
  const parsed = monitorIdSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Invalid monitor id");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Unauthorized");
  }

  const { data: monitor, error: monitorError } = await supabase
    .from("monitors")
    .select("*")
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .single();

  if (monitorError || !monitor) {
    return fail("Monitor not found");
  }

  if (monitor.is_paused) {
    return fail("Resume this monitor before checking it");
  }

  // The cooldown is measured from the newest log row (written only by checks),
  // because `updated_at` also moves when the monitor is edited.
  const { data: latestLog } = await supabase
    .from("check_logs")
    .select("created_at")
    .eq("monitor_id", monitor.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestLog) {
    const elapsedMs = Date.now() - Date.parse(latestLog.created_at);
    if (elapsedMs < MANUAL_CHECK_COOLDOWN_MS) {
      return fail("This monitor was checked a moment ago — try again shortly");
    }
  }

  try {
    await checkMonitor(monitor, supabase, { force: true });
  } catch {
    return fail("The check could not be completed");
  }

  revalidatePath("/");

  // Hand back the refreshed dashboard so the client can replace its state with
  // server truth (the new log row and the recomputed summary).
  return getDashboardDataAction();
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

function computeSummary(
  monitors: MonitorSummary[],
  logs: CheckLogSummary[],
): DashboardSummary {
  const cutoff = new Date(Date.now() - LAST_24H).toISOString();
  const recentLogs = logs.filter((log) => log.created_at >= cutoff);

  const totalChecks = recentLogs.length;
  const successfulChecks = recentLogs.filter((log) =>
    isSuccessStatus(log.status_code),
  ).length;

  const overallUptimePercentage =
    totalChecks > 0
      ? Math.round((successfulChecks / totalChecks) * 10000) / 100
      : null;

  const latencyValues = recentLogs
    .filter((log) => isSuccessStatus(log.status_code))
    .map((log) => log.latency_ms);

  const averageLatencyMs =
    latencyValues.length > 0
      ? Math.round(
          latencyValues.reduce((sum, value) => sum + value, 0) /
            latencyValues.length,
        )
      : null;

  const activeMonitors = monitors.filter((monitor) => !monitor.is_paused);

  return {
    overallUptimePercentage,
    averageLatencyMs,
    operationalCount: activeMonitors.filter(
      (monitor) => monitor.status === "operational" && !isPendingMonitor(monitor),
    ).length,
    pendingCount: activeMonitors.filter((monitor) => isPendingMonitor(monitor))
      .length,
    activeCount: activeMonitors.length,
    totalCount: monitors.length,
    // Every non-2xx/3xx check is an incident. This includes timeouts, which are
    // recorded with status_code 0 and were previously not counted at all.
    incidents24h: recentLogs.filter((log) => isFailureStatus(log.status_code))
      .length,
  };
}
