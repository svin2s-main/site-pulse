import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { isFailureStatus, isPendingMonitor } from "@/lib/monitoring";
import type { MonitorStatus as DbMonitorStatus } from "@/lib/database.types";
import type { MonitorStatus } from "@/types/monitor";
import type {
  PublicMonitorEntry,
  PublicStatusPageData,
  StatusPageOverall,
} from "@/types/status-page";

/**
 * Loads a published status page as an anonymous visitor.
 *
 * Everything here is scoped by the `anon` RLS policies in
 * `supabase/migrations/0001_init.sql`: a row is readable only when its owner has
 * a status page with `is_live = true`. If the slug does not exist, is not live,
 * or the request fails, the caller gets `null` and renders a 404 — we never
 * distinguish "wrong slug" from "not published" to avoid confirming which slugs
 * exist.
 *
 * The selected columns are intentionally the minimal, non-sensitive set: the
 * monitor URL, check location, and raw error messages are never fetched, so they
 * cannot leak onto a public page.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Upper bound on the logs scanned for the 24h uptime figure. */
const MAX_LOGS = 2000;

function toPublicStatus(state: {
  status: DbMonitorStatus;
  last_latency_ms: number | null;
}): MonitorStatus {
  if (isPendingMonitor(state)) return "pending";
  // "paused" is surfaced through the separate `paused` flag.
  return state.status === "paused" ? "down" : state.status;
}

function resolveOverall(monitors: PublicMonitorEntry[]): StatusPageOverall {
  if (monitors.length === 0) return "empty";

  const active = monitors.filter((monitor) => !monitor.paused);
  if (active.length === 0) return "paused";
  if (active.some((monitor) => monitor.status === "down")) return "down";
  if (active.some((monitor) => monitor.status === "degraded")) return "degraded";
  if (active.some((monitor) => monitor.status === "pending")) return "pending";
  return "healthy";
}

export const loadPublicStatusPage = cache(
  async (slug: string): Promise<PublicStatusPageData | null> => {
    const supabase = createPublicClient();

    const { data: page, error: pageError } = await supabase
      .from("public_status_pages")
      .select("slug,title,user_id")
      .eq("slug", slug)
      .eq("is_live", true)
      .maybeSingle();

    if (pageError || !page) return null;

    const { data: monitorRows, error: monitorsError } = await supabase
      .from("monitors")
      .select("id,user_id,name,status,last_latency_ms,is_paused,created_at")
      .eq("user_id", page.user_id)
      .order("created_at", { ascending: true });

    if (monitorsError) return null;

    const monitors = monitorRows ?? [];
    const monitorIds = monitors.map((monitor) => monitor.id);

    let logs: { monitor_id: string; status_code: number; created_at: string }[] =
      [];
    if (monitorIds.length > 0) {
      const since = new Date(Date.now() - DAY_MS).toISOString();
      const { data: logRows } = await supabase
        .from("check_logs")
        .select("monitor_id,status_code,created_at")
        .in("monitor_id", monitorIds)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(MAX_LOGS);

      logs = logRows ?? [];
    }

    const byMonitor = new Map<string, { total: number; success: number }>();
    for (const log of logs) {
      const bucket = byMonitor.get(log.monitor_id) ?? { total: 0, success: 0 };
      bucket.total += 1;
      if (!isFailureStatus(log.status_code)) bucket.success += 1;
      byMonitor.set(log.monitor_id, bucket);
    }

    const entries: PublicMonitorEntry[] = monitors.map((monitor) => {
      const bucket = byMonitor.get(monitor.id);
      return {
        id: monitor.id,
        name: monitor.name,
        status: toPublicStatus(monitor),
        paused: monitor.is_paused,
        uptimePercentage:
          bucket && bucket.total > 0
            ? ((bucket.success / bucket.total) * 100).toFixed(2)
            : "—",
      };
    });

    return {
      slug: page.slug,
      title: page.title,
      overall: resolveOverall(entries),
      monitors: entries,
      // Newest first, so the head of the list is the most recent check.
      lastCheckedAt: logs[0]?.created_at ?? null,
    };
  },
);
