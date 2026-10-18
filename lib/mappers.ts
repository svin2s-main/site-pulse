import type {
  DashboardSummary,
  MonitorSummary,
  CheckLogSummary,
} from "@/app/actions/monitors";
import type {
  Monitor,
  HeartbeatPoint,
  CheckLog,
  UptimeRange,
} from "@/types/monitor";
import {
  NO_RESPONSE_STATUS_CODE,
  isFailureStatus,
  isPendingMonitor,
} from "@/lib/monitoring";

/**
 * Maps the persisted Supabase shapes returned by our Server Actions into the
 * richer, presentational `Monitor` shape used by the dashboard UI.
 *
 * Everything here is derived from real check logs. When a monitor has no logs
 * yet the derived series are empty and the UI shows an explicit "no data" state
 * rather than invented values.
 */

/** Normalize a DB status into the UI status union. */
function toUiStatus(monitor: MonitorSummary): Monitor["status"] {
  if (isPendingMonitor(monitor)) return "pending";
  // "paused" is surfaced through the separate `paused` flag.
  return monitor.status === "paused" ? "down" : monitor.status;
}

function toCheckLog(log: CheckLogSummary): CheckLog {
  return {
    id: log.id,
    timestamp: log.created_at,
    statusCode: log.status_code,
    statusText:
      log.error_message ??
      (log.status_code === NO_RESPONSE_STATUS_CODE
        ? "No response"
        : log.status_code >= 500
          ? "Server Error"
          : log.status_code >= 400
            ? "Client Error"
            : "OK"),
    responseTimeMs: log.latency_ms,
    location: log.location,
  };
}

const MAX_HEARTBEATS = 48;

/**
 * Up to 48 heartbeat bars (newest first) built from the real check logs.
 * Missing bars simply don't render — no padding with invented values.
 */
function toHeartbeats(logs: CheckLogSummary[]): HeartbeatPoint[] {
  return logs.slice(0, MAX_HEARTBEATS).map((log) => ({
    latency: isFailureStatus(log.status_code) ? null : log.latency_ms,
  }));
}

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGE_WINDOWS: Record<UptimeRange, number> = {
  "24h": DAY_MS,
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
};

/**
 * Response-time series per time range, filtered from the actual logs and
 * ordered oldest → newest so the chart reads left-to-right. Ranges with no logs
 * yield an empty array, which the chart renders as "no data".
 */
function toRangeSeries(logs: CheckLogSummary[]): Record<UptimeRange, number[]> {
  const now = Date.now();
  const successful = logs.filter((log) => !isFailureStatus(log.status_code));

  const build = (windowMs: number): number[] =>
    successful
      .filter((log) => now - Date.parse(log.created_at) <= windowMs)
      .map((log) => log.latency_ms)
      .reverse();

  return {
    "24h": build(RANGE_WINDOWS["24h"]),
    "7d": build(RANGE_WINDOWS["7d"]),
    "30d": build(RANGE_WINDOWS["30d"]),
  };
}

/**
 * SSL expiry is derived from `monitors.ssl_expires_at`, which the check runner
 * does not populate yet, so this normally returns `null` (unknown) and the UI
 * says so instead of claiming the certificate is expiring.
 */
function toSslExpiry(sslExpiresAt: string | null): {
  sslValid: boolean | null;
  sslExpiresInDays: number | null;
} {
  if (!sslExpiresAt) {
    return { sslValid: null, sslExpiresInDays: null };
  }

  const expires = Date.parse(sslExpiresAt);
  if (Number.isNaN(expires)) {
    return { sslValid: null, sslExpiresInDays: null };
  }

  const days = Math.max(0, Math.floor((expires - Date.now()) / DAY_MS));
  return { sslValid: days > 7, sslExpiresInDays: days };
}

/** Uptime over recent checks. "—" when a monitor has no logs yet. */
function toUptimePercentage(logs: CheckLogSummary[]): string {
  if (logs.length === 0) return "—";
  const success = logs.filter((log) => !isFailureStatus(log.status_code)).length;
  return ((success / logs.length) * 100).toFixed(2);
}

export function toDashboardMonitor(
  monitor: MonitorSummary,
  recentLogs: CheckLogSummary[],
): Monitor {
  const { sslValid, sslExpiresInDays } = toSslExpiry(monitor.ssl_expires_at);

  return {
    id: monitor.id,
    name: monitor.name,
    url: monitor.url,
    status: toUiStatus(monitor),
    responseTimeMs: monitor.last_latency_ms,
    uptimePercentage: toUptimePercentage(recentLogs),
    interval: monitor.interval,
    paused: monitor.is_paused,
    heartbeats: toHeartbeats(recentLogs),
    sslExpiresInDays,
    sslValid,
    rangeSeries: toRangeSeries(recentLogs),
    checkLogs: recentLogs.map(toCheckLog),
  };
}

export function toUptimeDisplay(summary: DashboardSummary): string {
  if (summary.overallUptimePercentage === null) return "—";
  return `${summary.overallUptimePercentage.toFixed(2)}%`;
}

export function toLatencyDisplay(averageLatencyMs: number | null): string {
  if (averageLatencyMs === null) return "—";
  return `${averageLatencyMs} ms`;
}
